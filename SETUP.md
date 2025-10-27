# Creative Approval System - Complete Setup Guide

This guide will walk you through setting up the Creative Approval Workflow Automation System from scratch to production deployment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Configuration](#configuration)
4. [Running the Application](#running-the-application)
5. [Accessing the Application](#accessing-the-application)
6. [Production Deployment](#production-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Docker Desktop** (latest version)
  - Download: https://www.docker.com/products/docker-desktop
  - Verify: `docker --version` and `docker-compose --version`

- **Git**
  - Verify: `git --version`

- **Node.js 20+** (optional, for local development outside Docker)
  - Download: https://nodejs.org/
  - Verify: `node --version` && `npm --version`

### Required Accounts & Credentials

1. **AWS Account** (for S3 file storage)
   - IAM user with S3 access
   - Access Key ID and Secret Access Key
   - S3 bucket created (e.g., `creative-approval-assets`)

2. **Google Workspace Account** (for Gmail API)
   - OAuth 2.0 credentials
   - Gmail API enabled
   - Service account or OAuth refresh token

3. **Celtra Account** (for creative tag integration)
   - API key
   - API documentation access

---

## Local Development Setup

### Step 1: Clone the Repository

```bash
# Clone from your GitHub account
git clone https://github.com/YOUR_USERNAME/creative-approval-system.git
cd creative-approval-system
```

### Step 2: Set Up AWS S3 Bucket

```bash
# Create S3 bucket (if not already created)
aws s3 mb s3://creative-approval-assets --region us-east-1

# Set bucket policy for private access
aws s3api put-bucket-policy --bucket creative-approval-assets --policy file://aws-s3-policy.json

# Enable CORS for direct browser uploads
aws s3api put-bucket-cors --bucket creative-approval-assets --cors-configuration file://aws-s3-cors.json
```

**aws-s3-policy.json**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPrivateAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:user/YOUR_IAM_USER"
      },
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::creative-approval-assets/*"
    }
  ]
}
```

**aws-s3-cors.json**:
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["http://localhost:3000", "https://approvals.kargo.com"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

### Step 3: Set Up Gmail API

#### Option A: Google Cloud Console Setup

1. Go to https://console.cloud.google.com/
2. Create new project: "Creative Approval System"
3. Enable Gmail API:
   - APIs & Services → Enable APIs and Services
   - Search "Gmail API" → Enable
4. Create OAuth 2.0 credentials:
   - APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:4000/api/auth/google/callback`
   - Save Client ID and Client Secret

#### Option B: Service Account Setup (Recommended for automation)

1. APIs & Services → Credentials → Create Credentials → Service Account
2. Grant "Gmail API User" role
3. Create key → JSON format → Download
4. Enable domain-wide delegation
5. In Google Workspace Admin:
   - Security → API Controls → Domain-wide Delegation
   - Add service account with scope: `https://www.googleapis.com/auth/gmail.send`

### Step 4: Get Celtra API Key

1. Log in to Celtra account
2. Navigate to Settings → API Access
3. Generate new API key
4. Copy key for environment variables

---

## Configuration

### Step 1: Create Environment File

```bash
# Copy example environment file
cp .env.example .env
```

### Step 2: Edit Environment Variables

Open `.env` in your text editor and fill in the required values:

```bash
# Database (leave as-is for local Docker)
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/creative_approval

# Redis (leave as-is for local Docker)
REDIS_URL=redis://redis:6379

# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA****************    # Your AWS access key
AWS_SECRET_ACCESS_KEY=**********************    # Your AWS secret key
S3_BUCKET=creative-approval-assets    # Your S3 bucket name

# Gmail API Configuration
GMAIL_CLIENT_ID=******.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-********************
GMAIL_REFRESH_TOKEN=1//**********************    # Get this after OAuth flow
GMAIL_FROM_EMAIL=approvals@kargo.com
GMAIL_FROM_NAME=Kargo Creative Approval System

# Celtra API
CELTRA_API_KEY=********************************    # Your Celtra API key

# Authentication
JWT_SECRET=$(openssl rand -base64 32)    # Generate random secret
GOOGLE_OAUTH_CLIENT_ID=******.apps.googleusercontent.com    # Same as Gmail Client ID
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-********************    # Same as Gmail Client Secret

# Application URLs (for local development)
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_BULK_OPERATIONS=true
ENABLE_CLIENT_PORTAL=true
ENABLE_CELTRA_INTEGRATION=true
```

### Step 3: Generate JWT Secret

```bash
# Generate secure random secret
openssl rand -base64 32
# Copy output and paste as JWT_SECRET in .env
```

---

## Running the Application

### Method 1: Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Check service status
docker-compose ps
```

### Method 2: Individual Services

```bash
# Start only database and Redis
docker-compose up -d postgres redis

# Run backend locally
cd backend
npm install
npm run dev

# In another terminal, run frontend locally
cd frontend
npm install
npm run dev
```

### Initial Setup Commands

```bash
# Wait for database to be ready (health check)
docker-compose logs postgres | grep "database system is ready"

# Run database migrations (first time only)
docker-compose exec backend npm run migrate

# Seed initial data (optional)
docker-compose exec backend npm run seed

# Create admin user manually
docker-compose exec postgres psql -U postgres -d creative_approval -c "
INSERT INTO users (email, full_name, role, active)
VALUES ('your.email@kargo.com', 'Your Name', 'admin', true)
ON CONFLICT DO NOTHING;
"
```

---

## Accessing the Application

### URLs

- **Frontend (React UI)**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **API Documentation**: http://localhost:4000/api-docs
- **Database**: `localhost:5432` (PostgreSQL)
- **Redis**: `localhost:6379`

### Default Login

1. Navigate to http://localhost:3000
2. Click "Sign in with Google"
3. Authenticate with your Google Workspace account
4. First user will be created automatically with `account_manager` role

### Creating Additional Users

```bash
# Via API
curl -X POST http://localhost:4000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "email": "newuser@kargo.com",
    "full_name": "New User",
    "role": "account_manager"
  }'

# Via Database
docker-compose exec postgres psql -U postgres -d creative_approval -c "
INSERT INTO users (email, full_name, role, active)
VALUES ('newuser@kargo.com', 'New User', 'account_manager', true);
"
```

---

## Production Deployment

### Option 1: AWS ECS Fargate (Recommended)

#### Prerequisites

- AWS account with appropriate permissions
- AWS CLI installed and configured
- ECR repository created

#### Step 1: Create ECR Repositories

```bash
# Create repository for backend
aws ecr create-repository --repository-name creative-approval-backend --region us-east-1

# Create repository for frontend
aws ecr create-repository --repository-name creative-approval-frontend --region us-east-1
```

#### Step 2: Build and Push Docker Images

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build backend
cd backend
docker build -t creative-approval-backend:latest --target production .
docker tag creative-approval-backend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/creative-approval-backend:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/creative-approval-backend:latest

# Build frontend
cd ../frontend
docker build -t creative-approval-frontend:latest --target production .
docker tag creative-approval-frontend:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/creative-approval-frontend:latest
docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/creative-approval-frontend:latest
```

#### Step 3: Create RDS PostgreSQL Database

```bash
aws rds create-db-instance \
  --db-instance-identifier creative-approval-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.4 \
  --allocated-storage 20 \
  --master-username postgres \
  --master-user-password YOUR_SECURE_PASSWORD \
  --vpc-security-group-ids sg-XXXXXXXX \
  --db-subnet-group-name your-subnet-group \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "mon:04:00-mon:05:00" \
  --region us-east-1
```

#### Step 4: Create ECS Cluster and Services

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name creative-approval-prod --region us-east-1

# Create task definition (see aws-ecs-task-definition.json)
aws ecs register-task-definition --cli-input-json file://aws-ecs-task-definition.json

# Create ECS service
aws ecs create-service \
  --cluster creative-approval-prod \
  --service-name creative-approval-backend \
  --task-definition creative-approval-backend:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx,subnet-yyyyy],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:targetgroup/creative-approval-backend/xxxxx,containerName=backend,containerPort=4000"
```

#### Step 5: Set Up Application Load Balancer

```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name creative-approval-alb \
  --subnets subnet-xxxxx subnet-yyyyy \
  --security-groups sg-xxxxx \
  --region us-east-1

# Create target groups
aws elbv2 create-target-group \
  --name creative-approval-backend \
  --protocol HTTP \
  --port 4000 \
  --vpc-id vpc-xxxxx \
  --target-type ip \
  --health-check-path /api/health

# Create listener rules
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:loadbalancer/app/creative-approval-alb/xxxxx \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:us-east-1:ACCOUNT_ID:targetgroup/creative-approval-backend/xxxxx
```

#### Step 6: Configure Environment Variables in ECS

```bash
# Store secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name creative-approval/prod \
  --secret-string '{
    "DATABASE_URL": "postgresql://postgres:PASSWORD@your-rds-endpoint.amazonaws.com:5432/creative_approval",
    "JWT_SECRET": "your-random-secret",
    "AWS_ACCESS_KEY_ID": "AKIA...",
    "AWS_SECRET_ACCESS_KEY": "...",
    "GMAIL_CLIENT_SECRET": "...",
    "CELTRA_API_KEY": "..."
  }'

# Reference in ECS task definition
```

### Option 2: Render.com (Simpler Alternative)

1. Create account at https://render.com
2. Connect GitHub repository
3. Create new Web Service:
   - **Name**: creative-approval-backend
   - **Environment**: Docker
   - **Dockerfile path**: ./backend/Dockerfile
   - **Instance type**: Starter ($7/month)
4. Create PostgreSQL database (Render managed)
5. Add environment variables from `.env.example`
6. Deploy

---

## Verification & Testing

### Health Checks

```bash
# Backend health check
curl http://localhost:4000/api/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-XX...",
  "checks": {
    "database": true,
    "redis": true,
    "s3": true
  }
}
```

### Database Connection

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d creative_approval

# Run test query
SELECT COUNT(*) FROM users;

# Exit
\q
```

### Test File Upload

```bash
# Get presigned S3 upload URL
curl -X POST http://localhost:4000/api/creatives/upload-url \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileName": "test.jpg", "fileType": "image/jpeg"}'

# Upload file to S3 using returned presigned URL
curl -X PUT "PRESIGNED_URL" \
  --upload-file test.jpg \
  -H "Content-Type: image/jpeg"
```

### Test Email Notification

```bash
# Trigger test email
curl -X POST http://localhost:4000/api/test/email \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to": "your.email@kargo.com", "template": "test"}'
```

---

## Troubleshooting

### Docker Issues

**Problem**: Containers won't start
```bash
# Check Docker daemon
docker info

# Check container logs
docker-compose logs backend

# Restart Docker Desktop
# macOS: Docker icon → Restart
```

**Problem**: Port already in use
```bash
# Find process using port
lsof -i :4000

# Kill process
kill -9 PID

# Or change port in docker-compose.yml
```

### Database Issues

**Problem**: Database connection refused
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check health
docker-compose exec postgres pg_isready -U postgres

# Restart database
docker-compose restart postgres
```

**Problem**: Migrations failed
```bash
# Check migration status
docker-compose exec postgres psql -U postgres -d creative_approval -c "SELECT * FROM pg_tables WHERE schemaname='public';"

# Manually run migrations
docker-compose exec backend npm run migrate

# Reset database (DANGER: deletes all data)
docker-compose down -v
docker-compose up -d postgres
docker-compose exec backend npm run migrate
```

### AWS S3 Issues

**Problem**: Access Denied errors
```bash
# Verify IAM permissions
aws s3 ls s3://creative-approval-assets

# Test bucket access
aws s3 cp test.txt s3://creative-approval-assets/test.txt
aws s3 rm s3://creative-approval-assets/test.txt

# Check CORS configuration
aws s3api get-bucket-cors --bucket creative-approval-assets
```

### Gmail API Issues

**Problem**: Gmail authentication failed
```bash
# Test OAuth token
curl https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=YOUR_TOKEN

# Refresh token
# See: https://developers.google.com/identity/protocols/oauth2/web-server#offline
```

**Problem**: Emails not sending
```bash
# Check email logs in database
docker-compose exec postgres psql -U postgres -d creative_approval -c "SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT 10;"

# Enable debug logging
# In .env: LOG_LEVEL=debug
docker-compose restart backend
```

### Frontend Issues

**Problem**: API calls failing (CORS errors)
```bash
# Check backend CORS configuration
# In .env: CORS_ORIGIN=http://localhost:3000

# Restart backend
docker-compose restart backend
```

**Problem**: Frontend not loading
```bash
# Check frontend logs
docker-compose logs frontend

# Clear browser cache
# Chrome: Cmd+Shift+Delete

# Rebuild frontend
docker-compose build frontend
docker-compose up -d frontend
```

---

## Support

For additional help:

- **Email**: brandon.nye@kargo.com
- **GitHub Issues**: https://github.com/YOUR_USERNAME/creative-approval-system/issues
- **Kargo Internal Slack**: #creative-approval-system

---

## Next Steps

Once the system is running:

1. ✅ Create your first campaign
2. ✅ Send client portal invite
3. ✅ Test creative upload workflow
4. ✅ Test approval flow
5. ✅ Verify tag generation
6. ✅ Review analytics dashboard

See [USER_GUIDE.md](./USER_GUIDE.md) for detailed usage instructions.
