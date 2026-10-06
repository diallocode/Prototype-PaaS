import { describe, it, expect } from 'vitest';

// Simulation d'une fonction de validation ou de formatage front-end (ex: validation de l'email ou du nom)
function validerFormulaireClient(nom, duree) {
    if (!nom || nom.trim() === '') {
        return { valide: false, erreur: 'Le nom est obligatoire' };
    }
    if (duree <= 0 || isNaN(duree)) {
        return { valide: false, erreur: 'La durée doit être supérieure à 0' };
    }
    return { valide: true, erreur: null };
}

describe('Interface Client - Validation du formulaire de location', () => {
    it('devrait valider un formulaire correct', () => {
        const resultat = validerFormulaireClient('Diallo', 30);
        expect(resultat.valide).toBe(true);
        expect(resultat.erreur).toBeNull();
    });

    it('devrait rejeter un formulaire avec un nom vide', () => {
        const resultat = validerFormulaireClient('', 30);
        expect(resultat.valide).toBe(false);
        expect(resultat.erreur).toBe('Le nom est obligatoire');
    });

    it('devrait rejeter un formulaire avec une durée invalide', () => {
        const resultat = validerFormulaireClient('Diallo', -5);
        expect(resultat.valide).toBe(false);
        expect(resultat.erreur).toBe('La durée doit être supérieure à 0');
    });
});