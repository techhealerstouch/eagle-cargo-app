#!/bin/bash
set -e

APP_DOWN=false

cleanup() {
	if [[ "$APP_DOWN" == "true" ]]; then
		php artisan up || true
	fi
}

trap cleanup EXIT

read_env() {
	local key="$1"
	local value="${!key-}"

	if [[ -n "$value" ]]; then
		echo "$value"
		return
	fi

	if [[ -f .env ]]; then
		value=$(grep -E "^${key}=" .env | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')
		echo "$value"
	fi
}

is_production="false"
app_env_value="$(read_env APP_ENV)"
if [[ "$app_env_value" == "production" ]]; then
	is_production="true"
fi

if [[ "$is_production" == "true" ]]; then
	mail_mailer="$(read_env MAIL_MAILER)"
	queue_connection="$(read_env QUEUE_CONNECTION)"
	session_encrypt="$(read_env SESSION_ENCRYPT)"
	mail_admin_address="$(read_env MAIL_ADMIN_ADDRESS)"

	if [[ -z "$mail_mailer" || "$mail_mailer" == "log" || "$mail_mailer" == "array" ]]; then
		echo "ERROR: MAIL_MAILER must be a real transport (smtp/ses/postmark/resend) in production."
		exit 1
	fi

	if [[ -z "$queue_connection" || "$queue_connection" == "sync" ]]; then
		echo "ERROR: QUEUE_CONNECTION must be asynchronous in production (database/redis/sqs)."
		exit 1
	fi

	if [[ "$session_encrypt" != "true" ]]; then
		echo "ERROR: SESSION_ENCRYPT must be true in production."
		exit 1
	fi

	if [[ -z "$mail_admin_address" ]]; then
		echo "ERROR: MAIL_ADMIN_ADDRESS must be configured in production."
		exit 1
	fi
fi

# Turn on maintenance mode
php artisan down || true
APP_DOWN=true

# Pull the latest changes from the git repository
# git pull origin main

# Install/update composer dependencies
composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev

# Run database migrations
php artisan migrate --force

# Clear caches
php artisan optimize:clear
php artisan config:cache
php artisan event:cache
php artisan route:cache
php artisan view:cache

# Ensure storage link exists
php artisan storage:link --force

# Build front-end static assets
npm ci
npm run build

# Turn off maintenance mode
php artisan up
APP_DOWN=false

# Restart queue workers (Supervisor integration expected)
php artisan queue:restart

echo "Deployment finished gracefully."
