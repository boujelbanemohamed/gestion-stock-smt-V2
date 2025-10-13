#!/bin/bash

echo "🚀 Push des modifications sur GitHub..."

git add deploy.sh
git add components/dashboard/movements-management.tsx
git add SOLUTION-DEPLOY-REDHAT.md
git add FIX-PRODUCTION-WEBSOCKET.md

git commit -m "fix: Deploy script amélioré + corrections mouvements (nom user + banque destination)"

git push origin main

echo "✅ Modifications poussées sur GitHub !"




