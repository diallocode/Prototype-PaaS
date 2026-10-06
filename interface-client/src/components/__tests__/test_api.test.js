import { describe, it, expect } from 'vitest';

// Simulation d'une fonction de formatage ou d'état des workers dans l'interface
function formaterStatutWorker(status) {
    switch (status) {
        case 'libre': return 'Disponible';
        case 'loue': return 'En cours d utilisation';
        default: return 'Inconnu';
    }
}

describe('Interface Client - Formatage et Affichage', () => {
    it('devrait retourner le libelle correct pour un worker libre', () => {
        const resultat = formaterStatutWorker('libre');
        expect(resultat).toBe('Disponible');
    });

    it('devrait retourner le libelle correct pour un worker loue', () => {
        const resultat = formaterStatutWorker('loue');
        expect(resultat).toBe('En cours d utilisation');
    });

    it('devrait gérer les statuts inconnus', () => {
        const resultat = formaterStatutWorker('maintenance');
        expect(resultat).toBe('Inconnu');
    });
});