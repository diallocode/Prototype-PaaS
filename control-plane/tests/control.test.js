import test from 'node:test';
import assert from 'node:assert';

// Simulation de la génération de commande SSH pour un worker
function genererCommandeSSH(workerIp, portTtyd) {
    return `ssh -o StrictHostKeyChecking=no root@${workerIp} -p ${portTtyd}`;
}

test('Control Plane - Génération de connexion distante', async (t) => {
    await t.test('devrait générer une commande SSH valide pour un worker', () => {
        const ip = '192.168.56.10';
        const port = 2222;
        const commande = genererCommandeSSH(ip, port);
        
        assert.strictEqual(commande, 'ssh -o StrictHostKeyChecking=no root@192.168.56.10 -p 2222');
    });
});