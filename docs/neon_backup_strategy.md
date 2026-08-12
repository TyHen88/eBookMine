# Neon PostgreSQL Backup & Disaster Recovery Strategy

This document outlines the backup, point-in-time recovery (PITR), branch snapshotting, and disaster recovery strategy for eBookMine's **Neon PostgreSQL** database layer.

---

## 1. Automated Neon Backups & Point-In-Time Recovery (PITR)

Neon PostgreSQL provides **continuous WAL archiving and automated snapshots**:

* **Point-In-Time Recovery (PITR):** Neon continuously streams Write-Ahead Logs (WAL) and allows restoring the database state to any microsecond within the retention window (7 days on standard plans, 30+ days on scale plans).
* **Zero Downtime Backups:** Backups do not lock database tables or impact application query performance.

---

## 2. Instant Branching & Snapshots (Pre-Migration Safety)

Before running major database schema updates (`npx prisma db push` or `prisma migrate deploy`), take a **Neon Instant Branch Snapshot**:

```bash
# Using Neon CLI (optional)
neon branch create pre-migration-backup --parent main
```

If an invalid schema migration causes corruption or unintended data modification:
1. Re-point `DATABASE_URL` in environment variables (`.env`) to the parent snapshot branch.
2. Re-run `npx prisma generate`.

---

## 3. Automated Offsite Backup Script (`pg_dump`)

For additional redundancy outside Neon's infrastructure, run an offsite `pg_dump` daily backup script:

### Backup Command
```bash
pg_dump "$DIRECT_URL" \
  --format=custom \
  --blobs \
  --verbose \
  --file="ebookmine_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### Restore Command
```bash
pg_restore \
  --dbname="$DIRECT_URL" \
  --clean \
  --if-exists \
  --verbose \
  "ebookmine_backup_TARGET.dump"
```

---

## 4. Disaster Recovery Protocol

In the event of a region-wide cloud outage or database incident:

1. **Provision New Neon Project:** Create a fresh Neon PostgreSQL project in an operational region.
2. **Execute Restore Script:** Run `pg_restore` using the latest offsite `.dump` file.
3. **Re-enable Vector Extension:**
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
4. **Update Environment Variables:** Re-point `DATABASE_URL` and `DIRECT_URL` in Vercel / hosting environment settings.
5. **Idempotent Drive Metadata Resync:** Trigger `npm run migrate-library` or run the Admin Control Panel `/admin` Drive Sync task to verify PDF metadata integrity.
