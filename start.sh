#!/bin/bash

echo "🚀 Hotmail Email Sorter - Démarrage rapide"
echo "=========================================="
echo ""

# Vérification de la configuration
if [ ! -f ".env" ]; then
    echo "❌ Fichier .env manquant"
    echo "📝 Copiez .env.example vers .env et configurez-le :"
    echo "   cp .env.example .env"
    echo "   nano .env"
    echo ""
    echo "📖 Consultez README.md pour les instructions complètes"
    exit 1
fi

# Vérification d'Ollama
echo "🔍 Vérification d'Ollama..."
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "❌ Ollama n'est pas accessible"
    echo "🔧 Démarrez Ollama avec : ollama serve"
    echo "📦 Installez un modèle avec : ollama pull mistral:7b-instruct"
    exit 1
else
    echo "✅ Ollama répond"
fi

# Vérification des dépendances
echo "📦 Vérification des dépendances..."
if [ ! -d "node_modules" ]; then
    echo "🔄 Installation des dépendances..."
    npm install
fi

echo ""
echo "🎯 Configuration détectée dans .env :"
grep -E "^(MICROSOFT_CLIENT_ID|MODEL|DRY_RUN)=" .env 2>/dev/null || echo "⚠️  Variables principales manquantes"

echo ""
echo "🎮 Commandes disponibles :"
echo "   npm run dry    # Mode test (recommandé)"
echo "   npm start      # Mode production"
echo ""
echo "📖 Consultez README.md pour la configuration complète"

if [[ "$1" == "--run" ]]; then
    echo ""
    echo "🚀 Lancement en mode test..."
    npm run dry
fi
