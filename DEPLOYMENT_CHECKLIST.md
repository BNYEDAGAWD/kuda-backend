# Creative Approval System - Deployment Checklist

Complete this checklist before deploying to production.

## Pre-Deployment

### Code & Repository

- [ ] All code committed to `main` branch
- [ ] No sensitive data in codebase (API keys, passwords)
- [ ] `.env` file NOT committed (in `.gitignore`)
- [ ] README.md up to date with latest features
- [ ] CHANGELOG.md updated with version notes
- [ ] All TODOs resolved or documented

### Testing

- [ ] All unit tests passing (`npm test`)
- [ ] Integration tests passing (`npm run test:integration`)
- [ ] Manual QA completed for critical workflows:
  - [ ] Campaign creation
  - [ ] Client portal access
  - [ ] Creative upload
  - [ ] Approval workflow (approve/reject/changes)
  - [ ] Tag generation
  - [ ] Email notifications
  - [ ] Bulk operations
- [ ] Load testing completed (50+ concurrent users)
- [ ] Security audit performed

### Infrastructure

- [ ] AWS account configured with proper IAM roles
- [ ] S3 bucket created and accessible
- [ ] RDS PostgreSQL instance created
- [ ] Redis instance configured (ElastiCache or separate)
- [ ] VPC and security groups configured
- [ ] SSL/TLS certificates obtained (ACM or Let's Encrypt)
- [ ] Domain names configured:
  - [ ] `approvals.kargo.com` → Frontend
  - [ ] `api-approvals.kargo.com` → Backend
- [ ] CDN configured (CloudFront optional)

### Environment Variables

- [ ] Production `.env` file created (NOT in repo)
- [ ] All secrets stored in AWS Secrets Manager or Parameter Store
- [ ] Database connection string updated for RDS
- [ ] JWT secret generated (32+ characters)
- [ ] AWS credentials configured
- [ ] Gmail API credentials valid
- [ ] Celtra API key tested
- [ ] Frontend/Backend URLs updated to production domains

### Database

- [ ] Production database created in RDS
- [ ] Database migrations tested on staging
- [ ] Backup schedule configured (daily minimum)
- [ ] Point-in-time recovery enabled
- [ ] Database users created with minimal permissions
- [ ] Connection pooling configured

### Monitoring & Logging

- [ ] CloudWatch Logs configured
- [ ] CloudWatch Alarms set up:
  - [ ] High CPU usage (>80%)
  - [ ] High memory usage (>80%)
  - [ ] Database connection errors
  - [ ] 5xx error rate
  - [ ] Email delivery failures
- [ ] Application logs sent to centralized logging (CloudWatch/Logtail)
- [ ] Error tracking configured (Sentry optional)
- [ ] Uptime monitoring configured (UptimeRobot/Pingdom)

### Security

- [ ] HTTPS enforced (redirect HTTP to HTTPS)
- [ ] Security headers configured (helmet.js)
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] SQL injection protection verified (parameterized queries)
- [ ] XSS protection enabled
- [ ] CSRF tokens implemented (if using cookies)
- [ ] File upload validation (type, size, malware scan)
- [ ] API authentication tested (JWT)
- [ ] OAuth flow tested (Google Workspace)
- [ ] Client portal token expiration tested

## Deployment Steps

### 1. Build Docker Images

```bash
# Build backend
cd backend
docker build -t creative-approval-backend:v1.0.0 --target production .

# Build frontend
cd ../frontend
docker build -t creative-approval-frontend:v1.0.0 --target production .
```

- [ ] Backend image built successfully
- [ ] Frontend image built successfully
- [ ] Images tagged with version number

### 2. Push to Container Registry

```bash
# ECR login
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Tag images
docker tag creative-approval-backend:v1.0.0 ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/creative-approval-backend:v1.0.0
docker tag creative-approval-frontend:v1.0.0 ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/creative-approval-frontend:v1.0.0

# Push images
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/creative-approval-backend:v1.0.0
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/creative-approval-frontend:v1.0.0
```

- [ ] Images pushed to ECR
- [ ] Image vulnerabilities scanned
- [ ] Image size acceptable (<500MB)

### 3. Database Migration

```bash
# Connect to production database
export DATABASE_URL="postgresql://user:pass@prod-db.amazonaws.com:5432/creative_approval"

# Run migrations (dry run first)
npm run migrate -- --dry-run

# Run actual migrations
npm run migrate
```

- [ ] Migrations tested on staging first
- [ ] Database backup taken before migration
- [ ] Migrations completed successfully
- [ ] Data integrity verified post-migration

### 4. Deploy to ECS/Fargate

```bash
# Update ECS service with new image
aws ecs update-service \
  --cluster creative-approval-prod \
  --service creative-approval-backend \
  --task-definition creative-approval-backend:2 \
  --force-new-deployment
```

- [ ] ECS task definition updated
- [ ] Service deployed successfully
- [ ] Health checks passing
- [ ] Old tasks drained gracefully

### 5. Frontend Deployment

```bash
# If using S3 + CloudFront
npm run build
aws s3 sync dist/ s3://approvals.kargo.com --delete
aws cloudfront create-invalidation --distribution-id XXXXX --paths "/*"
```

- [ ] Frontend built for production
- [ ] Assets uploaded to S3/hosting
- [ ] CDN cache invalidated
- [ ] DNS records updated

## Post-Deployment

### Verification

- [ ] Frontend accessible at production URL
- [ ] Backend health check endpoint responding (`/api/health`)
- [ ] Database connection working
- [ ] Redis connection working
- [ ] S3 file upload working
- [ ] Gmail API sending emails
- [ ] Celtra API integration working
- [ ] OAuth login flow working
- [ ] Client portal token generation working

### Smoke Tests

- [ ] Create test campaign
- [ ] Generate client portal link
- [ ] Upload test creative via portal
- [ ] Approve creative
- [ ] Verify tag generation
- [ ] Check email notifications sent
- [ ] Test bulk approve (5+ creatives)
- [ ] View analytics dashboard

### Performance

- [ ] Page load times <3 seconds
- [ ] API response times <500ms (avg)
- [ ] File uploads complete successfully
- [ ] No memory leaks (monitor for 24 hours)
- [ ] Database queries optimized (no N+1 issues)

### User Acceptance

- [ ] Notify stakeholders of deployment
- [ ] Provide access credentials to initial users
- [ ] Conduct walkthrough session with account managers
- [ ] Gather feedback from first 5 users
- [ ] Document any issues reported

### Documentation

- [ ] Production URL shared with team
- [ ] User guide published
- [ ] API documentation updated
- [ ] Deployment runbook created
- [ ] Incident response plan documented

## Rollback Plan

In case of critical issues:

```bash
# Revert to previous ECS task definition
aws ecs update-service \
  --cluster creative-approval-prod \
  --service creative-approval-backend \
  --task-definition creative-approval-backend:1

# Rollback database migration
npm run migrate:rollback

# Revert frontend
aws s3 sync s3://approvals.kargo.com-backup/ s3://approvals.kargo.com/
```

- [ ] Previous Docker images still available in ECR
- [ ] Database backup accessible (< 1 hour old)
- [ ] Previous frontend build backed up
- [ ] Rollback procedure tested on staging

## Monitoring (First 48 Hours)

- [ ] Check error logs every 4 hours
- [ ] Monitor CPU/memory usage
- [ ] Track API error rates
- [ ] Review email delivery logs
- [ ] Check user feedback channels
- [ ] Verify no data loss
- [ ] Confirm all integrations working

## Post-Launch

### Week 1

- [ ] Daily monitoring of error logs
- [ ] Gather user feedback
- [ ] Address critical bugs within 24 hours
- [ ] Document workarounds for known issues
- [ ] Plan hotfix releases if needed

### Week 2-4

- [ ] Review analytics and usage patterns
- [ ] Optimize slow queries
- [ ] Address user feedback
- [ ] Plan feature enhancements
- [ ] Schedule regular maintenance windows

## Success Metrics

Track these KPIs post-launch:

- **Uptime**: >99.5%
- **Avg Approval Time**: <8 hours (target: reduce 70% from manual process)
- **Email Delivery Rate**: >98%
- **User Adoption**: 90%+ of creatives submitted via system within 30 days
- **Tag Generation Success**: 100% (no manual intervention)
- **API Error Rate**: <1%
- **Page Load Time**: <3 seconds
- **User Satisfaction**: >4/5 stars

---

## Sign-Off

Deployment completed by: _______________________________

Date: _______________________________

Production URL: https://approvals.kargo.com

Verified by:

- [ ] Engineering Lead: _______________________________
- [ ] Product Owner: _______________________________
- [ ] Operations: _______________________________

**Next review date**: _______________________________
