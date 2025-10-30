# 📦 Database Backup & Restore Documentation

## Overview

This document describes the comprehensive backup and restore system for the MoneyFlow application database. The system provides automated daily backups with 30-day retention, encryption at rest, and standardized restore procedures.

## 🎯 Business Continuity Goals

| Metric | Target | Description |
|--------|--------|-------------|
| **RTO** (Recovery Time Objective) | < 30 minutes | Maximum time to restore service after failure |
| **RPO** (Recovery Point Objective) | < 24 hours | Maximum acceptable data loss (daily backups) |
| **Backup Frequency** | Daily @ 03:00 UTC | Automated daily backups |
| **Retention Period** | 30 days | Automated cleanup of old backups |
| **Encryption** | AES-256 at rest | All backups encrypted when stored |

## 🏗️ Architecture

### Backup System Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   PostgreSQL    │───▶│  Backup Scripts  │───▶│  Secure Storage │
│   Database      │    │  (pg_dump +      │    │  (Encrypted)    │
│                 │    │   compression)   │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   Monitoring &   │
                       │   Alerting       │
                       └──────────────────┘
```

### Storage Locations

1. **Local Backups** (`/backups/`): Primary backup location
2. **Offsite Backups** (Cloud): Secondary backup for disaster recovery
3. **Archive Storage**: Long-term retention for compliance

## 📅 Daily Automated Backups

### Backup Schedule

- **Time**: 03:00 UTC daily
- **Method**: `pg_dump` with custom format
- **Compression**: gzip compression (typically 70-80% size reduction)
- **Naming**: `moneyflow_backup_YYYYMMDD_HHMMSS.sql.gz`

### Automated Process

```bash
# Daily backup process (automated via cron/systemd)
1. Check database connectivity
2. Create timestamped backup file
3. Compress backup with gzip
4. Encrypt compressed file (AES-256)
5. Verify backup integrity
6. Update backup catalog
7. Clean up old backups (>30 days)
8. Send completion notification
```

### Configuration Files

- **Development**: `.env` (DATABASE_URL)
- **Production**: `.env.production` (encrypted DATABASE_PASSWORD)
- **Docker**: `docker-compose.production.yml`

## 🔐 Encryption at Rest

### Encryption Implementation

All backups are encrypted using AES-256 encryption before storage:

```bash
# Encryption process
pg_dump → gzip → openssl enc -aes-256-cbc → secure storage
```

### Key Management

- **Development**: Encryption key in `.env.local`
- **Production**: Key stored in secure vault (AWS KMS/HashiCorp Vault)
- **Rotation**: Keys rotated quarterly
- **Access**: Limited to authorized backup/restore personnel

### Verification

```bash
# Verify encrypted backup integrity
openssl enc -aes-256-cbc -d -in backup.sql.gz.enc | gzip -t
```

## 🔄 Restore Procedures

### Pre-Restore Checklist

- [ ] Identify correct backup file
- [ ] Verify backup integrity
- [ ] Stop application services
- [ ] Create current database snapshot (if possible)
- [ ] Notify stakeholders of maintenance window

### Standard Restore Process

#### 1. Emergency Restore (< 30 minutes RTO)

```bash
# 1. Stop application
docker-compose down

# 2. Quick restore from latest backup
./infra/backup/restore.sh --latest --force

# 3. Start application
docker-compose up -d

# 4. Verify functionality
curl -f http://localhost:3000/health
```

#### 2. Point-in-Time Restore

```bash
# 1. List available backups
./infra/backup/list-backups.sh

# 2. Select specific backup
./infra/backup/restore.sh --backup moneyflow_backup_20241030_030000.sql.gz

# 3. Verify data integrity
./infra/backup/verify-restore.sh
```

#### 3. Selective Restore (Table-level)

```bash
# Restore specific tables only
./infra/backup/restore.sh --tables users,transactions --backup latest
```

### Post-Restore Verification

```bash
# 1. Database connectivity
pg_isready -h localhost -p 5432

# 2. Table counts
psql -c "SELECT schemaname, tablename, n_tup_ins FROM pg_stat_user_tables;"

# 3. Application health
curl -f http://localhost:3000/api/health/database

# 4. Critical business functions
npm run test:critical-paths
```

## 📊 Backup Monitoring & Alerting

### Success Criteria

- Backup file created successfully
- File size within expected range (±20% of previous backup)
- Encryption completed without errors
- Integrity verification passed

### Alert Conditions

| Condition | Severity | Action |
|-----------|----------|--------|
| Backup failed | Critical | Immediate notification + retry |
| Backup size anomaly | Warning | Investigation required |
| Encryption failed | Critical | Security team notification |
| Storage space low | Warning | Cleanup old backups |

### Monitoring Dashboard

```bash
# Check backup status
./infra/backup/status.sh

# View backup statistics
./infra/backup/stats.sh --last-7-days

# Test backup integrity
./infra/backup/verify.sh --all
```

## 🛠️ Backup Scripts Location

All backup and restore scripts are located in `/infra/backup/`:

```
/infra/backup/
├── backup.sh              # Main backup script
├── restore.sh              # Main restore script
├── encrypt.sh              # Encryption utilities
├── verify.sh               # Backup verification
├── cleanup.sh              # Old backup cleanup
├── list-backups.sh         # List available backups
├── stats.sh                # Backup statistics
└── config/
    ├── backup.conf         # Backup configuration
    └── encryption.key      # Encryption key (production)
```

## 🔧 Configuration

### Environment Variables

```bash
# Core settings
DATABASE_URL=postgresql://user:pass@localhost:5432/db
BACKUP_DIR=/secure/backups
BACKUP_RETENTION_DAYS=30

# Encryption
BACKUP_ENCRYPTION_KEY=path/to/encryption.key
BACKUP_CIPHER=aes-256-cbc

# Monitoring
BACKUP_WEBHOOK_URL=https://hooks.slack.com/...
BACKUP_EMAIL_NOTIFICATIONS=admin@company.com

# Storage
BACKUP_COMPRESSION=gzip
BACKUP_COMPRESSION_LEVEL=6
BACKUP_PARALLEL_JOBS=2
```

### Backup Types

1. **Full Backup** (Default): Complete database dump
2. **Incremental**: Only changes since last backup (advanced)
3. **Schema Only**: Structure without data
4. **Data Only**: Data without structure

## 🧪 Testing & Validation

### Automated Tests

```bash
# Daily backup verification
./infra/backup/test-backup.sh

# Monthly restore test
./infra/backup/test-restore.sh --full

# Quarterly disaster recovery drill
./infra/backup/disaster-recovery-test.sh
```

### Manual Testing Checklist

- [ ] Backup script execution
- [ ] File encryption/decryption
- [ ] Restore process timing
- [ ] Data integrity verification
- [ ] Application functionality post-restore

## 📈 Performance Optimization

### Backup Performance

- **Parallel processing**: Multiple tables backed up simultaneously
- **Compression**: Reduces storage by ~75%
- **Network optimization**: Local staging before transfer
- **Incremental backups**: For large databases (future enhancement)

### Storage Optimization

```bash
# Automatic compression levels
Small DB (<100MB): gzip -9 (maximum compression)
Medium DB (100MB-1GB): gzip -6 (balanced)
Large DB (>1GB): gzip -3 (fast compression)
```

## 🚨 Disaster Recovery Scenarios

### Scenario 1: Database Corruption

```bash
# Detection
tail -f /var/log/postgresql/postgresql.log | grep ERROR

# Response
./infra/backup/restore.sh --latest --verify

# Recovery Time: ~15 minutes
```

### Scenario 2: Complete Server Loss

```bash
# New server setup
./infra/setup/provision-server.sh

# Restore from offsite backup
./infra/backup/restore.sh --offsite --latest

# Recovery Time: ~2 hours
```

### Scenario 3: Data Center Outage

```bash
# Failover to secondary data center
./infra/failover/activate-secondary.sh

# Restore from cloud backup
./infra/backup/restore.sh --cloud --latest

# Recovery Time: ~4 hours
```

## 📋 Compliance & Auditing

### Backup Logs

All backup operations are logged with:
- Timestamp
- User/process executing backup
- Backup size and location
- Success/failure status
- Checksum verification results

### Retention Compliance

- **GDPR**: 30-day retention for EU data
- **SOX**: 7-year retention for financial records
- **Custom**: Configurable retention policies

### Audit Trail

```bash
# View backup audit log
tail -f /var/log/backup/audit.log

# Generate compliance report
./infra/backup/compliance-report.sh --month 2024-10
```

## 🔗 Related Documentation

- **[DATABASE_GUIDE.md](../backend/DATABASE_GUIDE.md)**: Database management procedures
- **[AUTO_BACKUP_GUIDE.md](../backend/AUTO_BACKUP_GUIDE.md)**: Automated backup setup
- **[PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)**: Production deployment guide
- **[SECURITY_IMPROVEMENTS.md](SECURITY_IMPROVEMENTS.md)**: Security hardening measures

## 📞 Emergency Contacts

### Backup & Recovery Team

- **Primary**: Database Administrator (on-call 24/7)
- **Secondary**: DevOps Team Lead
- **Escalation**: CTO/Technical Director

### Emergency Procedures

1. **Immediate**: Slack #infrastructure-alerts
2. **Critical**: SMS/Phone notification system
3. **Severe**: Executive escalation protocol

---

## ✅ Quick Reference

### Common Commands

```bash
# Take manual backup
./infra/backup/backup.sh --now

# List recent backups
./infra/backup/list-backups.sh --recent

# Restore latest backup
./infra/backup/restore.sh --latest

# Check backup health
./infra/backup/status.sh

# Clean old backups
./infra/backup/cleanup.sh --older-than 30days
```

### Backup File Locations

- **Local**: `/workspaces/Muhasabev2/backend/backups/`
- **Production**: `/opt/moneyflow/backups/`
- **Archive**: `/mnt/backup-archive/`
- **Offsite**: `s3://company-backups/moneyflow/`

---

**📚 Last Updated**: October 30, 2024  
**👤 Document Owner**: Database Team  
**📋 Review Schedule**: Monthly  
**🔄 Next Review**: November 30, 2024