const express = require('express');
const { createClient } = require('redis');
const { NodeSSH } = require('node-ssh');

const app = express();
app.use(express.json());

const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
redisClient.on('error', (err) => console.error('Erreur Redis :', err));

const ALIVE_TTL = 20;          // un worker est "mort" s'il n'a pas envoyé de heartbeat depuis 20 s
const APP_PORT = 8080;         // port exposé sur le worker
const NAME_RE = /^[A-Za-z0-9_-]{1,32}$/;

// ---------- Utilitaires ----------

// Nettoie et valide le nom client (empêche l'injection de commande et le path traversal)
function cleanName(raw) {
    const n = String(raw || '').replace(/\s+/g, '');
    return NAME_RE.test(n) ? n : null;
}

async function sshTo(ip) {
    const ssh = new NodeSSH();
    await ssh.connect({ host: ip, username: 'vagrant', password: 'vagrant', readyTimeout: 8000 });
    return ssh;
}

async function listWorkers() {
    const keys = await redisClient.keys('worker:*');
    return keys.filter(k => k.split(':').length === 2).map(k => k.slice('worker:'.length));
}

async function isAlive(workerId) {
    return (await redisClient.exists(`worker:${workerId}:alive`)) === 1;
}

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

async function releaseWorker(workerId, status = 'libre') {
    await redisClient.set(`worker:${workerId}:status`, status);
    await redisClient.del(`worker:${workerId}:expires_at`);
    await redisClient.del(`worker:${workerId}:claim`);
}

// ---------- Sessions (client -> worker) ----------

async function getSession(name) {
    const raw = await redisClient.get(`session:${name}`);
    return raw ? JSON.parse(raw) : null;
}
async function saveSession(s) {
    await redisClient.set(`session:${s.clientNom}`, JSON.stringify(s));
}

/**
 * Trouve un worker libre ET vivant, lance le conteneur du client dessus.
 * Les données sont dans /vagrant_data/<client> (dossier synchronisé de l'hôte),
 * donc elles sont retrouvées telles quelles sur n'importe quel worker.
 */
async function allocate(name, expiresAt) {
    for (const workerId of await listWorkers()) {
        if ((await redisClient.get(`worker:${workerId}:status`)) !== 'libre') continue;
        if (!(await isAlive(workerId))) continue;

        // Réservation atomique : évite que 2 clients prennent le même worker
        const claimed = await redisClient.set(`worker:${workerId}:claim`, name, { NX: true });
        if (!claimed) continue;

        const ip = await redisClient.get(`worker:${workerId}`);
        try {
            const ssh = await sshTo(ip);
            await ssh.execCommand(`mkdir -p /vagrant_data/${name}`);
            const r = await ssh.execCommand(
                `docker rm -f session-${name} 2>/dev/null; ` +
                `docker run -dit --name session-${name} --hostname ${name} ` +
                `-p ${APP_PORT}:7681 -v /vagrant_data/${name}:/data -w /data tsl0922/ttyd ttyd -W bash`
            );
            if (r.code !== 0) throw new Error(r.stderr);

            const specs = await getWorkerSpecs(ssh);
            ssh.dispose();

            await redisClient.set(`worker:${workerId}:status`, 'loué');
            await redisClient.set(`worker:${workerId}:expires_at`, expiresAt);

            const session = {
                clientNom: name, worker: workerId, ip, port: APP_PORT,
                app_url: `http://${ip}:${APP_PORT}`,
                specs, expires_at: expiresAt, state: 'active'
            };
            await saveSession(session);
            return session;
        } catch (e) {
            console.error(`[ALLOCATION] Échec sur ${workerId} :`, e.message);
            await redisClient.del(`worker:${workerId}:claim`);   // on essaie le worker suivant
        }
    }
    return null;
}

// ---------- Routes ----------

app.post('/api/heartbeat', async (req, res) => {
    const { workerId, ip } = req.body;
    if (!workerId || !ip) return res.status(400).json({ error: 'workerId et ip requis' });

    await redisClient.set(`worker:${workerId}`, ip);
    await redisClient.set(`worker:${workerId}:alive`, '1', { EX: ALIVE_TTL });   // preuve de vie

    if (!(await redisClient.get(`worker:${workerId}:status`))) {
        await redisClient.set(`worker:${workerId}:status`, 'libre');
    }
    res.status(200).json({ message: 'Heartbeat reçu' });
});

app.post('/api/deploy', async (req, res) => {
    try {
        const name = cleanName(req.body.clientNom || 'client_defaut');
        if (!name) return res.status(400).json({ error: 'clientNom invalide (lettres, chiffres, - et _ uniquement)' });

        const duree = Math.min(Math.max(parseInt(req.body.duree) || 10, 1), 240);

        // Le client a déjà une session : on la renvoie au lieu d'en louer une deuxième
        const existing = await getSession(name);
        if (existing && existing.state === 'active') {
            return res.status(200).json({ message: 'Session déjà active', worker: existing.worker, ...existing });
        }
        if (existing && existing.state === 'pending') {
            return res.status(202).json({ message: 'Session en cours de migration', ...existing });
        }

        const session = await allocate(name, Date.now() + duree * 60 * 1000);
        if (!session) return res.status(503).json({ error: 'Aucun worker disponible. Tous sont occupés.' });

        console.log(`[ALLOCATION] ${session.worker} -> ${name} pour ${duree} min`);
        res.status(200).json({ message: 'Environnement alloué avec succès !', ...session });
    } catch (err) {
        console.error("Erreur lors de l'allocation :", err);
        res.status(500).json({ error: 'Erreur interne' });
    }
});

// Le front interroge cette route pour connaître l'URL actuelle (elle change après une bascule)
app.get('/api/session/:clientNom', async (req, res) => {
    const name = cleanName(req.params.clientNom);
    const s = name && await getSession(name);
    if (!s) return res.status(404).json({ error: 'Aucune session' });
    res.json(s);
});

app.post('/api/extend', async (req, res) => {
    try {
        const name = cleanName(req.body.clientNom);
        if (!name) return res.status(400).json({ error: 'clientNom invalide' });
        const minutes = Math.min(Math.max(parseInt(req.body.extraMinutes) || 15, 1), 120);

        const s = await getSession(name);
        if (!s) return res.status(404).json({ error: 'Aucune session active trouvée à prolonger.' });

        s.expires_at = Math.max(Date.now(), s.expires_at) + minutes * 60 * 1000;
        await saveSession(s);
        if (s.state === 'active') await redisClient.set(`worker:${s.worker}:expires_at`, s.expires_at);

        console.log(`[EXTENSION] ${name} prolongé de ${minutes} min`);
        res.status(200).json({ message: 'Session prolongée avec succès !', expires_at: s.expires_at });
    } catch (err) {
        console.error("Erreur lors de l'extension :", err);
        res.status(500).json({ error: 'Erreur interne' });
    }
});

// ---------- Surveillance : expiration + FAILOVER (toutes les 5 s) ----------

let monitoring = false;
async function monitor() {
    if (monitoring) return;
    monitoring = true;
    try {
        const now = Date.now();

        // 1) Sessions : expiration, panne, migration en attente
        for (const key of await redisClient.keys('session:*')) {
            const s = JSON.parse(await redisClient.get(key));
            if (!s) continue;

            if (now > s.expires_at) {
                console.log(`[EXPIRATION] ${s.clientNom} sur ${s.worker}`);
                if (s.state === 'active' && (await isAlive(s.worker))) {
                    try {
                        const ssh = await sshTo(s.ip);
                        await ssh.execCommand(`docker rm -f session-${s.clientNom}`);
                        ssh.dispose();
                    } catch (e) { console.error('[SSH] Nettoyage impossible :', e.message); }
                }
                if (s.state === 'active') {
                    const st = (await isAlive(s.worker)) ? 'libre' : 'down';
                    await releaseWorker(s.worker, st);
                }
                await redisClient.del(key);
                continue;
            }

            const workerDown = s.state === 'active' && !(await isAlive(s.worker));
            if (workerDown || s.state === 'pending') {
                if (workerDown) {
                    console.warn(`[FAILOVER] ${s.worker} ne répond plus, migration de ${s.clientNom}...`);
                    await releaseWorker(s.worker, 'down');
                }
                // Les fichiers sont dans /vagrant_data/<client> : rien n'est perdu.
                // Le temps restant est conservé (expires_at inchangé).
                const moved = await allocate(s.clientNom, s.expires_at);
                if (moved) {
                    console.log(`[FAILOVER] ${s.clientNom} : ${s.worker} -> ${moved.worker}`);
                } else {
                    s.state = 'pending';       // aucun worker libre : on réessaiera au prochain tour
                    await saveSession(s);
                }
            }
        }

        // 2) Workers marqués "down" qui reviennent : on nettoie puis on les remet en service
        for (const workerId of await listWorkers()) {
            if ((await redisClient.get(`worker:${workerId}:status`)) === 'down' && (await isAlive(workerId))) {
                try {
                    const ssh = await sshTo(await redisClient.get(`worker:${workerId}`));
                    await ssh.execCommand('docker ps -aq | xargs -r docker rm -f');
                    ssh.dispose();
                    await releaseWorker(workerId, 'libre');
                    console.log(`[RETOUR] ${workerId} est de nouveau LIBRE.`);
                } catch (e) { console.error(`[RETOUR] ${workerId} pas encore prêt :`, e.message); }
            }
        }
    } catch (err) {
        console.error('Erreur dans la tâche de surveillance :', err);
    } finally {
        monitoring = false;
    }
}

(async () => {
    await redisClient.connect();
    console.log('Connecté à Redis (Control Plane)');
    setInterval(monitor, 5000);
    app.listen(4000, () => console.log('Control Plane en écoute sur le port 4000'));
})();