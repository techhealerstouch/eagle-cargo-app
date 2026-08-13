# BBB-Tracker Ops Setup

This folder contains production templates for queue workers and scheduler wiring.

## 1) Queue Worker (Supervisor)

Template:
- scripts/ops/supervisor/bbb-tracker-worker.conf

Install (Ubuntu/Debian):
1. Copy the file to /etc/supervisor/conf.d/bbb-tracker-worker.conf
2. Update paths, user, and numprocs to match your host.
3. Reload Supervisor:
   - sudo supervisorctl reread
   - sudo supervisorctl update
   - sudo supervisorctl status bbb-tracker-worker:*

Recommended checks:
- Worker processes are RUNNING.
- Log file exists at /var/log/supervisor/bbb-tracker-worker.log.
- Jobs in failed_jobs table do not grow unexpectedly.

## 2) Scheduler (Cron)

Template:
- scripts/ops/cron/bbb-tracker-scheduler.cron

Install:
1. Open crontab for the app user:
   - crontab -e
2. Paste the line from scripts/ops/cron/bbb-tracker-scheduler.cron
3. Save and verify:
   - crontab -l

Recommended checks:
- php artisan schedule:list shows active jobs.
- Scheduler log file exists at /var/log/bbb-tracker-scheduler.log.
- Daily prune jobs run at configured times.

## 3) Deployment Integration

The deploy script already runs php artisan queue:restart.

Expected runtime order:
1. Deploy completes
2. queue:restart signals workers
3. Supervisor restarts fresh queue workers automatically

## 4) Production Env Checklist

Before deployment, ensure:
- APP_ENV=production
- MAIL_MAILER is not log/array
- MAIL_ADMIN_ADDRESS is set
- QUEUE_CONNECTION is asynchronous (database, redis, or sqs)
- SESSION_ENCRYPT=true

These are enforced by deploy.sh when APP_ENV=production.
