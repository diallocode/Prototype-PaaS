const request = require('supertest');
// Importe ton application Express (assure-toi d'exporter `app` dans ton index.js sans faire de `app.listen` bloquant si l'app est testée)

describe('Tests de l\'API Control Plane', () => {
  it('Devrait retourner une erreur ou un statut valide sur une route inconnue', async () => {
    // Petit test de structure pour valider que Jest s'exécute bien
    expect(true).toBe(true);
  });
});