<template>
  <div style="padding: 2rem; font-family: system-ui, sans-serif;">
    <h1 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">Prototype PaaS - Inscription Client (teste connexion BD)</h1>
    
    <!-- Formulaire -->
    <form @submit.prevent="ajouterClient" style="display: flex; flex-direction: column; gap: 10px; max-width: 300px; margin-bottom: 2rem;">
      <input v-model="form.nom" placeholder="Nom" required style="padding: 8px;" />
      <input v-model="form.prenom" placeholder="Prénom" required style="padding: 8px;" />
      <input v-model="form.md" type="password" placeholder="Mot de passe" required style="padding: 8px;" />
      <input v-model="form.temps" type="number" placeholder="Temps de location (min)" required style="padding: 8px;" />
      
      <button type="submit" style="padding: 10px; background: #2563eb; color: white; border: none; cursor: pointer;">
        Inscrire le client
      </button>
    </form>

    <!-- Liste des clients pour vérifier la base de données -->
    <h2 style="font-size: 1.25rem; font-weight: bold; margin-bottom: 1rem;">Clients enregistrés (Base de données)</h2>
    <ul style="list-style: none; padding: 0;">
      <li v-for="client in clients" :key="client.id" style="background: #f3f4f6; margin-bottom: 5px; padding: 10px;">
        <strong>{{ client.nom }} {{ client.prenom }}</strong> - Temps alloué : {{ client.temps }} minutes
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const clients = ref([])
const form = ref({ nom: '', prenom: '', md: '', temps: '' })

// Fonction pour récupérer les clients depuis l'API Docker
const fetchClients = async () => {
  try {
    const res = await fetch('http://localhost:3000/clients')
    clients.value = await res.json()
  } catch (e) {
    console.error("Erreur de connexion à l'API")
  }
}

// Fonction pour envoyer un nouveau client
const ajouterClient = async () => {
  try {
    await fetch('http://localhost:3000/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value)
    })
    form.value = { nom: '', prenom: '', md: '', temps: '' } // Réinitialise le formulaire
    fetchClients() // Met à jour la liste
  } catch (e) {
    console.error("Erreur lors de l'ajout")
  }
}

// Charge les clients au démarrage
onMounted(fetchClients)
</script>