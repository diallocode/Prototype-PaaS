#!/bin/bash

# Plus tard, on remplaceras ça par l'IP du Control Plane
# URL_CONTROL_PLANE="http://192.168.X.X:3000/api/heartbeat"

WORKER_ID=$(hostname)
# Récupère l'IP réseau de la machine virtuelle
WORKER_IP=$(hostname -I | awk '{print $2}') 

echo "Démarrage du service Heartbeat pour $WORKER_ID ($WORKER_IP)..."

while true; do
    echo "[$(date)] - Le worker $WORKER_ID ($WORKER_IP) est en ligne et prêt."
    
    # ligne qui servira a prévenir le Control Plane :
    # curl -X POST -H "Content-Type: application/json" -d "{\"worker_id\": \"$WORKER_ID\", \"ip\": \"$WORKER_IP\"}" $URL_CONTROL_PLANE
    
    sleep 5
done