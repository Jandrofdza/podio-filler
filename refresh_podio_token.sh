#!/bin/bash
set -e

# Request new access token
NEW_TOKEN=$(curl -sS -X POST "https://api.podio.com/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET&username=$PODIO_USER&password=$PODIO_PASS" \
  | jq -r .access_token)

if [ "$NEW_TOKEN" == "null" ] || [ -z "$NEW_TOKEN" ]; then
  echo "❌ Failed to get Podio token"
  exit 1
fi

echo "✅ Got new token: $NEW_TOKEN"

# Push to Render
render env:set PODIO_TOKEN=$NEW_TOKEN --service $RENDER_SERVICE -y

