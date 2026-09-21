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

app.post('/clients', async (req, res) => {
  const { nom, prenom, md, temps } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO Clients (Nom, Prenom, md, temps) VALUES ($1, $2, $3, $4) RETURNING *',
      [nom, prenom, md, temps]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/clients', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM Clients');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('API Web en écoute sur le port 3000'));
