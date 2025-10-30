# Data Retention and Purge Job Documentation

## Overview

The data retention system automatically purges old data according to predefined policies while respecting legal hold requirements and maintaining audit trails.

## Configuration

### Retention Policies

The retention policies are defined in `/backend/config/retention.json`:

- **account_basic**: 12 months after tenant closure (customers, suppliers, products)
- **logs**: 9 months retention for audit logs
- **backups**: 30 days retention for backup files
- **accounting_docs**: 10 years legal hold (invoices, expenses, fiscal periods)

### Policy Structure

```json
{
  "retentionPolicies": {
    "policy_name": {
      "description": "Human readable description",
      "retentionPeriod": "Human readable period",
      "retentionDays": 365,
      "categories": ["table1", "table2"],
      "conditions": { /* Custom conditions */ },
      "legalHold": false
    }
  }
}
```

## NPM Scripts

### Available Commands

```bash
# Dry run (default) - shows what would be purged without deleting
npm run cron:retention
npm run cron:retention:dry

# Execute actual purge (requires --force flag for safety)
npm run cron:retention:execute
```

### Command Options

- **Default**: Dry run mode - shows eligible records but doesn't delete
- **--execute**: Performs actual deletion
- **--force**: Required with --execute for safety confirmation

## Manual Execution

```bash
# Change to backend directory
cd /workspaces/Muhasabev2/backend

# Dry run to see what would be purged
npm run cron:retention

# Execute actual purge (BE CAREFUL!)
npm run cron:retention:execute
```

## Scheduling with Cron

### System Cron Setup

1. Edit the system crontab:
```bash
sudo crontab -e
```

2. Add monthly retention job (runs on 1st of each month at 2 AM):
```bash
0 2 1 * * cd /workspaces/Muhasabev2/backend && npm run cron:retention:execute > /var/log/data-retention.log 2>&1
```

3. Add weekly dry-run for monitoring (runs every Sunday at 1 AM):
```bash
0 1 * * 0 cd /workspaces/Muhasabev2/backend && npm run cron:retention > /var/log/data-retention-dry.log 2>&1
```

### Systemd Timer Setup (Recommended)

1. Create service file:
```bash
sudo nano /etc/systemd/system/data-retention.service
```

Content:
```ini
[Unit]
Description=Data Retention and Purge Job
After=network.target

[Service]
Type=oneshot
User=your-user
WorkingDirectory=/workspaces/Muhasabev2/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run cron:retention:execute
StandardOutput=journal
StandardError=journal
```

2. Create timer file:
```bash
sudo nano /etc/systemd/system/data-retention.timer
```

Content:
```ini
[Unit]
Description=Run Data Retention Job Monthly
Requires=data-retention.service

[Timer]
OnCalendar=monthly
Persistent=true

[Install]
WantedBy=timers.target
```

3. Enable and start the timer:
```bash
sudo systemctl daemon-reload
sudo systemctl enable data-retention.timer
sudo systemctl start data-retention.timer
```

4. Check timer status:
```bash
sudo systemctl status data-retention.timer
sudo systemctl list-timers data-retention.timer
```

## Docker/Container Deployment

### Using Docker Compose

Add to your `docker-compose.yml`:

```yaml
services:
  retention-job:
    build: .
    environment:
      - NODE_ENV=production
      - DATABASE_HOST=postgres
      - DATABASE_PORT=5432
      - DATABASE_USER=moneyflow
      - DATABASE_PASSWORD=moneyflow123
      - DATABASE_NAME=moneyflow_prod
    command: npm run cron:retention:execute
    depends_on:
      - postgres
    profiles:
      - cron
```

Run manually:
```bash
docker-compose --profile cron run --rm retention-job
```

### Kubernetes CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: data-retention-job
spec:
  schedule: "0 2 1 * *"  # Monthly at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: retention-job
            image: your-app:latest
            command: ["npm", "run", "cron:retention:execute"]
            env:
            - name: DATABASE_HOST
              value: "postgres-service"
            - name: DATABASE_USER
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: username
            - name: DATABASE_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: password
          restartPolicy: OnFailure
```

## Monitoring and Alerting

### Log Files

- Systemd: `journalctl -u data-retention.service`
- Cron: Check `/var/log/data-retention.log`
- Application: Check backend logs

### Key Metrics to Monitor

- **Eligible Records**: Number of records that could be purged
- **Purged Records**: Number of records actually deleted
- **Errors**: Any failures during purge process
- **Execution Time**: How long the job takes to run
- **Legal Hold Violations**: Any attempts to purge protected data

### Alerting Setup

Create alerts for:
- Job failures or errors
- Unexpectedly high purge counts
- Job not running on schedule
- Legal hold violations

## Safety Features

### Built-in Protections

1. **Dry Run Default**: Always defaults to dry-run mode
2. **Legal Hold Respect**: Automatically skips data marked with legal hold
3. **Audit Trail**: All purge actions are logged to audit_log table
4. **Batch Processing**: Processes records in batches to avoid memory issues
5. **Error Handling**: Continues processing even if individual records fail
6. **Confirmation Required**: Requires --force flag for actual deletion

### Manual Safety Checks

Before running in production:

1. **Backup Database**: Always backup before purging
```bash
npm run backup
```

2. **Test with Dry Run**: Always run dry-run first
```bash
npm run cron:retention
```

3. **Verify Configuration**: Check retention policies are correct
4. **Monitor First Runs**: Watch logs closely for first few executions

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check DATABASE_* environment variables
   - Verify database is running and accessible
   - Check network connectivity

2. **Permission Denied**
   - Ensure script has execute permissions: `chmod +x scripts/data-retention.ts`
   - Check user has database delete permissions
   - Verify file system permissions

3. **TypeScript Compilation Errors**
   - Run: `npm run build` to check for syntax errors
   - Ensure all dependencies are installed: `npm install`

4. **No Records Purged**
   - Check if dry-run mode is enabled
   - Verify retention periods are configured correctly
   - Check if data actually meets purge criteria

### Debug Mode

Run with debug output:
```bash
DEBUG=* npm run cron:retention
```

### Manual Database Queries

Check eligible records manually:
```sql
-- Audit logs older than 9 months
SELECT COUNT(*) FROM audit_log 
WHERE created_at < NOW() - INTERVAL '9 months';

-- Expired tenants
SELECT id, name, status, updated_at 
FROM tenants 
WHERE status IN ('EXPIRED', 'SUSPENDED') 
AND updated_at < NOW() - INTERVAL '12 months';
```

## Recovery Procedures

### Accidental Deletion Recovery

1. **Stop All Operations**: Immediately stop any running retention jobs
2. **Restore from Backup**: Use the most recent backup before the deletion
```bash
npm run restore
```
3. **Verify Data Integrity**: Check that restored data is complete
4. **Review Logs**: Examine audit logs to understand what was deleted
5. **Update Configuration**: Fix any misconfigured retention policies

### Audit Trail Recovery

All purge operations are logged in the `audit_log` table:
```sql
SELECT * FROM audit_log 
WHERE entity = 'data_retention' 
ORDER BY created_at DESC;
```

## Performance Considerations

### Optimization Tips

1. **Run During Off-Peak Hours**: Schedule for low-traffic periods
2. **Monitor Resource Usage**: Watch CPU, memory, and disk I/O
3. **Batch Size Tuning**: Adjust `maxPurgeRecordsPerRun` in config
4. **Index Optimization**: Ensure proper indexes on date columns
5. **Vacuum After Purge**: Run database vacuum after large deletions

### Scaling for Large Datasets

For databases with millions of records:
1. Consider running retention job more frequently with smaller batches
2. Use database-specific optimization (PostgreSQL VACUUM, etc.)
3. Monitor and alert on job execution time
4. Consider archiving before deletion for very large datasets

## Compliance and Legal

### Legal Hold Management

- Accounting documents have automatic 10-year legal hold
- Legal hold flag prevents automatic deletion
- Manual review required for legal hold items
- Audit trail maintained for all retention decisions

### GDPR Compliance

- Personal data purged according to retention policies
- Right to erasure handled separately from retention
- Audit trail maintained for compliance reporting
- Data minimization through automatic purging

### Audit Requirements

- All purge actions logged with timestamps
- User attribution for manual actions
- Retention policy version tracking
- Compliance reports available through audit logs