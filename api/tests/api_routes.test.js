import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import express from 'express';

// --- Configuration d'une application Express minimale pour l'exemple ---
const app = express();
app.use(express.json());

// Simulation de tes routes d'API
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP' });
});

app.post('/register', (req, res) => {
    const { nom, prenom, mdp } = req.body;
    if (!nom || !prenom || !mdp) {
        return res.status(400).json({ error: 'Champs manquants' });
    }
    res.status(201).json({ message: 'Utilisateur créé avec succès' });
});

app.post('/login', (req, res) => {
    const { nom, mdp } = req.body;
    if (nom === 'Diallo' && mdp === 'Securise123') {
        return res.status(200).json({ token: 'mock-jwt-token' });
    }
    res.status(401).json({ error: 'Identifiants invalides' });
});

app.get('/instances', (req, res) => {
    res.status(200).json({ instances: [] });
});

app.post('/rent', (req, res) => {
    const { workerId } = req.body;
    if (!workerId) {
        return res.status(400).json({ error: 'Worker ID requis' });
    }
    res.status(200).json({ message: 'Worker loué avec succès', port: 8080 });
});

// --- Jeux de tests d'API (US58) ---

test('US58 - Tests API : Route de santé /health', async (t) => {
    const response = await request(app).get('/health');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.status, 'UP');
});

test('US58 - Tests API : Route d inscription /register', async (t) => {
    await t.test('devrait réussir avec des données valides', async () => {
        const response = await request(app)
            .post('/register')
            .send({ nom: 'Diallo', prenom: 'Mamadou', mdp: 'Securise123' });
        
        assert.strictEqual(response.status, 201);
        assert.strictEqual(response.body.message, 'Utilisateur créé avec succès');
    });

    await t.test('devrait échouer si un champ est manquant', async () => {
        const response = await request(app)
            .post('/register')
            .send({ nom: 'Diallo' }); // Manque prenom et mdp
        
        assert.strictEqual(response.status, 400);
        assert.strictEqual(response.body.error, 'Champs manquants');
    });
});

test('US58 - Tests API : Route de connexion /login', async (t) => {
    const response = await request(app)
        .post('/login')
        .send({ nom: 'Diallo', mdp: 'Securise123' });
    
    assert.strictEqual(response.status, 200);
    assert.ok(response.body.token);
});

test('US58 - Tests API : Gestion des instances et locations (/instances et /rent)', async (t) => {
    await t.test('GET /instances devrait retourner la liste', async () => {
        const response = await request(app).get('/instances');
        assert.strictEqual(response.status, 200);
        assert.ok(Array.isArray(response.body.instances));
    });

    await t.test('POST /rent devrait allouer un worker', async () => {
        const response = await request(app)
            .post('/rent')
            .send({ workerId: 'worker_1' });
        
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.body.port, 8080);
    });
});