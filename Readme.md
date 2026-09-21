# Projet PaaS (Plateforme en tant que Service)

Bienvenue sur le dépôt du projet PaaS. Cette architecture distribuée permet de déployer et d'administrer des applications de manière automatisée à travers un essaim de machines virtuelles autonomes.

---

## Architecture du Projet

Le projet est divisé en trois zones distinctes :
* **Zone 1 (Interface & API) :** Application web et API de gestion (Node.js, PostgreSQL).
* **Zone 2 (Control Plane & Redis) :** Le "cerveau" de la plateforme. Un serveur Node.js orchestré avec Redis pour le suivi en temps réel (*Heartbeat*) et l'ordonnancement (*Scheduler*) des déploiements via SSH.
* **Zone 3 (Workers) :** Des machines virtuelles Debian 12 provisionnées via Vagrant et Ansible, capables de s'enregistrer automatiquement et d'exécuter des conteneurs.

---

## 📋 Prérequis

Avant de commencer, assure-toi d'avoir installé sur ta machine :
* [Docker](https://docs.docker.com/get-docker/) et Docker Compose
* [Vagrant](https://www.vagrantup.com/)
* [VirtualBox](https://www.virtualbox.org/) (ou un provider compatible pour Vagrant)

---

## ⚙️ Guide d'Installation et de Lancement

### Étape 1 : Cloner le projet et lancer le Cerveau (Zone 1 & 2)

Ouvre un terminal à la racine du projet (là où se trouve le `docker-compose.yml`) et lance les services conteneurisés :

```bash
docker compose up --build -d
```

### Étape 2 : Allumer les workers

Ouvre un terminal dans le dossier worker-template (là où se trouve le `vagrantfile et playbook.ym`) et lance le vagrant et ansible :

```bash
vagrant up
vagrant provision
```

### Etape 3 : Tests

Envoi une requete simule a l'API du controle plane pour lancer un conteneur Nginx a distance sur un worker.

Ouvre un terminal et lance la commande ci-dessous.

```bash
curl -X POST http://localhost:4000/api/deploy
```

Un message de succes avec un lien dans un json est fourni avec l'IP du worker choisi. Entre ce lien sur le navigateur.


## Arret de l'Environnement :

Pour arreter le controle plane et les bases de donnees :
```bash
docker compose down
```

Pour eteindre les machines virtuelles vagrant.
```bash
vagrant halt
```