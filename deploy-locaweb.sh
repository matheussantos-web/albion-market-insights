#!/bin/bash

# ============================================
# Albion Market Insights - Deploy para Locaweb
# ============================================

set -e

echo "=========================================="
echo "  Albion Market Insights - Deploy Locaweb"
echo "=========================================="
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar se é root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Execute como root: sudo bash deploy-locaweb.sh${NC}"
    exit 1
fi

# ============================================
# FASE 1: Preparar sistema
# ============================================
echo -e "${YELLOW}[1/8] Atualizando sistema...${NC}"
apt update && apt upgrade -y

echo -e "${YELLOW}[2/8] Instalando dependências...${NC}"
apt install -y curl git build-essential

# ============================================
# FASE 2: Instalar Node.js 18.x
# ============================================
echo -e "${YELLOW}[3/8] Instalando Node.js 18.x...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
fi
echo "Node: $(node -v) | NPM: $(npm -v)"

# ============================================
# FASE 3: Instalar PM2
# ============================================
echo -e "${YELLOW}[4/8] Instalando PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# ============================================
# FASE 4: Clonar repositório
# ============================================
echo -e "${YELLOW}[5/8] Clonando repositório...${NC}"
cd /opt
if [ ! -d "albion-market-insights" ]; then
    git clone https://github.com/SEU_USER/albion-market-insights.git
fi
cd albion-market-insights

# ============================================
# FASE 5: Instalar dependências
# ============================================
echo -e "${YELLOW}[6/8] Instalando dependências...${NC}"
npm install --production

# ============================================
# FASE 6: Configurar ambiente
# ============================================
echo -e "${YELLOW}[7/8] Configurando ambiente...${NC}"
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  ATENÇÃO: Edite o arquivo .env!${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo "Variables obrigatórias:"
    echo "  - SERVER_API_KEY: Chave única para autenticação"
    echo "  - AODP_BASE_URL: URL do servidor AODP"
    echo ""
    echo "Comando para editar:"
    echo "  nano /opt/albion-market-insights/.env"
    echo ""
fi

# ============================================
# FASE 7: Importar itens
# ============================================
echo -e "${YELLOW}[8/8] Importando itens...${NC}"
npm run import-items

# ============================================
# FASE 8: Criar logs e iniciar
# ============================================
mkdir -p logs

echo ""
echo "=========================================="
echo "  Iniciando servidor com PM2..."
echo "=========================================="

pm2 start ecosystem.config.js
pm2 save
pm2 startup

# ============================================
# Configurar firewall
# ============================================
echo ""
echo "Configurando firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 3000/tcp
    ufw allow 22/tcp
    echo "Firewall configurado!"
fi

# ============================================
# Informações finais
# ============================================
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "=========================================="
echo "  Deploy concluído!"
echo "=========================================="
echo ""
echo "Servidor: http://${SERVER_IP}:3000"
echo ""
echo "Próximos passos:"
echo "  1. Edite o arquivo .env:"
echo "     nano /opt/albion-market-insights/.env"
echo ""
echo "  2. Reinicie o servidor:"
echo "     pm2 restart all"
echo ""
echo "  3. Acesse o dashboard:"
echo "     http://${SERVER_IP}:3000"
echo ""
echo "Comandos úteis:"
echo "  pm2 status          - Ver status"
echo "  pm2 logs            - Ver logs"
echo "  pm2 restart all     - Reiniciar"
echo "  pm2 stop all        - Parar"
echo ""
