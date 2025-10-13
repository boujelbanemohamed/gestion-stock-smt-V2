#!/bin/bash

# Script pour ajouter la configuration dynamic à toutes les routes API

echo "Ajout de la configuration dynamic aux routes API..."

# Liste des fichiers route.ts dans /app/api
find app/api -name "route.ts" | while read file; do
    # Vérifier si le fichier contient déjà "export const dynamic"
    if ! grep -q "export const dynamic" "$file"; then
        echo "Mise à jour de $file"
        
        # Créer un fichier temporaire
        temp_file="${file}.tmp"
        
        # Trouver la première ligne qui commence par "export"
        first_export_line=$(grep -n "^export" "$file" | head -1 | cut -d: -f1)
        
        if [ -n "$first_export_line" ]; then
            # Insérer avant la première export
            head -n $((first_export_line - 1)) "$file" > "$temp_file"
            echo "" >> "$temp_file"
            echo "// Forcer la route à être dynamique (ne pas pré-rendre)" >> "$temp_file"
            echo "export const dynamic = 'force-dynamic'" >> "$temp_file"
            echo "export const runtime = 'nodejs'" >> "$temp_file"
            echo "" >> "$temp_file"
            tail -n +$first_export_line "$file" >> "$temp_file"
            
            # Remplacer le fichier original
            mv "$temp_file" "$file"
            echo "✓ $file mis à jour"
        else
            echo "✗ Impossible de trouver une ligne export dans $file"
        fi
    else
        echo "✓ $file déjà configuré"
    fi
done

echo "Terminé!"
