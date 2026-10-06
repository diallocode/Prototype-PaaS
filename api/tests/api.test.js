import test from 'node:test';
import assert from 'node:assert';

// Simulation des fonctions de l'API
function validerInscription(body) {
    if (!body.nom || !body.prenom || !body.mdp) {
        return { success: false, message: 'Champs manquants' };
    }
    if (body.mdp.length < 6) {
        return { success: false, message: 'Mot de passe trop court' };
    }
    return { success: true, message: 'Inscription valide' };
}

test('API - Validation des entrées utilisateur', async (t) => {
    await t.test('devrait accepter un utilisateur avec tous les champs conformes', () => {
        const resultat = validerInscription({ nom: 'Diallo', prenom: 'Mamadou', mdp: 'Securise123' });
        assert.strictEqual(resultat.success, true);
    });

    await t.test('devrait refuser l inscription si un champ est manquant', () => {
        const resultat = validerInscription({ nom: 'Diallo', mdp: 'Securise123' });
        assert.strictEqual(resultat.success, false);
        assert.strictEqual(resultat.message, 'Champs manquants');
    });

    await t.test('devrait refuser un mot de passe de moins de 6 caractères', () => {
        const resultat = validerInscription({ nom: 'Diallo', prenom: 'Mamadou', mdp: '123' });
        assert.strictEqual(resultat.success, false);
        assert.strictEqual(resultat.message, 'Mot de passe trop court');
    });
});