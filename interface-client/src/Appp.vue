<template>
  <div style="font-family: system-ui, sans-serif; background-color: #f3f4f6; min-height: 100vh; display: flex; justify-content: center; align-items: center; padding: 2rem;">
    
    <!-- ========================================== -->
    <!-- PAGE CONNEXION / INSCRIPTION               -->
    <!-- ========================================== -->
    <div v-if="pageActuelle === 'auth'" style="background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 400px;">
      <h1 style="font-size: 1.5rem; font-weight: bold; text-align: center; margin-bottom: 1.5rem;">PaaS - Portail Client</h1>
      
      <!-- Onglets -->
      <div style="display: flex; margin-bottom: 1.5rem; border-bottom: 2px solid #e5e7eb;">
        <button @click="modeAuth = 'connexion'" :style="modeAuth === 'connexion' ? ongletActif : ongletInactif">Connexion</button>
        <button @click="modeAuth = 'inscription'" :style="modeAuth === 'inscription' ? ongletActif : ongletInactif">Inscription</button>
      </div>

      <!-- Formulaire Connexion -->
      <form v-if="modeAuth === 'connexion'" @submit.prevent="seConnecter" style="display: flex; flex-direction: column; gap: 15px;">
        <input v-model="formConnexion.nom" placeholder="Nom d'utilisateur" required style="padding: 10px; border: 1px solid #ccc; border-radius: 4px;" />
        <input v-model="formConnexion.md" type="password" placeholder="Mot de passe" required style="padding: 10px; border: 1px solid #ccc; border-radius: 4px;" />
        <button type="submit" style="padding: 10px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
          Se connecter
        </button>
      </form>

      <!-- Formulaire Inscription -->
      <form v-if="modeAuth === 'inscription'" @submit.prevent="sinscrire" style="display: flex; flex-direction: column; gap: 15px;">
        <input v-model="formInscription.nom" placeholder="Nom" required style="padding: 10px; border: 1px solid #ccc; border-radius: 4px;" />
        <input v-model="formInscription.prenom" placeholder="Prénom" required style="padding: 10px; border: 1px solid #ccc; border-radius: 4px;" />
        <input v-model="formInscription.md" type="password" placeholder="Mot de passe" required style="padding: 10px; border: 1px solid #ccc; border-radius: 4px;" />
        <!-- Le temps sera demandé lors de la réservation de la machine, plus à l'inscription -->
        <button type="submit" style="padding: 10px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
          Créer un compte
        </button>
      </form>
    </div>

    <!-- ========================================== -->
    <!-- PAGE D'ACCUEIL (RÉSERVATION)               -->
    <!-- ========================================== -->
    <div v-if="pageActuelle === 'accueil'" style="width: 100%; max-width: 800px;">
      
      <!-- Barre de navigation -->
      <div style="background: white; padding: 1rem 2rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
        <h2 style="font-size: 1.25rem; font-weight: bold;">Bienvenue, {{ clientConnecte?.prenom || 'Client' }} !</h2>
        <button @click="seDeconnecter" style="padding: 8px 16px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Déconnexion
        </button>
      </div>

      <!-- Section Réservation -->
      <div style="background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h3 style="font-size: 1.2rem; font-weight: bold; margin-bottom: 1rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem;">
          Nouvelle instance de calcul (Worker)
        </h3>
        
        <p style="color: #4b5563; margin-bottom: 1.5rem;">
          Configurez votre environnement. Un Worker (VM Vagrant ou Conteneur) vous sera alloué dynamiquement par le Control Plane.
        </p>

        <form @submit.prevent="reserverMachine" style="display: flex; gap: 15px; align-items: flex-end;">
          <div style="display: flex; flex-direction: column; flex-grow: 1;">
            <label style="font-size: 0.9rem; font-weight: bold; margin-bottom: 5px;">Durée de la session (en minutes) :</label>
            <input v-model="dureeReservation" type="number" min="1" placeholder="Ex: 60" required style="padding: 10px; border: 1px solid #ccc; border-radius: 4px;" />
          </div>
          
          <button type="submit" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; height: 42px;">
            Réserver la machine
          </button>
        </form>

        <!-- Espace pour afficher l'état de la machine plus tard -->
        <div v-if="machineEnCours" style="margin-top: 2rem; padding: 1.5rem; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
          <h4 style="color: #1e3a8a; font-weight: bold; margin-bottom: 10px;">État de votre Worker</h4>
          <p><strong>Statut :</strong> <span style="color: #047857;">En cours d'exécution</span></p>
          <p><strong>Temps restant :</strong> {{ dureeReservation }} min</p>
          <p><strong>Dossier partagé (Synced Folder) :</strong> En attente de liaison...</p>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// -- ÉTATS DE L'INTERFACE --
const pageActuelle = ref('auth') // 'auth' ou 'accueil'
const modeAuth = ref('connexion') // 'connexion' ou 'inscription'

const clientConnecte = ref(null)
const machineEnCours = ref(false)
const dureeReservation = ref('')

// -- DONNÉES DES FORMULAIRES --
const formConnexion = ref({ nom: '', md: '' })
const formInscription = ref({ nom: '', prenom: '', md: '' })

// -- STYLES DES ONGLETS --
const ongletActif = "flex-1 padding: 10px; background: none; border: none; border-bottom: 3px solid #2563eb; color: #2563eb; font-weight: bold; cursor: pointer;"
const ongletInactif = "flex-1 padding: 10px; background: none; border: none; border-bottom: 3px solid transparent; color: #6b7280; cursor: pointer;"

// ==========================================
// LOGIQUE : INSCRIPTION & CONNEXION
// ==========================================

const sinscrire = async () => {
  try {
    // Note : On met "temps: 0" par défaut à l'inscription, le vrai temps sera défini à la réservation
    const payload = { ...formInscription.value, temps: 0 }
    
    const res = await fetch('http://localhost:3000/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    if (res.ok) {
      alert("Inscription réussie ! Vous pouvez maintenant vous connecter.")
      modeAuth.value = 'connexion'
      formConnexion.value.nom = formInscription.value.nom
      formInscription.value = { nom: '', prenom: '', md: '' }
    }
  } catch (e) {
    console.error("Erreur lors de l'inscription", e)
  }
}

const seConnecter = async () => {
  // [!] TROU DANS LE CODE : Logique d'authentification
  // Pour l'instant on simule une connexion réussie sans vérifier la BDD
  // Plus tard : faire un fetch('http://localhost:3000/login', ...) pour vérifier le 'md'
  
  clientConnecte.value = {
    nom: formConnexion.value.nom,
    prenom: "Utilisateur" // On simule le prénom pour l'instant
  }
  
  pageActuelle.value = 'accueil'
}

const seDeconnecter = () => {
  clientConnecte.value = null
  machineEnCours.value = false
  pageActuelle.value = 'auth'
  formConnexion.value = { nom: '', md: '' }
}

// ==========================================
// LOGIQUE : RÉSERVATION DU WORKER
// ==========================================

const reserverMachine = () => {
  if (!dureeReservation.value || dureeReservation.value <= 0) return;

  // [!] TROU DANS LE CODE : Logique vers le Control Plane
  console.log(`Le client demande un Worker pour ${dureeReservation.value} minutes.`);
  
  /*
  Ici viendra la requête vers votre Control Plane :
  1. Enregistrer le temps demandé dans la BDD sql.
  2. Demander au Control Plane d'allouer une VM/Worker.
  3. Lancer le chronomètre.
  4. Récupérer les infos de connexion (IP, port, chemin du synced folder).
  */

  // On simule que la machine a été allouée pour l'affichage de l'UI
  machineEnCours.value = true;
  
  // (Optionnel) Ici on mettra en place un setInterval pour faire baisser le chronomètre en temps réel
}
</script>