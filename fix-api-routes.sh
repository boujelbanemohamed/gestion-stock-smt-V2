#!/bin/bash

# Script pour ajouter les exports manquants à TOUTES les routes API

echo "🔧 Ajout des exports dynamic et runtime à toutes les routes API..."

find app/api -type f -name "route.ts" | while read file; do
  # Vérifier si le fichier a déjà les exports
  if grep -q "export const dynamic" "$file"; then
    echo "✓ $file (déjà configuré)"
  else
    echo "📝 Modification de $file..."
    
    # Créer un fichier temporaire avec les exports au début
    {
      echo "export const dynamic = 'force-dynamic'"
      echo "export const runtime = 'nodejs'"
      echo ""
      cat "$file"
    } > "${file}.tmp"
    
    # Remplacer le fichier original
    mv "${file}.tmp" "$file"
    
    echo "  ✅ Exports ajoutés"
  fi
done

echo ""
echo "✨ Terminé ! Vérification..."
echo ""

# Vérification
find app/api -type f -name "route.ts" | while read file; do
  if grep -q "export const dynamic" "$file" && grep -q "export const runtime" "$file"; then
    echo "✅ $file"
  else
    echo "❌ $file (ERREUR)"
  fi
done
