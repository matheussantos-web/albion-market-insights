#!/bin/bash

# Albion Market Insights - Deploy Script
# Usage: bash deploy.sh

set -e

echo "=== Albion Market Insights - Deploy ==="
echo ""

# Update system
echo "[1/7] Updating system..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
echo "[2/7] Installing Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
fi
echo "Node: $(node -v) | NPM: $(npm -v)"

# Install PM2
echo "[3/7] Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

# Install dependencies
echo "[4/7] Installing dependencies..."
npm install --production

# Import items
echo "[5/7] Importing items..."
npm run import:items

# Create logs directory
mkdir -p logs

# Create .env if not exists
if [ ! -f .env ]; then
    echo "[6/7] Creating .env from template..."
    cp .env.example .env
    echo "  IMPORTANT: Edit .env with your settings!"
    echo "  Required: SERVER_API_KEY, AODP_BASE_URL"
else
    echo "[6/7] .env already exists, skipping..."
fi

# Start with PM2
echo "[7/7] Starting server..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo ""
echo "=== Deploy Complete ==="
echo ""
echo "Server: http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "Useful commands:"
echo "  pm2 status          - Check server status"
echo "  pm2 logs            - View logs"
echo "  pm2 restart all     - Restart server"
echo "  pm2 stop all        - Stop server"
echo ""
echo "Remember to:"
echo "  1. Edit .env file with your API key"
echo "  2. Open port 3000 in firewall"
echo "  3. (Optional) Set up nginx reverse proxy"
