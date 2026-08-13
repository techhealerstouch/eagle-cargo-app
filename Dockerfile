# Stage 1: PHP Application Build
FROM php:8.2-fpm-alpine AS php-builder

WORKDIR /var/www

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    libpng-dev \
    oniguruma-dev \
    libxml2-dev \
    libzip-dev \
    linux-headers \
    && docker-php-ext-install \
        pdo_mysql \
        mbstring \
        exif \
        pcntl \
        bcmath \
        gd \
        zip \
        sockets

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy dependency files
COPY composer.json composer.lock ./

# Install PHP dependencies (no scripts or autoloader yet)
RUN composer install --no-dev --no-interaction --no-scripts --no-autoloader --no-progress

# Copy application code
COPY . .

# Generate optimized autoloader and run scripts
RUN composer install --no-dev --no-interaction --optimize-autoloader --no-progress


# Stage 2: Node Build (for assets)
FROM node:22-alpine AS node-builder

# Upgrade Alpine packages to patch underlying OS-level CVEs
RUN apk upgrade --no-cache

WORKDIR /var/www

# Copy package files
COPY package.json package-lock.json ./

# Install Node dependencies
RUN npm ci

# Copy source files
COPY resources ./resources
COPY vite.config.ts tsconfig.json ./

# Build assets
RUN npm run build


# Stage 3: Runtime PHP Image
FROM php:8.2-fpm-alpine

WORKDIR /var/www

# Install runtime dependencies only (no build tools)
RUN apk add --no-cache \
    oniguruma \
    libxml2 \
    libzip \
    libpng \
    mysql-client

# Copy PHP extensions from builder
COPY --from=php-builder /usr/local/lib/php/extensions /usr/local/lib/php/extensions
COPY --from=php-builder /usr/local/etc/php /usr/local/etc/php

# Copy application from builder
COPY --from=php-builder /var/www /var/www

# Copy built assets from node builder
COPY --from=node-builder /var/www/public/build ./public/build

# Set up PHP configuration
COPY docker/php/local.ini /usr/local/etc/php/conf.d/local.ini

# Create storage directories and set permissions
RUN mkdir -p storage/logs storage/app storage/framework/views storage/framework/cache \
    && chown -R www-data:www-data /var/www \
    && chmod -R 755 storage bootstrap/cache

USER www-data

EXPOSE 9000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD php -r "exit(function_exists('version_compare') ? 0 : 1);"

CMD ["php-fpm"]
