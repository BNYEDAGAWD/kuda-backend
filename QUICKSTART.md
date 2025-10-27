# Creative Approval System - Quick Start Guide

Get the Creative Approval Workflow Automation System running in **under 15 minutes**.

## Prerequisites

- Docker Desktop installed and running
- Git installed
- Text editor (VS Code recommended)

## Step-by-Step Setup

### 1. Clone & Navigate

```bash
git clone https://github.com/YOUR_USERNAME/creative-approval-system.git
cd creative-approval-system
```

### 2. Create Environment File

```bash
cp .env.example .env
```

**Edit `.env` and add minimum required values:**

```bash
# AWS S3 (get from AWS Console → IAM → Security Credentials)
AWS_ACCESS_KEY_ID=AKIA****************
AWS_SECRET_ACCESS_KEY=**********************
S3_BUCKET=your-bucket-name

# Gmail API (get from Google Cloud Console)
GMAIL_CLIENT_ID=******.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-********************
GMAIL_REFRESH_TOKEN=1//**********************

# Celtra API
CELTRA_API_KEY=********************************

# Generate JWT Secret
JWT_SECRET=$(openssl rand -base64 32)
```

### 3. Start Everything

```bash
# Start all services (takes 2-3 minutes first time)
docker-compose up -d

# Watch logs
docker-compose logs -f
```

**Wait for these messages:**
```
postgres   | database system is ready to accept connections
backend    | Server running on port 4000
frontend   | ready in XXXms
```

### 4. Initialize Database

```bash
# Run migrations (creates tables)
docker-compose exec backend npm run migrate

# Seed admin user (optional)
docker-compose exec backend npm run seed
```

### 5. Access Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **API Docs**: http://localhost:4000/api-docs

## First Login

1. Open http://localhost:3000
2. Click "Sign in with Google"
3. Authenticate with your Google Workspace account
4. You're in! 🎉

## Create Your First Campaign

1. Click "New Campaign"
2. Fill in details:
   - Campaign Name: "Test Campaign Q1 2024"
   - Client Name: "Amazon"
   - Your Email: brandon.nye@kargo.com
   - Start/End Dates
3. Click "Create & Send Invite"
4. Check your email for client portal link

## Test Client Portal

1. Open client portal link from email (or copy from campaign details)
2. Upload a test image (JPG/PNG)
3. Add optional notes
4. Submit

## Approve Creative

1. Go back to dashboard
2. See new creative in "Pending Approvals"
3. Click "Review"
4. Add feedback (optional)
5. Click "Approve"
6. Tag is generated automatically!

## View Generated Tag

1. Click "Tags" in sidebar
2. Find your creative
3. Click "View Tag"
4. Copy to clipboard or download

## Common Commands

```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart service
docker-compose restart backend

# Stop all
docker-compose down

# Start fresh (deletes data!)
docker-compose down -v
docker-compose up -d

# Access database
docker-compose exec postgres psql -U postgres -d creative_approval

# Run tests
docker-compose exec backend npm test
```

## Troubleshooting

### Ports Already in Use

```bash
# Change ports in docker-compose.yml
# Frontend: 3001:3000
# Backend: 4001:4000
```

### Database Connection Error

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Restart database
docker-compose restart postgres
```

### Frontend Not Loading

```bash
# Clear browser cache (Cmd+Shift+Delete)
# Rebuild frontend
docker-compose build frontend
docker-compose up -d frontend
```

### Can't Upload Files

```bash
# Verify S3 credentials in .env
# Test S3 access
aws s3 ls s3://your-bucket-name
```

## Next Steps

- [Full Setup Guide](./SETUP.md) - Complete configuration details
- [User Guide](./USER_GUIDE.md) - How to use all features
- [API Documentation](http://localhost:4000/api-docs) - API reference
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) - Production deployment

## Need Help?

- **Email**: brandon.nye@kargo.com
- **GitHub Issues**: https://github.com/YOUR_USERNAME/creative-approval-system/issues
- **Slack**: #creative-approval-system

---

**That's it! You're running the Creative Approval System locally.** 🚀

For production deployment to AWS, see [SETUP.md](./SETUP.md#production-deployment).
