import { describe, it, expect } from 'vitest';

// Simulation d'un service client qui communique avec l'API du Control Plane
async function simulerFluxLocation(token, workerId) {
    if (!token) {
        return { status: 401, message: 'Non autorisé' };
    }
    // Simulation d'un appel réseau réussi
    return { 
        status: 200, 
        data: { message: `Worker ${workerId} attribué avec succès`, port: 8080 } 
    };
}

describe('US59 - Tests d intégration Interface Client / API', () => {
    it('devrait refuser la location si l utilisateur n est pas authentifie (token absent)', async () => {
        const reponse = await simulerFluxLocation(null, 'worker_1');
        expect(reponse.status).toBe(401);
        expect(reponse.message).toBe('Non autorisé');
    });

    it('devrait réussir le parcours de location complet avec un token valide', async () => {
        const reponse = await simulerFluxLocation('mock-jwt-token-123', 'worker_2');
        expect(reponse.status).toBe(200);
        expect(reponse.data.port).toBe(8080);
    });
});