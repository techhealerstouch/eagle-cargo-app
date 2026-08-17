# 📦 Eagle Cargo — Feature Overview

> **The complete, end-to-end logistics platform purpose-built for Eagle Cargo Company cargo shipping.**

Eagle Cargo transforms the entire cargo lifecycle — from the moment a sender books a shipment to the instant it arrives at the destination doorstep. Every step is tracked, every role is empowered, and every transaction is transparent.

---

## 🌐 Platform at a Glance

| Capability | Highlights |
|---|---|
| **User Roles** | 7 specialized portals — Sender, Recipient, Picker, Courier, Warehouse, Admin, Super Admin |
| **Tracking Milestones** | 15-step tracking journey across Origin → International Transit → Destination |
| **Payment Options** | Stripe card payments, payment on pickup, bank transfer with proof upload |
| **Notifications** | 4 channels (Email, SMS, Push, In-App) across 16 automated event triggers |
| **Integrations** | Stripe · Brevo SMS · Zoho Books · Laravel Reverb WebSockets |
| **Security** | Two-factor authentication, encrypted job payloads, rate-limited APIs, role-based access |

---

## 📋 Booking & Declaration System

### Effortless Booking Creation

Senders enjoy a rich, guided booking wizard that walks them through every step — from selecting box types and service levels to adding recipients and declaring items. The system supports **draft auto-save** so senders never lose progress, and bookings can be revisited and submitted when ready.

- **Smart draft management** — Save incomplete bookings and return to finish later
- **Preferred pickup date selection** — Senders choose when collection is most convenient
- **Multi-box bookings** — Add multiple boxes with different recipients in a single booking
- **Unique reference numbers** — Every booking receives an auto-generated reference for easy lookup
- **Duplicate detection** — Intelligent algorithm flags potential duplicate bookings within a 24-hour window based on sender and recipient matching, preventing accidental double-submissions

### Digital Customs Declaration

Say goodbye to paper forms. Eagle Cargo offers a **fully digital declaration system** where senders itemize box contents, declare values, and submit declarations — all within the app.

- **In-app declaration form** — Complete and submit declarations digitally
- **Physical form upload** — Option to upload scanned paper declaration forms
- **Declaration status tracking** — Real-time visibility into form completion and approval
- **Blank form download** — Downloadable blank declaration form for offline use
- **PDF generation** — Admins can generate and print declaration PDFs at any time
- **Configurable templates** — Customize declaration header, subtitle, badges, prohibited items notice, signature requirements, and footer text

---

## 💳 Payments & Invoicing

### Flexible Payment Options

Eagle Cargo meets senders where they are with multiple payment methods designed for convenience and trust.

- **Stripe card payments** — Secure, PCI-compliant online card processing with automatic payment method detection
- **Payment on pickup** — Pickers can collect and record cash or check payments directly at the sender's door
- **Bank transfer** — Senders upload proof of payment for manual verification
- **Admin-recorded payments** — Staff can manually log payments received through any channel

### Enterprise-Grade Payment Safety

- **Idempotency protection** — Prevents duplicate charges from retried or concurrent submissions
- **Row-level locking** — Serializes payment writes to eliminate race conditions
- **Outstanding balance validation** — Payment amounts are validated against remaining invoice balances
- **Voided invoice protection** — Payments cannot be applied to voided invoices
- **Webhook verification** — Stripe webhook signatures are cryptographically verified

### Automated Invoice Generation

Invoices are generated automatically from bookings with full line-item detail, tax breakdowns, and company branding.

- **Auto-generated invoices** — Created instantly when bookings are confirmed
- **Professional invoice numbering** — Sequential format (e.g., `INV-2026-00001`) for audit compliance
- **VAT/GST support** — Configurable tax rate with automatic vatable revenue, VAT amount, and VAT-exempt breakdowns
- **PDF download** — Senders can download professional invoice PDFs at any time
- **Invoice snapshots** — Point-in-time captures of sender, booking, line items, and admin team for historical accuracy
- **Version tracking** — Full version history ensures invoices reflect the state at the time of generation
- **Live preview** — Admins see real-time invoice previews while editing company details and branding
- **Bulk operations** — Mark multiple invoices as paid or delete in bulk

### Zoho Books Integration

Seamless accounting synchronization ensures your books are always up to date.

- **Automatic contact sync** — Sender profiles are synced as Zoho contacts
- **Invoice mirroring** — Invoices and line items are pushed to Zoho Books automatically
- **Queued & resilient** — Sync jobs run in the background with automatic retry (up to 3 attempts)
- **OAuth2 authentication** — Secure token-based integration with automatic refresh

---

## 🚚 Collection & Pickup Management

### Picker Portal — Purpose-Built for the Field

Pickers (collection drivers) get a **dedicated, mobile-optimized portal** designed for on-the-go operations. Everything they need is at their fingertips — from route details to barcode scanning.

- **Pickup runsheet management** — View, start, and complete assigned pickup runs
- **Barcode scanning** — Scan box tracking numbers directly from the mobile device
- **On-site payment collection** — Record cash and check payments with a built-in payment console
- **Declaration upload** — Capture and upload completed declaration forms in the field
- **Box status updates** — Mark boxes as collected with a single tap
- **Smart sequencing** — Stops are auto-sorted by area, province, city, and address for optimal routing

### Operational Safeguards

- Only **confirmed** bookings can be assigned to pickup runsheets
- **Area compatibility enforcement** — All bookings on a runsheet must belong to the same delivery area
- Runsheets **auto-start** when the first box leaves pending status
- Runsheets **auto-complete** when all boxes reach a terminal state

---

## 🏭 Warehouse Operations

### Warehouse Terminal Dashboard

A comprehensive dashboard gives warehouse staff full visibility and control over every package that enters the facility.

- **Scan-based receiving** — Check in boxes by scanning their tracking numbers
- **Physical measurements** — Record weight, dimensions, and cubic meter (CBM) readings
- **Container loading/unloading** — Assign boxes to shipping containers (batches) or remove them
- **Damage management** — Flag damaged packages for administrative review with recovery workflows
- **Administrative holds** — Place boxes on hold for compliance or operational reasons
- **Warehouse location tracking** — Track exactly where each box is stored in the facility

---

## 📦 Batch & Container Management

### Container Lifecycle Management

Eagle Cargo's batch management system handles the complexity of consolidating hundreds of boxes into shipping containers with smart automation.

- **Auto-generated batch numbers** — Sequential format (e.g., `LBB-2606-001`) for easy identification
- **Comprehensive shipping metadata** — Container number, seal number, vessel name, shipping line, voyage number, origin/destination ports
- **Capacity tracking** — Real-time monitoring of box count, weight (kg), and cubic meters against container limits
- **Smart auto-evaluation** — Batches automatically transition to "Ready to Close" when capacity thresholds are met or cutoff dates pass

### Auto-Next-Batch Creation

When a batch reaches capacity and is marked ready to close, the system **automatically creates the next batch** — inheriting ports, capacity, and container size settings with the next month's cutoff date. Zero manual setup required.

### Batch Lifecycle

| Status | Description |
|---|---|
| **Open** | Accepting boxes for loading |
| **Loading** | Actively being loaded |
| **Ready to Close** | Capacity threshold met or cutoff date passed |
| **Sailed** | Container has departed |
| **Arrived** | Container has reached destination port |
| **Delivered** | All boxes delivered to recipients |

### Bulk Operations

- Bulk status updates across multiple batches
- Bulk assign boxes to a specific batch
- Bulk update box statuses
- Manifest confirmation workflow
- Arrival confirmation workflow

---

## 🚲 Delivery Management

### Courier Portal — Last-Mile Excellence

Couriers receive a **dedicated mobile-optimized portal** with everything needed for efficient last-mile delivery.

- **Delivery runsheet management** — View, start, and complete assigned delivery routes
- **Barcode scanning** — Scan boxes at each delivery stop for accurate confirmation
- **Box status updates** — Mark deliveries as complete with real-time status sync
- **Delivery proof** — Capture delivery confirmation with proof-of-delivery paths and signature capture

### Smart Delivery Safeguards

- Bookings must be **fully paid** before assignment to a delivery runsheet
- Pickup must be **completed** before delivery assignment
- **Warehouse handoff** must be confirmed
- **Area compatibility** enforced across all bookings on a delivery runsheet
- Cannot assign the same booking to a completed delivery runsheet twice

---

## 🗺️ 15-Step Shipment Tracking

### Complete Visibility from Door to Door

Every box travels through a detailed **15-milestone tracking journey** organized across three phases, giving senders and recipients complete peace of mind.

#### Phase 1 — Origin
| Step | Milestone |
|---|---|
| 1 | 📦 Picked Up from Sender |
| 2 | 🏭 Received at Warehouse |
| 3 | 📥 Loaded to Container |
| 4 | ⚙️ Processing / Departed from Origin |

#### Phase 2 — International Transit
| Step | Milestone |
|---|---|
| 5 | 🚢 Shipping to Philippines (In Transit — Sea) |
| 6 | ⚓ Arrived at Manila Port |
| 7 | 🛃 Under BOC (Bureau of Customs) Clearance |
| 8 | ✅ Released by BOC |

#### Phase 3 — Destination
| Step | Milestone |
|---|---|
| 9 | 🏭 Received at Manila Warehouse |
| 10 | 📊 At Sorting Facility |
| 11 | 🚛 Dispatched to Local Hub |
| 12 | 🚲 Out for Delivery |
| 13 | 🎉 Delivered |

### Public Tracking

- **No login required** — Anyone can track a shipment using its tracking number
- **Rate-limited API** — Public tracking endpoint with intelligent rate limiting for security
- **120-second caching** — Fast, responsive lookups with automatic cache invalidation on status changes
- **Area-specific milestones** — Tracking steps are customized per delivery area with configurable sequence, labels, and icons

### Real-Time Updates

Powered by **Laravel Reverb WebSockets**, tracking updates are pushed to users in real-time — no page refresh needed.

---

## 🔔 Multi-Channel Notification System

### Multi-Channel Architecture

Eagle Cargo keeps every stakeholder informed through a sophisticated multi-channel notification engine.

#### Notification Channels
| Channel | Technology | Description |
|---|---|---|
| 📧 **Email** | Laravel Mail | Rich HTML email notifications |
| 📱 **SMS** | Brevo (Sendinblue) | Instant text message alerts |
| 🔔 **Push** | WebSocket Broadcast | Real-time in-browser notifications |
| 💬 **In-App** | Database | Persistent notification feed (always active) |

#### Automated Event Triggers

**Box Lifecycle Events:**
- Box Collected · Box Shipped · Box In Transit · Box Arrived · Box Out for Delivery · Box Delivered

**Batch Lifecycle Events:**
- Batch Ready to Close · Batch Sailed · Batch Arrived · Batch Delivered

**Payment Events:**
- Payment Received · Payment Reminder

**Scheduling Events:**
- Pickup Scheduled · Pickup Reminder · Delivery Attempt Failed

### Granular User Preferences

Every user controls exactly how they want to be notified — on a per-event, per-channel basis. Prefer SMS for delivery updates but email for payment confirmations? No problem.

- **Per-user, per-event, per-channel toggles** — Complete control over notification behavior
- **Bulk preference updates** — Update multiple preferences at once via API
- **Cached unread counts** — Fast notification badge updates without database queries
- **Read/unread management** — Mark individual or all notifications as read

---

## 👑 Administration & Configuration

### Comprehensive Admin Dashboard

Admins and Super Admins have complete control over every aspect of the platform.

#### Platform Settings
- **General** — App name, subtitle, logo, support email, phone, currency, timezone, date format
- **Invoice** — Company details, bank details, tax rates, terms & conditions, footer, logo with live preview
- **Tracking** — Customize all 12+ tracking steps with labels, icons, phases, and role-based visibility
- **Logistics** — Lead time, pickup windows, blackout dates
- **Declaration** — Header, subtitle, badges, prohibited items, signature requirements

#### Reference Data Management
- **Areas** — Create and manage delivery areas with activation/deactivation
- **Area Milestones** — Configure per-area tracking milestones with sequencing and delivery flags
- **Box Types** — Define box types with names, descriptions, and dimensions
- **Box Pricing** — Area × Box Type pricing matrix for flexible rate management

#### User Management
- Full CRUD for all user accounts across all 7 roles
- Role assignment and modification
- Admin-initiated account creation with automatic welcome notifications
- Two-factor authentication enforcement

#### Content Management
- **Enquiries** — Manage customer contact form submissions with read/reply tracking
- **Shipping Updates** — Publish and manage public shipping announcements

#### Bulk Operations
- Bulk accept, cancel, or assign bookings
- Bulk export sender data
- Bulk manage invoices, boxes, and batches

---

## 🛡️ Data Integrity & System Health

### Automated Daily Integrity Scans

Eagle Cargo runs **11 automated integrity checks** daily to catch operational issues before they become problems.

| Check | Severity | Description |
|---|---|---|
| Missing Declarations | 🔴 High | Confirmed bookings without customs declarations |
| Box Count Mismatches | 🔴 High | Non-draft bookings with zero boxes |
| Delayed Warehouse Receipts | 🔴 High | Collected boxes not received within 24 hours |
| Missed ETA | 🔴 High | Boxes in batches past their ETA by 24+ hours |
| Damaged Boxes | 🔴 High | Any box flagged as damaged |
| Delivery Overdue | 🔴 High | Out-for-delivery boxes without confirmation after 12 hours |
| Orphan Boxes | 🟡 Medium | Warehouse boxes without a batch assignment after 24 hours |
| Stale Scans | 🟡 Medium | Active boxes without scan updates for 72+ hours |
| Overdue Loading | 🟡 Medium | Warehouse boxes without batch assignment after 24 hours |
| Held Boxes | 🟡 Medium | Any box in administrative hold |
| Unpaid Loading Blocks | 🟡 Medium | Boxes ready for loading but awaiting payment |

### SLA-Driven Thresholds

All timing thresholds are fully configurable:
- Delayed receipt: 24 hours
- Overdue loading: 24 hours
- Arrived sorting: 48 hours
- Delivery overdue: 12 hours
- Missed ETA: 24 hours
- Stale scan: 72 hours

### Warning Management

- **Auto-detection** — Issues are flagged automatically during scheduled daily audits (03:00)
- **Manual resolution** — Admins can manually resolve warnings with context
- **Auto-cleanup** — Warnings are automatically cleared when underlying conditions are resolved
- **Admin dashboard** — Dedicated data integrity dashboard for at-a-glance system health monitoring

---

## 📊 Financial Reporting

- **Financial report dashboard** — Comprehensive financial overview with filtering and drill-down
- **PDF export** — Generate and download professional financial report PDFs
- **Report tracking** — Every generated report is logged with type, filename, parameters, and generating user
- **Invoice reconciliation** — Historical snapshot comparison for accurate financial reconciliation

---

## 🔐 Security & Authentication

- **Two-factor authentication (2FA)** — TOTP-based 2FA with recovery codes
- **Role-based access control** — 7 granular roles with middleware-enforced permissions
- **Encrypted job payloads** — All queued background jobs use encrypted payloads
- **Rate limiting** — Intelligent rate limits on booking writes, payments, admin mutations, scanning operations, file uploads, forms, and public tracking
- **API authentication** — Laravel Sanctum token-based API access
- **Soft deletes** — Critical data is never permanently lost
- **Stripe webhook verification** — Cryptographic signature validation on all payment webhooks
- **Row-level database locking** — Thread-safe operations on financial transactions

---

## 🔗 Transaction Snapshots & Versioning

### Complete Audit Trail

Every critical transaction is captured with **immutable point-in-time snapshots**, ensuring complete auditability and historical accuracy.

- **Entity versioning** — Automatic version numbering on Bookings, Boxes, Invoices, Senders, Recipients, and Payments
- **Transaction snapshots** — Immutable captures of invoice, booking, box, and payment states at the time of each transaction
- **Activity logging** — All create and update actions are logged with user attribution across all critical models
- **Historical reconciliation** — Merge live data with historical snapshots for accurate financial reporting

---

## 🌍 Public-Facing Pages

Eagle Cargo includes a complete public website with:

- **Home / Welcome page** — Brand introduction and call to action
- **About page** — Company story and mission
- **Services page** — Service offerings and box types
- **Community Story page** — "Our Story" — the company mission and story
- **FAQ page** — Frequently asked questions
- **Contact page** — Customer enquiry form with automated admin notification
- **Shipping Updates** — Public announcements on shipping schedules and milestones
- **Public Tracking** — No-login-required shipment tracking

---

## 📱 API & Integration Ready

### RESTful API Layer

Eagle Cargo exposes a clean, authenticated API layer for mobile apps and third-party integrations.

**Public Endpoints** (rate-limited, no auth):
- Shipment tracking by tracking number
- Shipping updates feed

**Authenticated Endpoints** (Sanctum token):
- Bookings — List, view, update
- Boxes — List, view, update
- Batches — List, view, box inventory
- Notifications — List, unread count, mark read, bulk mark read
- Notification Preferences — View, update, bulk update

---

## ⚡ Background Processing

### Resilient Queue System

Critical operations run asynchronously for a fast, responsive user experience.

- **Booking notifications** — Admin email alerts on new bookings (encrypted, 3 retries with exponential backoff)
- **Confirmation emails** — Automated sender confirmation emails
- **Zoho sync** — Invoice and contact synchronization to Zoho Books
- **Enquiry alerts** — Admin notifications for new contact form submissions
- **Scheduled maintenance** — Daily automated tasks including failed job pruning and data integrity audits

---

## 🛠️ Technology Foundation

| Layer | Technology |
|---|---|
| **Backend** | Laravel 12 (PHP 8.2+) |
| **Frontend** | React 18 · TypeScript · Inertia.js |
| **Build** | Vite 6 |
| **Styling** | Tailwind CSS · Radix UI · Headless UI · Lucide Icons |
| **Real-Time** | Laravel Reverb (WebSockets) |
| **Payments** | Stripe API |
| **SMS** | Brevo (Sendinblue) |
| **Accounting** | Zoho Books API |
| **Auth** | Laravel Fortify + Sanctum |
| **PDF** | Laravel DOMPDF |
| **Testing** | PHPUnit · Vitest |
| **Code Quality** | ESLint · Laravel Pint · Prettier |

---

<p align="center">
  <strong>Eagle Cargo Company</strong> — Fast, reliable, and secure cargo logistics. 🦅
</p>
