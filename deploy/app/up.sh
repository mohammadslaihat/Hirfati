#!/usr/bin/env bash
# Hirfati - pulls the latest image, starts the app on EC2 A and runs 3 quick checks.
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { echo "ERROR: .env is missing"; exit 1; }
# Remove a UTF-8 BOM or Windows line endings if the .env was written from PowerShell
sed -i '1s/^\xEF\xBB\xBF//; s/\r$//; /^$/d' .env
chmod 600 .env

docker compose pull
docker compose up -d
echo "Waiting for the app to become healthy..."
s=starting
for i in $(seq 1 30); do
  s=$(docker inspect -f '{{.State.Health.Status}}' hirfati-web 2>/dev/null || echo starting)
  [ "$s" = healthy ] && break
  sleep 3
done
echo "App status: $s"

echo "----- RESULT -----"
docker compose ps
echo "1) Home page:"
curl -s -o /dev/null -w "   HTTP %{http_code}\n" http://localhost:5000/
echo "2) /api/services (reads from MySQL on EC2 B):"
curl -s -w "\n   HTTP %{http_code}\n" http://localhost:5000/api/services | cut -c1-160
echo "3) Admin login with the demo account:"
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"email":"admin@hirfati.jo","password":"123456"}' \
  -w "\n   HTTP %{http_code}\n" http://localhost:5000/api/login
echo "Last app log lines:"
docker compose logs --tail 5 web
