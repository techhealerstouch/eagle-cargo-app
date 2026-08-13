#!/bin/bash

# Love Balikbayan App - Docker Setup Script
# Run this script once to build and set up the entire environment

set -e

echo "=========================================="
echo "  Love Balikbayan App - Docker Setup"
echo "=========================================="

echo ""
echo "[1/5] Building Docker images..."
docker compose build --no-cache

echo ""
echo "[2/5] Starting containers..."
docker compose up -d db
echo "Waiting 15 seconds for MySQL to be ready..."
sleep 15

echo ""
echo "[3/5] Starting all services..."
docker compose up -d

echo ""
echo "[4/5] Running Laravel setup (key:generate, migrate, storage link)..."
docker compose exec app php artisan key:generate --force
docker compose exec app php artisan migrate --force
docker compose exec app php artisan storage:link
docker compose exec app php artisan config:cache

echo ""
echo "[5/5] Building frontend assets..."
docker compose run --rm vite npm install

echo ""
echo "=========================================="
echo "  Setup complete!"
echo "  App:    http://localhost:8080"
echo "  Vite:   http://localhost:5174"
echo "  Reverb: ws://localhost:8081"
echo "  DB:     localhost:3307 (root/root)"
echo "=========================================="
