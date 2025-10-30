# 📦 MoneyFlow Backup System

## Quick Start

```bash
# Create a backup
./infra/backup/backup.sh

# List available backups
./infra/backup/list-backups.sh

# Check system status
./infra/backup/status.sh

# Restore from latest backup
./infra/backup/restore.sh --latest

# Restore specific backup
./infra/backup/restore.sh path/to/backup.sql.gz.enc
```

## 📁 File Structure

```
/infra/backup/
├── backup.sh                  # Main backup script
├── restore.sh                 # Main restore script
├── list-backups.sh            # List available backups
├── status.sh                  # System status check
└── config/
    ├── backup.conf            # Configuration file
    └── encryption.key         # Encryption key (auto-generated)

/docs/
├── backup.md                  # Comprehensive documentation
└── monthly-restore-test-checklist.md  # Testing procedures
```

## ✨ Features

- **🔒 Encrypted backups** with AES-256 encryption
- **📦 Compressed backups** for space efficiency
- **⏰ Timestamped files** for easy identification
- **🔄 30-day retention** with automatic cleanup
- **📊 Status monitoring** and health checks
- **🚀 Multiple restore modes** (full, schema-only, data-only, selective)
- **✅ Integrity verification** for all backups
- **📱 Notification support** (Slack, Email)

## 📋 Latest Test Results

✅ **Backup Test**: Creates timestamped, compressed, encrypted dumps  
✅ **Restore Test**: Successfully lists and processes backup files  
✅ **Status Check**: All system health checks passing  
✅ **Encryption**: AES-256 encryption working correctly  
✅ **Compression**: 80%+ size reduction achieved  

## 🎯 Business Continuity

- **RTO (Recovery Time Objective)**: < 30 minutes
- **RPO (Recovery Point Objective)**: < 24 hours (daily backups)
- **Backup Frequency**: Daily at 03:00 UTC
- **Retention**: 30 days automated cleanup
- **Encryption**: AES-256 at rest

## 📚 Documentation

- **[Complete Documentation](docs/backup.md)**: Comprehensive backup & restore guide
- **[Monthly Test Checklist](docs/monthly-restore-test-checklist.md)**: Regular testing procedures
- **[Configuration Guide](infra/backup/config/backup.conf)**: System configuration options

## 🚨 Emergency Recovery

For immediate database recovery:

```bash
# Emergency restore (fastest)
./infra/backup/restore.sh --latest --force --no-backup

# Check system status
./infra/backup/status.sh

# Verify application connectivity
curl -f http://localhost:3000/health
```

---

**📅 System Status**: ✅ Operational  
**🔄 Last Backup**: Automated (check status.sh)  
**📋 Next Review**: Monthly testing schedule  
**👤 Maintained By**: Database Team