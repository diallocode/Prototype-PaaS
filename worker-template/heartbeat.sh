#!/bin/bash

URL_CONTROL_PLANE="http://192.168.56.1:4000/api/heartbeat"
WORKER_ID=$(hostname)

echo "Démarrage du service Heartbeat pour $WORKER_ID..."

while true; do
    # On cherche spécifiquement l'IP du réseau Vagrant, à chaque boucle
    WORKER_IP=$(hostname -I | grep -o '192.168.56.[0-9]*')
    
    # On n'envoie le ping QUE si l'IP a bien été trouvée
    if [ ! -z "$WORKER_IP" ]; then
        curl -s -X POST -H "Content-Type: application/json" -d "{\"worker_id\": \"$WORKER_ID\", \"ip\": \"$WORKER_IP\"}" $URL_CONTROL_PLANE > /dev/null
    fi
    
    sleep 5
done