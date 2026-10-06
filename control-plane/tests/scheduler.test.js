import test from 'node:test';
import assert from 'node:assert';

// Simulation du Resource Manager
function selectionnerWorkerLibre(workers) {
    const workerTrouve = workers.find(w => w.status === 'libre');
    return workerTrouve ? workerTrouve.id : null;
}

// Simulation du Scheduler / Gestion des baux
function calculerExpirationBail(dureeMinutes) {
    const maintenant = Date.now();
    return maintenant + (dureeMinutes * 60 * 1000);
}

test('Control Plane - Resource Manager et Scheduler', async (t) => {
    await t.test('devrait attribuer le premier worker libre disponible', () => {
        const poolWorkers = [
            { id: 'worker_1', status: 'loue' },
            { id: 'worker_2', status: 'libre' },
            { id: 'worker_3', status: 'libre' }
        ];
        const workerAttribue = selectionnerWorkerLibre(poolWorkers);
        assert.strictEqual(workerAttribue, 'worker_2');
    });

    await t.test('ne devrait retourner aucun worker si le pool est sature', () => {
        const poolWorkers = [
            { id: 'worker_1', status: 'loue' },
            { id: 'worker_2', status: 'loue' }
        ];
        const workerAttribue = selectionnerWorkerLibre(poolWorkers);
        assert.strictEqual(workerAttribue, null);
    });

    await t.test('devrait calculer correctement l expiration d un bail en timestamp', () => {
        const dureeMinutes = 15;
        const expirationCalculee = calculerExpirationBail(dureeMinutes);
        const attenduMin = Date.now() + (15 * 60 * 1000) - 500; // Marge de tolérance

        assert.strictEqual(typeof expirationCalculee, 'number');
        assert.ok(expirationCalculee >= attenduMin);
    });
});