#!/bin/bash

# GitHub Secrets Auto-Setup Script for safestories-crm
# Run this locally: bash add-github-secrets.sh

echo "🔐 Adding GitHub Secrets for safestories-crm..."

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI not found!"
    echo "Install from: https://cli.github.com/"
    exit 1
fi

# Check if logged in
if ! gh auth status &> /dev/null; then
    echo "📝 Please login to GitHub..."
    gh auth login
fi

# Add all VPS & backend secrets
echo "Adding secrets..."

gh secret set VPS_HOST --body "srv1169280.hstgr.cloud"
gh secret set VPS_USER --body "deploy"
gh secret set VPS_PORT --body "22"
gh secret set VPS_SSH_KEY --body "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACDIC9Az5pQ8F5XtO4CoQsvHFm8oaitCVolkRaGn4uRmpQAAAJjIxo4oyMaO
KAAAAAtzc2gtZWQyNTUxOQAAACDIC9Az5pQ8F5XtO4CoQsvHFm8oaitCVolkRaGn4uRmpQ
AAAEA6Ahs9FbkYAHeP0LG7CqYyVL8n92LnqqvF4A5xSXcELMgL0DPmlDwXle07gKhCy8cW
byhqK0JWiWRFoafi5GalAAAAEWRlcGxveUBzcnYxMTY5MjgwAQIDBA==
-----END OPENSSH PRIVATE KEY-----"

# Database Secrets
gh secret set PGHOST --body "72.60.103.151"
gh secret set PGPORT --body "5432"
gh secret set PGDATABASE --body "safestories_db_v2"
gh secret set PGUSER --body "fluidadmin"
gh secret set PGPASSWORD --body "admin123"

gh secret set DB_HOST --body "72.60.103.151"
gh secret set DB_PORT --body "5432"
gh secret set DB_NAME --body "safestories_db_v2"
gh secret set DB_USER --body "fluidadmin"
gh secret set DB_PASSWORD --body "admin123"

# Frontend URL
gh secret set FRONTEND_URL --body "https://safestories-crm.vercel.app/"
gh secret set DOMAIN_NAME --body "srv1169280.hstgr.cloud"

# MinIO Storage Secrets
gh secret set MINIO_ENDPOINT --body "s3.fluidjobs.ai"
gh secret set MINIO_PORT --body "9002"
gh secret set MINIO_ACCESS_KEY --body "admin"
gh secret set MINIO_SECRET_KEY --body "Fluidbucket@2026"
gh secret set MINIO_BUCKET_NAME --body "safestories-panel"
gh secret set MINIO_USE_SSL --body "true"

# Razorpay Keys
gh secret set RAZORPAY_KEY_ID --body "rzp_live_SaBaiUb2drX26Q"
gh secret set RAZORPAY_KEY_SECRET --body "Pce9pDS10yAq6aOEUbeYOT9f"

# Gmail Credentials (Add these manually or customize)
# gh secret set GMAIL_USER --body "your_email@gmail.com"
# gh secret set GMAIL_APP_PASSWORD --body "your_app_password"

echo "✅ All secrets added to safestories-crm!"
echo ""
echo "📋 Verifying secrets list..."
gh secret list
