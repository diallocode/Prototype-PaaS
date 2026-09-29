const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

const pool = new Pool({
  user: 'admin',
  host: 'db',
  database: 'paas_db',
  password: 'password123',
  port: 5432,
});

// Inscription d'un client
app.post('/clients', async (req, res) => {
  const { nom, prenom, md, temps } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO Clients (Nom, Prenom, md, temps) VALUES ($1, $2, $3, $4) RETURNING *',
      [nom, prenom, md, temps]
    );
    const nouveauClient = result.rows[0];

    // On renvoie uniquement le client créé
    res.json({
        client: nouveauClient
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Connexion d'un client
app.post('/login', async (req, res) => {
  const { nom, md } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM Clients WHERE Nom = $1 AND md = $2',
      [nom, md]
    );
    if (result.rows.length > 0) {
      res.json({ success: true, client: result.rows[0] });
    } else {
      res.status(401).json({ success: false, message: "Nom d'utilisateur ou mot de passe incorrect" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Demande de réservation (transmise au Control Plane)
app.post('/reserver', async (req, res) => {
  // On récupère la durée ET le nom du client envoyé par le front-end
  const { duree, clientNom } = req.body;
  
  try {
    const response = await fetch('http://control-plane:4000/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // On transfère les deux variables au Control Plane
      body: JSON.stringify({ duree, clientNom })
    });

    const data = await response.json();
    
    if (response.ok) {
      res.json({ message: "Machine allouée avec succès !", workerInfo: data });
    } else {
      res.status(503).json({ error: data.error || "Le Control Plane n'a pas pu allouer de machine" });
    }
  } catch (err) {
    res.status(500).json({ error: "Erreur de communication avec le Control Plane : " + err.message });
  }
});

// Demande de prolongation de session
app.post('/prolonger', async (req, res) => {
  const { clientNom, extraMinutes } = req.body;
  
  try {
    const response = await fetch('http://control-plane:4000/api/extend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientNom, extraMinutes })
    });

    const data = await response.json();
    
    if (response.ok) {
      res.json({ message: "Session prolongée !", data });
    } else {
      res.status(500).json({ error: data.error || "Impossible de prolonger la session" });
    }
  } catch (err) {
    res.status(500).json({ error: "Erreur de communication avec le Control Plane : " + err.message });
  }
});

app.listen(3000, () => console.log('API Web en écoute sur le port 3000'));