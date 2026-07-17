# Deploy - Albion Market Insights

## Pré-requisitos

- Ubuntu 20.04+ / Debian 10+
- Acesso SSH ao servidor
- Porta 3000 aberta no firewall

## Opção 1: Deploy Automático

```bash
# Conectar ao servidor via SSH
ssh root@SEU_IP

# Clonar o repositório
git clone https://SEU_USER@SEU_REPO.git
cd albion-market-insights

# Executar deploy
bash deploy.sh
```

## Opção 2: Deploy Manual

### 1. Instalar dependências do sistema

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar PM2
sudo npm install -g pm2

# Verificar
node -v  # deve mostrar v18.x.x
npm -v   # deve mostrar 9.x.x ou superior
```

### 2. Clonar e instalar

```bash
git clone https://SEU_USER@SEU_REPO.git
cd albion-market-insights
npm install --production
```

### 3. Configurar ambiente

```bash
# Criar .env
cp .env.example .env

# Editar com suas configurações
nano .env
```

Variáveis obrigatórias:
- `SERVER_API_KEY` - Chave única para autenticação dos clientes
- `AODP_BASE_URL` - URL do servidor AODP (padrão: https://aodp.danilolc.com)

### 4. Importar itens

```bash
npm run import:items
```

### 5. Iniciar com PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Comandos Úteis

```bash
# Status do servidor
pm2 status

# Ver logs
pm2 logs

# Reiniciar
pm2 restart all

# Parar
pm2 stop all

# Monitorar
pm2 monit
```

## Configurar Nginx (Opcional)

Para usar HTTPS e domínio personalizado:

```bash
# Instalar Nginx
sudo apt install nginx -y

# Copiar config
sudo cp nginx.conf /etc/nginx/sites-available/albion-market-insights

# Editar com seu domínio
sudo nano /etc/nginx/sites-available/albion-market-insights

# Ativar site
sudo ln -s /etc/nginx/sites-available/albion-market-insights /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Testar e reiniciar
sudo nginx -t
sudo systemctl restart nginx

# Habilitar SSL com Certbot
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d seu-dominio.com
```

## Firewall

```bash
# Abrir porta 3000
sudo ufw allow 3000/tcp

# Ou para Nginx
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Troubleshooting

### Servidor não inicia

```bash
# Verificar logs de erro
pm2 logs --err

# Verificar se a porta está em uso
sudo lsof -i :3000
```

### Erro de permissão

```bash
# Ajustar permissões
chmod -R 755 .
chown -R www-data:www-data .
```

### Banco de dados corrompido

```bash
# Resetar banco
rm data/albion_market.db
npm run import:items
pm2 restart all
```
