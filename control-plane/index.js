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

// Récupère l'OS, les vCPU, la RAM (Mo) et le disque (Go) d'un worker via SSH
async function getWorkerSpecs(ssh) {
    try {
        const cmd = '. /etc/os-release && echo "$PRETTY_NAME"; nproc; free -m | awk \'/Mem:/ {print $2}\'; df -BG --output=size / | tail -1 | tr -dc 0-9';
        const r = await ssh.execCommand(cmd);
        const [os, cpu, ram, disk] = r.stdout.split('\n').map(l => l.trim());
        return { os, cpu: parseInt(cpu), ram_mb: parseInt(ram), disk_gb: parseInt(disk) };
    } catch (e) {
        console.error('[SPECS] Impossible de lire les specs :', e.message);
        return null;
    }
}

// Route d'enregistrement (Heartbeat) des Workers
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

// Route de déploiement / allocation d'un Worker libre
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

        const specs = await getWorkerSpecs(ssh);

        // Lancement d'un conteneur de test sur un port spécifique
        const portAttribue = 8080;
        const cleanHostName = clientNom.replace(/\s+/g, ''); // Suppression des espaces
        await ssh.execCommand(`mkdir -p /vagrant_data/${clientNom}`);
        const result = await ssh.execCommand(`docker run -dit --hostname ${cleanHostName} -p ${portAttribue}:7681 -v /vagrant_data/${clientNom}:/data -w /data tsl0922/ttyd ttyd -W bash`);        if (result.code !== 0) {
            await redisClient.set(`worker:${selectedWorkerId}:status`, 'libre');
            await redisClient.del(`worker:${selectedWorkerId}:expires_at`);
            return res.status(500).json({ error: "Échec du lancement de l'environnement", details: result.stderr });
        }

        res.status(200).json({
            message: "Environnement alloué avec succès !",
            worker: selectedWorkerId,
            app_url: `http://${selectedWorkerIp}:${portAttribue}`,
            port: portAttribue,
            specs,
            expires_at: expiresAt
        });

    } catch (err) {
        console.error("Erreur lors de l'allocation :", err);
        res.status(500).json({ error: err.message });
    }
});

// Tâche de fond : Surveillance des expirations (exécutée toutes les 15 secondes)
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


// Route pour prolonger la durée d'une session en cours
app.post('/api/extend', async (req, res) => {
    const { clientNom, extraMinutes } = req.body;
    const minutesToAdd = parseInt(extraMinutes) || 15; // Par défaut, ajoute 15 min

    try {
        const keys = await redisClient.keys('worker:*');
        let targetWorkerId = null;

        // On cherche quel worker appartient à ce client (ou est actuellement loué)
        // Pour affiner, on pourrais stocker le nom du client dans Redis lors de l'allocation, 
        // mais parcourir les workers "loués" fonctionne si chaque client a une session active.
        for (const key of keys) {
            if (key.split(':').length === 2) {
                const workerId = key.replace('worker:', '');
                const status = await redisClient.get(`worker:${workerId}:status`);

                if (status === 'loué') {
                    // Pour faire simple ici, on étend le worker actif 
                    // (si tu gères du multi-utilisateur simultané, il faudra lier la session au client en BDD ou dans Redis)
                    targetWorkerId = workerId;
                    break;
                }
            }
        }

        if (!targetWorkerId) {
            return res.status(404).json({ error: "Aucune session active trouvée à prolonger." });
        }

        const expiresAtKey = `worker:${targetWorkerId}:expires_at`;
        const currentExpiresAt = parseInt(await redisClient.get(expiresAtKey)) || Date.now();
        
        // On calcule la nouvelle date d'expiration (en ajoutant les minutes demandées au temps restant actuel ou à l'heure actuelle)
        const newExpiresAt = Math.max(Date.now(), currentExpiresAt) + (minutesToAdd * 60 * 1000);

        // Mise à jour dans Redis
        await redisClient.set(expiresAtKey, newExpiresAt);

        console.log(`[EXTENSION] Le bail du worker ${targetWorkerId} a été prolongé de ${minutesToAdd} minutes.`);

        res.status(200).json({
            message: "Session prolongée avec succès !",
            expires_at: newExpiresAt
        });

    } catch (err) {
        console.error("Erreur lors de l'extension du bail :", err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(4000, () => console.log('Control Plane en écoute sur le port 4000'));
