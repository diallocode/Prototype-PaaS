const express = require('express');
const { createClient } = require('redis');
const { NodeSSH } = require('node-ssh');

const app = express();
app.use(express.json());
const ssh = new NodeSSH();

// 1. Initialisation de la connexion à Redis (Dynamique pour Docker)
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = createClient({ url: redisUrl });
redisClient.on('error', err => console.log('Erreur Redis', err));
redisClient.connect().then(() => console.log('Connecté à Redis !'));

// 2. La route Heartbeat
app.post('/api/heartbeat', async (req, res) => {
    const { worker_id, ip } = req.body;
    
    // On sauvegarde le Worker dans Redis avec un TTL de 15 secondes
    await redisClient.set(`worker:${worker_id}`, ip, {
        EX: 15
    });
    
    console.log(`[RADAR] ${worker_id} (${ip}) enregistré. Expire dans 15s sans nouvelles.`);
    res.status(200).send({ message: "OK" });
});

// 3. La route pour lister les Workers disponibles (Le Scheduler)
app.get('/api/workers', async (req, res) => {
    try {
        const keys = await redisClient.keys('worker:*');
        const workers = [];

        for (const key of keys) {
            const ip = await redisClient.get(key);
            const workerId = key.replace('worker:', '');
            workers.push({ id: workerId, ip: ip });
        }

        res.status(200).json({ 
            count: workers.length, 
            active_workers: workers 
        });
        
    } catch (error) {
        console.error("Erreur Redis:", error);
        res.status(500).json({ error: "Erreur lors de la récupération des workers" });
    }
});

// 4. L'Ordonnanceur (Scheduler) + L'Exécuteur (Déploiement SSH)
app.post('/api/deploy', async (req, res) => {
    try {
        // SCHEDULER : Trouver un worker disponible
        const keys = await redisClient.keys('worker:*');
        if (keys.length === 0) {
            return res.status(503).json({ error: "Aucun worker disponible pour le déploiement" });
        }

       // On prend simplement le premier worker de la liste
        const firstWorkerKey = keys[0]; // ex: "worker:worker-1"
        const workerIp = await redisClient.get(firstWorkerKey); // Récupère la vraie IP
        const workerId = firstWorkerKey.replace('worker:', '');
        
        console.log(`[SCHEDULER] Déploiement assigné à ${workerId} (${workerIp})`);

        // EXÉCUTEUR : Connexion SSH au Worker
        await ssh.connect({
            host: workerIp,
            username: 'vagrant',
            password: 'vagrant' // Mot de passe par défaut des box Vagrant
        });

        // DÉPLOIEMENT : Ordre de lancer un serveur Nginx
        console.log(`[SSH] Lancement de Nginx sur ${workerId}...`);
        const result = await ssh.execCommand('docker run -d -p 8080:80 nginx');

        res.status(200).json({ 
            message: "Déploiement réussi !",
            worker: workerId,
            app_url: `http://${workerIp}:8080`,
            docker_id: result.stdout
        });

    } catch (error) {
        console.error("Erreur de déploiement:", error);
        res.status(500).json({ error: "Échec du déploiement" });
    }
});

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`Control Plane démarré sur le port ${PORT}`);
});