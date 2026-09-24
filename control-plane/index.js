const express = require('express');
const { createClient } = require('redis');
const { NodeSSH } = require('node-ssh');

const app = express();
app.use(express.json());

// Connexion au serveur Redis (sur le réseau Docker)
const redisClient = createClient({
    url: 'redis://redis:6379'
});

redisClient.on('error', (err) => console.error('Erreur Redis :', err));

async function start() {
    await redisClient.connect();
    console.log("Connecté à Redis (Control Plane)");
}
start();

// 1. Route d'enregistrement (Heartbeat) des Workers
app.post('/api/heartbeat', async (req, res) => {
    const { workerId, ip } = req.body;
    if (!workerId || !ip) {
        return res.status(400).json({ error: "workerId et ip requis" });
    }

    const workerKey = `worker:${workerId}`;
    const statusKey = `worker:${workerId}:status`;

    // Enregistre l'IP du worker
    await redisClient.set(workerKey, ip);

    // Si le worker n'a pas encore de statut, on l'initialise à "libre"
    const currentStatus = await redisClient.get(statusKey);
    if (!currentStatus) {
        await redisClient.set(statusKey, 'libre');
    }

    res.status(200).json({ message: "Heartbeat reçu" });
});

// 2. Route de déploiement / allocation d'un Worker libre
app.post('/api/deploy', async (req, res) => {
    try {
        const dureeMinutes = parseInt(req.body.duree) || 10;
        
        // Récupérer toutes les clés des workers enregistrés
        const keys = await redisClient.keys('worker:*');
        let selectedWorkerId = null;
        let selectedWorkerIp = null;
        const clientNom = req.body.clientNom || 'client_defaut';
        console.log(`[DEBUG] Nom du dossier client utilisé : ${clientNom}`);

        // Chercher un worker qui a le statut "libre"
        for (const key of keys) {
            if (key.split(':').length === 2) {
                const workerId = key.replace('worker:', '');
                const status = await redisClient.get(`worker:${workerId}:status`);

                if (status === 'libre') {
                    selectedWorkerId = workerId;
                    selectedWorkerIp = await redisClient.get(key);
                    break;
                }
            }
        }

        if (!selectedWorkerId || !selectedWorkerIp) {
            return res.status(503).json({ error: "Aucun worker disponible. Tous sont occupés." });
        }

        console.log(`[ALLOCATION] Attribution de ${selectedWorkerId} (${selectedWorkerIp}) pour ${dureeMinutes} minutes.`);

        // Verrouillage immédiat dans Redis
        const expiresAt = Date.now() + (dureeMinutes * 60 * 1000);
        await redisClient.set(`worker:${selectedWorkerId}:status`, 'loué');
        await redisClient.set(`worker:${selectedWorkerId}:expires_at`, expiresAt);

        // Connexion SSH au Worker avec le mot de passe 'vagrant'
        const ssh = new NodeSSH();
        await ssh.connect({
            host: selectedWorkerIp,
            username: 'vagrant',
            password: 'vagrant'
        });

        // Lancement d'un conteneur de test sur un port spécifique
        const portAttribue = 8080;
        await ssh.execCommand(`mkdir -p /vagrant_data/${clientNom}`);
        const result = await ssh.execCommand(`docker run -dit -p ${portAttribue}:7681 -v /vagrant_data/${clientNom}:/data tsl0922/ttyd ttyd -W bash`);
        if (result.code !== 0) {
            await redisClient.set(`worker:${selectedWorkerId}:status`, 'libre');
            await redisClient.del(`worker:${selectedWorkerId}:expires_at`);
            return res.status(500).json({ error: "Échec du lancement de l'environnement", details: result.stderr });
        }

        res.status(200).json({
            message: "Environnement alloué avec succès !",
            worker: selectedWorkerId,
            app_url: `http://${selectedWorkerIp}:${portAttribue}`,
            port: portAttribue,
            expires_at: expiresAt
        });

    } catch (err) {
        console.error("Erreur lors de l'allocation :", err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Tâche de fond : Surveillance des expirations (exécutée toutes les 15 secondes)
setInterval(async () => {
    try {
        const keys = await redisClient.keys('worker:*');
        const now = Date.now();

        for (const key of keys) {
            if (key.split(':').length === 2) {
                const workerId = key.replace('worker:', '');
                const status = await redisClient.get(`worker:${workerId}:status`);

                if (status === 'loué') {
                    const expiresAt = await redisClient.get(`worker:${workerId}:expires_at`);

                    if (expiresAt && now > parseInt(expiresAt)) {
                        console.log(`[EXPIRATION] Le temps est écoulé pour ${workerId}. Nettoyage...`);
                        const workerIp = await redisClient.get(key);

                        try {
                            const ssh = new NodeSSH();
                            await ssh.connect({
                                host: workerIp,
                                username: 'vagrant',
                                password: 'vagrant'
                            });
                            await ssh.execCommand('docker rm -f $(docker ps -aq)');
                            console.log(`[SSH] Conteneurs nettoyés sur ${workerId}.`);
                        } catch (sshErr) {
                            console.error(`[SSH ERREUR] Impossible de nettoyer ${workerId} :`, sshErr.message);
                        }

                        await redisClient.set(`worker:${workerId}:status`, 'libre');
                        await redisClient.del(`worker:${workerId}:expires_at`);
                        console.log(`[LIBÉRATION] ${workerId} est de nouveau LIBRE.`);
                    }
                }
            }
        }
    } catch (err) {
        console.error("Erreur dans le background task d'expiration :", err);
    }
}, 15000);

app.listen(4000, () => console.log('Control Plane en écoute sur le port 4000'));