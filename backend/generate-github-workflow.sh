#!/bin/bash

# GitHub Actions için otomatik backup workflow
# .github/workflows/database-backup.yml olarak kaydedin

cat << 'EOF'
name: Database Backup

on:
  schedule:
    # Her gün UTC 03:00'te (Türkiye saati 06:00)
    - cron: '0 3 * * *'
  workflow_dispatch: # Manuel çalıştırma için

jobs:
  backup:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Setup SSH connection
        env:
          SSH_PRIVATE_KEY: ${{ secrets.SSH_PRIVATE_KEY }}
          SERVER_HOST: ${{ secrets.SERVER_HOST }}
          SERVER_USER: ${{ secrets.SERVER_USER }}
        run: |
          mkdir -p ~/.ssh
          echo "$SSH_PRIVATE_KEY" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          ssh-keyscan -H $SERVER_HOST >> ~/.ssh/known_hosts
      
      - name: Run backup on server
        env:
          SERVER_HOST: ${{ secrets.SERVER_HOST }}
          SERVER_USER: ${{ secrets.SERVER_USER }}
        run: |
          ssh $SERVER_USER@$SERVER_HOST "cd /opt/moneyflow/backend && ./backup-db.sh"
      
      - name: Download backup
        env:
          SERVER_HOST: ${{ secrets.SERVER_HOST }}
          SERVER_USER: ${{ secrets.SERVER_USER }}
        run: |
          LATEST_BACKUP=$(ssh $SERVER_USER@$SERVER_HOST "ls -t /opt/moneyflow/backend/backups/*.sql | head -1")
          scp $SERVER_USER@$SERVER_HOST:$LATEST_BACKUP ./backend/backups/
      
      - name: Compress backup
        run: |
          cd backend/backups
          BACKUP_FILE=$(ls -t *.sql | head -1)
          gzip $BACKUP_FILE
      
      - name: Upload to GitHub Releases
        uses: softprops/action-gh-release@v1
        with:
          tag_name: backup-$(date +%Y%m%d)
          name: Database Backup $(date +%Y-%m-%d)
          files: backend/backups/*.sql.gz
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Upload to AWS S3 (Optional)
        if: ${{ secrets.AWS_ACCESS_KEY_ID }}
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: ${{ secrets.AWS_REGION }}
          S3_BUCKET: ${{ secrets.S3_BACKUP_BUCKET }}
        run: |
          aws s3 cp backend/backups/*.sql.gz s3://$S3_BUCKET/backups/
      
      - name: Cleanup old backups
        run: |
          # 30 günden eski backup'ları sil
          find backend/backups -name "*.sql*" -mtime +30 -delete
      
      - name: Send notification
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Database backup ${{ job.status }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}

EOF
