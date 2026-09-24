<template>
  <div style="font-family: system-ui, sans-serif; background-color: #f3f4f6; min-height: 100vh; display: flex; justify-content: center; align-items: center; padding: 2rem;">
    
    <!-- PAGE CONNEXION / INSCRIPTION -->
    <div v-if="pageActuelle === 'auth'" style="background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 400px;">
      <h1 style="font-size: 1.5rem; font-weight: bold; text-align: center; margin-bottom: 1.5rem;">PaaS - Portail Client</h1>
      
      <div style="display: flex; margin-bottom: 1.5rem; border-bottom: 2px solid #e5e7eb;">
        <button @click="modeAuth = 'connexion'" :style="modeAuth === 'connexion' ? ongletActif : ongletInactif">Connexion</button>
        <button @click="modeAuth = 'inscription'" :style="modeAuth === 'inscription' ? ongletActif : ongletInactif">Inscription</button>
      </div>

      <form v-if="modeAuth === 'connexion'" @submit.prevent="seConnecter" style="display: flex; flex-direction: column; gap: 15px;">
        <input v-model="formConnexion.nom" placeholder="Nom d'utilisateur" required style="padding: 10px; border: 1px solid #ccc; border-radius: 4px;" />
        <input v-model="formConnexion.md" type="password" placeholder="Mot de passe" required style="padding: 10px; border: 1px solid #ccc; border-radius: 4px;" />
        <button type="submit" style="padding: 10px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
          Se connecter
        </button>
      </form>

      <form v-if="modeAuth === 'inscription'" @submit.prevent="sinscrire" style="display: flex; flex-direction: column; gap: 15px;">
        <input v-model="formInscription.nom" placeholder="Nom" required style="padding: 10px; border: 1px solid #ccc; border-radius: 4px;" />
        <input v-model="formInscription.prenom" placeholder="Prénom" required style="padding: 10px; border: 1px solid #ccc; border-radius: 4px;" />
        <input v-model="formInscription.md" type="password" placeholder="Mot de passe" required style="padding: 10px; border: 1px solid #ccc; border-radius: 4px;" />
        <button type="submit" style="padding: 10px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
          Créer un compte
        </button>
      </form>
    </div>

    <!-- PAGE D'ACCUEIL (RÉSERVATION) -->
    <div v-if="pageActuelle === 'accueil'" style="width: 100%; max-width: 800px;">
      
      <div style="background: white; padding: 1rem 2rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
        <h2 style="font-size: 1.25rem; font-weight: bold;">Bienvenue, {{ clientConnecte?.prenom || 'Client' }} !</h2>
        <button @click="seDeconnecter" style="padding: 8px 16px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Déconnexion
        </button>
      </div>

      <div style="background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h3 style="font-size: 1.2rem; font-weight: bold; margin-bottom: 1rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem;">
          Nouvel environnement PaaS
        </h3>
        
        <p style="color: #4b5563; margin-bottom: 1.5rem;">
          Configurez votre durée. Un Worker vous sera alloué dynamiquement par le Control Plane.
        </p>

        <form @submit.prevent="reserverMachine" style="display: flex; gap: 15px; align-items: flex-end;">
          <div style="display: flex; flex-direction: column; flex-grow: 1;">
            <label style="font-size: 0.9rem; font-weight: bold; margin-bottom: 5px;">Durée de la session (en minutes) :</label>
            <input v-model="dureeReservation" type="number" min="1" placeholder="Ex: 5" required style="padding: 10px; border: 1px solid #ccc; border-radius: 4px;" />
          </div>
          
          <button type="submit" :disabled="chargement" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; height: 42px;">
            {{ chargement ? 'Allocation en cours...' : 'Réserver l\'environnement' }}
          </button>
        </form>

        <div v-if="machineInfo" style="margin-top: 2rem; padding: 1.5rem; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
          <h4 style="color: #1e3a8a; font-weight: bold; margin-bottom: 10px;">État de votre Environnement PaaS</h4>
          <p><strong>Statut :</strong> <span style="color: #047857;">En cours d'exécution</span></p>
          <p><strong>Worker assigné :</strong> {{ machineInfo.worker }}</p>
          <p><strong>Port attribué :</strong> {{ machineInfo.port }}</p>
          <p><strong>Lien d'accès :</strong> <a :href="machineInfo.app_url" target="_blank" style="color: #2563eb;">{{ machineInfo.app_url }}</a></p>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const pageActuelle = ref('auth')
const modeAuth = ref('connexion')
const chargement = ref(false)

const clientConnecte = ref(null)
const machineInfo = ref(null)
const dureeReservation = ref('')

const formConnexion = ref({ nom: '', md: '' })
const formInscription = ref({ nom: '', prenom: '', md: '' })

const ongletActif = "flex-1 padding: 10px; background: none; border: none; border-bottom: 3px solid #2563eb; color: #2563eb; font-weight: bold; cursor: pointer;"
const ongletInactif = "flex-1 padding: 10px; background: none; border: none; border-bottom: 3px solid transparent; color: #6b7280; cursor: pointer;"

const sinscrire = async () => {
  try {
    const payload = { ...formInscription.value, temps: 0 }
    const res = await fetch('http://localhost:3000/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    if (res.ok) {
      alert("Inscription réussie ! Vous pouvez vous connecter.")
      modeAuth.value = 'connexion'
      formConnexion.value.nom = formInscription.value.nom
      formInscription.value = { nom: '', prenom: '', md: '' }
    } else {
      alert("Erreur lors de l'inscription.")
    }
  } catch (e) {
    console.error("Erreur réseau", e)
  }
}

const seConnecter = async () => {
  try {
    const res = await fetch('http://localhost:3000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formConnexion.value)
    })
    
    const data = await res.json()
    if (res.ok && data.success) {
      clientConnecte.value = data.client
      pageActuelle.value = 'accueil'
    } else {
      alert(data.message || "Identifiants incorrects.")
    }
  } catch (e) {
    console.error("Erreur de connexion", e)
    alert("Impossible de joindre l'API.")
  }
}

const seDeconnecter = () => {
  clientConnecte.value = null
  machineInfo.value = null
  pageActuelle.value = 'auth'
  formConnexion.value = { nom: '', md: '' }
}

const reserverMachine = async () => {
  if (!dureeReservation.value || dureeReservation.value <= 0) return;

  chargement.value = true;
  try {
    const res = await fetch('http://localhost:3000/reserver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duree: parseInt(dureeReservation.value) })
    });

    const data = await res.json();

    if (res.ok) {
      machineInfo.value = data.workerInfo;
    } else {
      alert("Échec de la réservation : " + (data.error || "Erreur inconnue"));
    }
  } catch (e) {
    console.error("Erreur lors de la réservation", e);
    alert("Erreur de communication avec le serveur.");
  } finally {
    chargement.value = false;
  }
}
</script>