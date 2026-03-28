#!/bin/bash
set -e

# FitFlow VPS Deploy Script
# Run on your VPS: bash deploy.sh

APP_DIR="/opt/fitflow"
REPO="https://github.com/kennethyork/FitFlow.git"

echo "── Deploying FitFlow API ──"

# Install Node.js if needed
if ! command -v node &> /dev/null; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Install PM2 if needed
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2..."
  sudo npm install -g pm2
fi

# Clone or pull
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  git pull origin main
else
  sudo mkdir -p "$APP_DIR"
  sudo chown "$USER:$USER" "$APP_DIR"
  git clone "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

# Install server dependencies
cd server
npm ci --omit=dev

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

cd ..

# Create .env if it doesn't exist
if [ ! -f .env ]; then
  cat > .env << 'EOF'
DATABASE_URL="file:./server/prisma/dev.db"
PORT=4000
JWT_SECRET=CHANGE_ME_TO_RANDOM_SECRET
CORS_ORIGIN=https://fitflow.kennethyork.com,https://kennethyork.github.io

# S3 (optional, for progress photos)
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# S3_BUCKET=
EOF
  echo "⚠️  Edit .env with your secrets: nano $APP_DIR/.env"
fi

# Start/restart with PM2
pm2 stop fitflow 2>/dev/null || true
pm2 start server/index.js --name fitflow
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true

echo ""
echo "✅ FitFlow API running on port 4000"
echo "── Next steps ──"
echo "1. Edit .env:  nano $APP_DIR/.env"
echo "2. Set up nginx (see nginx.conf)"
echo "3. Get SSL:    sudo certbot --nginx -d api.yourdomain.com"
