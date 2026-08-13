# Love Balikbayan App

Love Balikbayan is a Laravel and Inertia logistics platform for Balikbayan box bookings, payments, pickup operations, warehouse processing, batch/container movement, delivery runsheets, and shipment tracking.

This README describes the current implementation and intentionally avoids real credentials, customer data, deployment URLs, API keys, webhook secrets, and seeded login details.

## Tech Stack

- Backend: Laravel 12, PHP 8.2+, Fortify, Sanctum, queues, scheduler
- Frontend: Inertia.js 2, React 19, TypeScript 5, Vite 7
- UI: Tailwind CSS 4, Radix UI, Headless UI, Lucide React
- Realtime: Laravel Reverb and Laravel Echo
- Payments: Stripe payments and Stripe Connect payout support
- PDF: Laravel DOMPDF for invoices, declarations, serial numbers, and financial reports
- Maps and scanning: Leaflet, React Leaflet, OSRM helpers, HTML5 QR code scanning
- Observability/dev tooling: Laravel Pulse, Telescope, Pail, Pint, ESLint, Prettier, Vitest, PHPUnit

## Implemented Areas

### Role-Based Portals

The app has middleware-enforced portals for these roles:

- `super_admin`
- `admin`
- `warehouse`
- `picker`
- `courier`
- `sender`
- `recipient`

Current web routing redirects `/` to login. Public tracking is available without authentication at `/track` and compatible tracking redirect routes. Most booking, dashboard, content, settings, and operational pages require authenticated and verified users.

### Booking and Declarations

- Sender booking wizard with draft creation, autosave support, draft submission, edit, cancel/delete, and duplicate detection coverage.
- Multi-box bookings with recipients, box types, custom dimensions, service metadata, and generated booking references.
- Digital declaration data, declaration file uploads, blank declaration downloads, admin declaration viewing, and declaration PDF printing.
- Sender dashboard, booking list, recipient management, invoices, and payment entry points.

### Payments, Invoices, and Commissions

- Stripe PaymentIntent flow with webhook verification and local verification endpoints.
- Bank/proof-of-payment upload flow.
- Cash/check payment recording by pickers, with admin confirmation or rejection for cash payments.
- Payment guardrails for idempotency, outstanding balance validation, cancelled bookings, voided invoices, and row-level locking.
- Automatic invoice generation, invoice snapshots, PDF downloads, tax fields, status syncing, and bulk invoice actions.
- Picker commissions, payout preferences, payout processing, Stripe Connect onboarding, and picker earnings pages.

### Pickup, Warehouse, and Delivery Operations

- Pickup and delivery runsheets with route start/complete actions, sequencing, booking attachment, and reorder support.
- Picker mobile workflow for assigned runsheets, box scanning, box collection, payment collection, declaration upload, and box status updates.
- Warehouse dashboard for receiving, loading, unloading, marking damaged/held boxes, and updating physical measurements.
- Courier mobile workflow for delivery runsheets, scans, box detail views, and delivery status updates.
- Box lifecycle statuses include pending, collected, received by warehouse, loaded to container, in transit, arrived, out for delivery, delivered, cancelled, damaged, and held.

### Batches and Tracking

- Batch/container CRUD with loading, ready-to-close, sailed, arrived, and delivered lifecycle states.
- Manifest confirmation, arrival confirmation, box loading, bulk status updates, and batch tracking phase updates.
- Public tracking page and API endpoint with throttling.
- Area-specific tracking milestones, configurable tracking settings, and cache invalidation through tracking services.
- Shipping updates feed through the API.

### Admin and Settings

Admin and super admin users manage:

- Bookings, senders, recipients, boxes, batches, runsheets, invoices, payments, enquiries, and shipping updates.
- Areas, area milestones, box types, and box prices.
- Users, roles, serial numbers, commissions, and payouts.
- General settings, invoice settings with preview, tracking settings, logistics settings, declaration settings, appearance, profile, security, and notification preferences.
- Financial reports with PDF export.
- Data integrity warnings and manual scans for super admins.

### Notifications and Background Work

- Database notifications, email notifications, SMS channel support through Brevo, and realtime browser updates through broadcasting/Reverb.
- Notification preferences API with per-event and per-channel updates.
- Queued jobs for booking confirmations, admin booking/enquiry notifications, Zoho invoice sync, and data integrity auditing.
- Scheduled maintenance for failed jobs, job batches, data integrity scans, and stale runsheet cleanup.

### API Surface

Public, throttled API routes:

- `GET /api/track/{tracking_number}`
- `GET /api/shipping-updates`

Authenticated Sanctum API routes:

- Bookings: list, show, update
- Boxes: list, show, update
- Batches: list, show, boxes
- Notifications: list, unread count, mark read, mark all read
- Notification preferences: view, update, bulk update

## Requirements

- PHP 8.2 or newer
- Composer
- Node.js LTS and npm
- A Laravel-supported database. The committed environment example defaults to SQLite.
- Optional service accounts for Stripe, Brevo SMS, Zoho Books, mail, object storage, and broadcasting if those features are enabled outside local development.

## Local Setup

Install dependencies:

```bash
composer install
npm install
```

Create a local environment file and application key:

```bash
cp .env.example .env
php artisan key:generate
```

On Windows PowerShell, use this instead of `cp`:

```powershell
Copy-Item .env.example .env
php artisan key:generate
```

Configure `.env` for your local database, queue, mail, broadcast, and optional integrations. Do not commit `.env` or paste real secret values into documentation.

Run migrations, seed reference data, and create the storage link:

```bash
php artisan migrate --seed
php artisan storage:link
```

The seeders create reference/configuration data and may create local-only development users in non-production environments. Do not reuse seeded credentials outside local development.

## Running the App

Start the full local development stack:

```bash
composer dev
```

That script runs the Laravel server, queue listener, Vite dev server, and Reverb server together.

You can also run services separately:

```bash
php artisan serve
npm run dev
php artisan queue:work
php artisan reverb:start
```

Run the scheduler in development when testing scheduled tasks:

```bash
php artisan schedule:work
```

Build production assets:

```bash
npm run build
```

Build with SSR assets:

```bash
npm run build:ssr
```

## Configuration

The project uses environment variables for secrets and deployment-specific configuration. Keep values in `.env` locally or in your deployment platform secret store.

Important configuration groups:

- App, database, cache, session, queue, filesystem, mail, and broadcasting settings from Laravel.
- Stripe: publishable key, secret key, and webhook secret.
- Brevo: SMS API key and SMS sender name.
- Zoho Books: OAuth client, refresh token, organization ID, and Books API base URL.
- Logistics SLA thresholds for delayed receipt, missed pickup, overdue loading, sorting, delivery overdue, missed ETA, and stale scans.

Use placeholder names in docs and examples. Never commit live keys, webhook secrets, access tokens, customer records, payment data, generated reports, uploaded proofs, or production logs.

## Testing and Quality

Backend tests:

```bash
php artisan test
```

Composer quality/test pipeline:

```bash
composer test
```

Frontend checks:

```bash
npm run lint:check
npm run types:check
npm run format:check
```

Frontend formatting and lint fixes:

```bash
npm run format
npm run lint
```

Vitest is installed for frontend unit tests. Until a package script is added, run it directly:

```bash
npx vitest run
```

## Project Structure

- `app/Enums`: statuses, roles, notification events, commission and payout enums
- `app/Http/Controllers`: web, admin, API, payment, picker, courier, warehouse, sender, recipient, and settings controllers
- `app/Models`: core logistics, user, payment, notification, commission, and reporting models
- `app/Services`: business services for payments, batches, tracking, settings, notifications, Zoho, commissions, snapshots, and data integrity
- `database/migrations`: current schema evolution
- `database/seeders`: reference data, settings, provinces, and tracking-step seeders
- `resources/js`: Inertia React pages, layouts, hooks, UI components, payment components, tracking components, and TypeScript types
- `resources/views`: Blade entrypoint, email templates, PDF templates, and declaration templates
- `routes/web.php`: authenticated web application, public tracking, Stripe webhook, and role portals
- `routes/api.php`: public tracking/shipping APIs and Sanctum-protected mobile/integration APIs
- `routes/settings.php`: profile, security, notification, and admin settings pages
- `tests/Feature` and `tests/Unit`: backend feature and unit coverage

## Operations Notes

For deployed environments, ensure:

- Queue workers are supervised.
- The scheduler runs every minute.
- `storage:link` or an equivalent public storage setup is available.
- Stripe webhook delivery is configured against the deployed webhook route.
- Real secrets are stored outside the repository.
- Caches are rebuilt after configuration or deployment changes.

Common production commands:

```bash
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
npm run build
```
