# Creative Approval Workflow Automation System

> Streamline creative approval workflows for programmatic advertising campaigns - from client upload to tag generation, all in one platform.

## Overview

This system automates the end-to-end creative approval process for Kargo's programmatic advertising campaigns, eliminating manual email chains and reducing approval cycle time from days to hours.

### Key Features

- **Campaign Setup & Client Invites**: Kargo account managers create campaigns and send secure upload links to clients
- **Client Portal**: Token-based, no-login-required upload interface for external clients
- **Approval Workflow**: Streamlined approve/reject/request changes interface for internal team
- **Automated Notifications**: Gmail API integration for all workflow events
- **Tag Generation**: Automatic HTML tag creation with Celtra measurement pixel integration
- **Real-time Dashboard**: Live view of pending approvals, metrics, and performance analytics
- **Bulk Operations**: Process multiple creatives simultaneously
- **Complete Audit Trail**: Full history of all actions with timestamps and actors

## Tech Stack

- **Backend**: Node.js 20 + Express.js + TypeScript
- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Storage**: AWS S3
- **Email**: Gmail API (Google Workspace)
- **Integration**: Celtra API
- **Infrastructure**: Docker + Docker Compose

## Quick Start

### Prerequisites

- Docker Desktop (for Mac)
- Node.js 20+ (for local development outside Docker)
- AWS account (for S3 storage)
- Google Workspace account (for Gmail API)
- Celtra API credentials

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/creative-approval-system.git
cd creative-approval-system
```

2. **Configure environment variables**

```bash
cp .env.example .env
# Edit .env with your actual credentials
```

3. **Start all services**

```bash
docker-compose up -d
```

4. **Run database migrations**

```bash
docker-compose exec backend npm run migrate
```

5. **Access the application**

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- API Docs: http://localhost:4000/api-docs

### First-Time Setup

```bash
# Seed initial admin user
docker-compose exec backend npm run seed

# View logs
docker-compose logs -f backend
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                        │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Frontend   │  │   Backend    │  │  PostgreSQL  │  │
│  │   (React)    │  │  (Node.js)   │  │              │  │
│  │   Port 3000  │  │   Port 4000  │  │   Port 5432  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                          │                               │
│                    ┌─────┴─────┐                        │
│                    │   Redis   │                        │
│                    │ Port 6379 │                        │
│                    └───────────┘                        │
└─────────────────────────────────────────────────────────┘
         │                    │                   │
         ▼                    ▼                   ▼
    AWS S3             Gmail API          Celtra API
  (File Storage)    (Notifications)   (Tag Retrieval)
```

## Project Structure

```
creative-approval-system/
├── backend/              # Node.js API server
│   ├── src/
│   │   ├── config/       # Configuration files
│   │   ├── middleware/   # Express middleware
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   ├── models/       # Data models
│   │   ├── types/        # TypeScript types
│   │   ├── utils/        # Helper functions
│   │   └── templates/    # Email templates
│   ├── migrations/       # Database migrations
│   ├── tests/            # Unit & integration tests
│   ├── Dockerfile
│   └── package.json
│
├── frontend/             # React web application
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── services/     # API client
│   │   ├── hooks/        # Custom React hooks
│   │   └── context/      # React context providers
│   ├── Dockerfile
│   └── package.json
│
├── docker/               # Docker configuration
│   └── nginx.conf        # Reverse proxy config
│
├── docker-compose.yml    # Local development stack
└── .env.example          # Environment variables template
```

## Development

### Running Tests

```bash
# Backend unit tests
docker-compose exec backend npm test

# Backend integration tests
docker-compose exec backend npm run test:integration

# Frontend tests
docker-compose exec frontend npm test
```

### Database Operations

```bash
# Create new migration
docker-compose exec backend npm run migration:create -- add_new_feature

# Run migrations
docker-compose exec backend npm run migrate

# Rollback migration
docker-compose exec backend npm run migrate:rollback

# Access PostgreSQL CLI
docker-compose exec postgres psql -U postgres -d creative_approval
```

### Debugging

```bash
# Backend logs
docker-compose logs -f backend

# Database logs
docker-compose logs -f postgres

# Enter backend container shell
docker-compose exec backend sh
```

## API Documentation

Interactive API documentation available at: http://localhost:4000/api-docs

### Key Endpoints

#### Authentication
- `POST /api/auth/google` - Google OAuth login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

#### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `POST /api/campaigns/:id/invite` - Generate client portal link

#### Creatives
- `GET /api/creatives` - List creatives
- `POST /api/creatives` - Upload creative
- `POST /api/creatives/:id/approve` - Approve creative
- `POST /api/creatives/:id/reject` - Reject creative
- `POST /api/creatives/bulk-approve` - Bulk approve

#### Tags
- `GET /api/tags/:creativeId` - Get generated tags
- `POST /api/tags/:creativeId/regenerate` - Regenerate tags

#### Client Portal
- `GET /api/portal/:token/campaign` - Get campaign details
- `POST /api/portal/:token/upload` - Upload creative

#### Analytics
- `GET /api/analytics/dashboard/metrics` - Dashboard metrics
- `GET /api/analytics/summary` - Approval analytics

## Deployment

### AWS ECS Fargate (Production)

1. **Build and push Docker images**

```bash
# Build images
docker build -t creative-approval-backend ./backend
docker build -t creative-approval-frontend ./frontend

# Tag for ECR
docker tag creative-approval-backend:latest YOUR_ECR_URL/creative-approval-backend:latest
docker tag creative-approval-frontend:latest YOUR_ECR_URL/creative-approval-frontend:latest

# Push to ECR
docker push YOUR_ECR_URL/creative-approval-backend:latest
docker push YOUR_ECR_URL/creative-approval-frontend:latest
```

2. **Create RDS PostgreSQL instance**

```bash
aws rds create-db-instance \
  --db-instance-identifier creative-approval-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --allocated-storage 20 \
  --master-username postgres \
  --master-user-password YOUR_PASSWORD
```

3. **Deploy ECS service**
   - Use AWS Console or provided CloudFormation template
   - Configure environment variables in ECS task definition
   - Set up Application Load Balancer

### Estimated Monthly Cost (AWS)

- ECS Fargate (2 tasks): ~$30
- RDS PostgreSQL (db.t3.micro): ~$15
- Application Load Balancer: ~$20
- S3 Storage (500GB): ~$12
- Data Transfer: ~$10

**Total: ~$87/month**

## Environment Variables

See [`.env.example`](.env.example) for complete list.

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/creative_approval

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
S3_BUCKET=creative-approval-assets

# Gmail API
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REFRESH_TOKEN=your_refresh_token

# Celtra API
CELTRA_API_KEY=your_celtra_key

# Auth
JWT_SECRET=your_random_secret
GOOGLE_OAUTH_CLIENT_ID=your_oauth_client_id
```

## User Roles

### Admin
- Full system access
- User management
- System configuration

### Account Manager (Kargo Team)
- Create campaigns
- Send client invites
- Approve/reject creatives
- Generate tags
- View analytics

### Client (External)
- Access portal via token link
- Upload creative assets
- View approval status
- Receive email notifications

## Workflow Example

1. **Kargo Account Manager** creates campaign for "Amazon Q1 2024"
2. System generates secure client portal link (30-day expiration)
3. Email sent to **client** with upload instructions
4. **Client** clicks link, uploads creative assets (images/videos)
5. **Kargo team** receives email notification of new upload
6. **Account Manager** reviews creative in dashboard
7. **Account Manager** approves creative
8. System auto-generates HTML tags with Celtra measurement pixels
9. **Account Manager** copies tags to DSP platform
10. **Client** receives approval confirmation email

## Support

For issues or questions:
- Email: brandon.nye@kargo.com
- GitHub Issues: [Create issue](https://github.com/YOUR_USERNAME/creative-approval-system/issues)

## License

Proprietary - Kargo Global Inc.

## Roadmap

### MVP (Current)
- ✅ Campaign setup
- ✅ Client portal
- ✅ Approval workflow
- ✅ Email notifications
- ✅ Tag generation
- ✅ Analytics dashboard
- ✅ Bulk operations

### Future Enhancements
- AI-powered brand safety detection
- Slack integration
- Mobile app (iOS/Android)
- Advanced analytics & reporting
- DSP platform auto-upload
- Multi-language support
- Custom approval chains
- Video creative preview

---

**Built with ❤️ by Kargo Engineering**
