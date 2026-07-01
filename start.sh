#!/bin/bash

# Script de inicialização do Databricks Knowledge Assistant Chatbot

echo "🚀 Iniciando Databricks Knowledge Assistant Chatbot..."
echo ""

# Verificar se o arquivo .env existe
if [ ! -f .env ]; then
    echo "❌ Arquivo .env não encontrado!"
    echo "📝 Por favor, crie um arquivo .env baseado no .env.template"
    echo ""
    echo "Execute:"
    echo "  cp .env.template .env"
    echo "  # Edite o arquivo .env com suas credenciais"
    exit 1
fi

# Ativar o ambiente virtual
echo "🔧 Ativando ambiente virtual..."
source venv/bin/activate

# Iniciar o servidor
echo "✅ Iniciando servidor FastAPI..."
echo ""
python main.py

