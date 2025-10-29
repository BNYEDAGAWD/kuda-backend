# 🚀 KUDA - Ready for Frontend Development

[![Backend CI](https://img.shields.io/badge/Backend-Ready-success)](./ENGINEERING_HANDOFF.md)
[![API Docs](https://img.shields.io/badge/API%20Docs-23%20Endpoints-blue)](http://localhost:4000/api-docs)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](./docker-compose.yml)
[![License](https://img.shields.io/badge/License-Proprietary-red)](./LICENSE)

**Kargo Unified Design Approval (KUDA)** - Production-ready backend API with complete Docker orchestration for seamless frontend integration.

---

## ⚡ Quick Start (< 2 Minutes)

```bash
# 1. Clone repository
git clone <repository_url>
cd kargo-creative-approval-system

# 2. Start entire environment (one command)
./quickstart.sh

# 3. Verify backend is running
curl http://localhost:4000/health

# 4. Open API documentation
open http://localhost:4000/api-docs
```

**That's it!** Backend API is ready at `http://localhost:4000`

---

## 📦 What's Included

### ✅ Backend API (100% Complete)

- **23 RESTful API endpoints** (Phase 1 + Phase 2)
- **JWT authentication** + three-tier access control
- **Smart notification timing** (Tue-Thu 10AM-4PM algorithm)
- **Email threading** (Gmail API integration)
- **Auto-generated changelogs** (revision tracking)
- **PostgreSQL + Redis** (fully configured)
- **OpenAPI/Swagger** documentation
- **Postman collection** for testing

### ✅ Docker Environment (Plug-and-Play)

| Service | Port | Purpose |
|---------|------|---------|
| **Backend API** | 4000 | REST API |
| **PostgreSQL** | 5432 | Database |
| **Redis** | 6379 | Cache/Sessions |
| **pgAdmin** | 5050 | DB Management |
| **Redis Commander** | 8081 | Redis UI |
| **LocalStack** | 4566 | S3 Mock |

### ✅ Documentation (Complete)

- **[Engineering Handoff](./ENGINEERING_HANDOFF.md)** - Start here!
- **[API Documentation](./KUDA_PHASE2_API_DOCUMENTATION.md)** - All 23 endpoints
- **[Phase 2 Complete](./KUDA_PHASE2_COMPLETE.md)** - Implementation details
- **[Deployment Guide](./KUDA_PHASE2_DEPLOYMENT_STATUS.md)** - Production deployment

### ✅ Development Tools

- **[Postman Collection](./postman-collection.json)** - Import and test APIs
- **[Automated Tests](./test-phase2.sh)** - 50+ backend tests
- **[Quickstart Script](./quickstart.sh)** - One-command setup
- **[CI/CD Workflows](./.github/workflows/)** - GitHub Actions

---

## 🎯 Your Mission: Build the Frontend

### What We Need

A modern, responsive **web frontend** that connects to our API endpoints:

1. **Campaign Dashboard** - List/manage campaigns
2. **Access Control UI** - Grant/revoke access (Kuda Ocean only)
3. **Notification Center** - View smart-timed notifications
4. **Email Thread Viewer** - Campaign email timeline
5. **Revision Changelog** - "What changed" display
6. **Asset Pack Upload** - Drag-and-drop interface
7. **Deliverable Review** - Approve/reject creatives

### Recommended Stack

- **Framework**: React 18+ (or Next.js 14+)
- **State**: Redux Toolkit / Zustand / React Query
- **Styling**: Tailwind CSS / Material-UI
- **Build Tool**: Vite / Next.js
- **Testing**: Jest + React Testing Library

### API Integration Example

```typescript
// TypeScript example - Fetch user permissions
const fetchPermissions = async (campaignId: string) => {
  const response = await fetch(
    `http://localhost:4000/api/campaigns/${campaignId}/access/me`,
    {
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const { permissions } = await response.json();

  // Use permissions to show/hide UI elements
  return permissions;
};
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────┐
│   Frontend (Your Work)          │
│   React / Next.js / Vue         │
│   Port: 3000                    │
└────────────┬────────────────────┘
             │ REST API
┌────────────┴────────────────────┐
│   Backend API (Ready)           │
│   Node.js + TypeScript          │
│   Port: 4000                    │
├─────────────────────────────────┤
│   PostgreSQL   │   Redis        │
│   Port: 5432   │   Port: 6379   │
└─────────────────────────────────┘
```

---

## 📚 Documentation Index

### Getting Started
1. **[Engineering Handoff](./ENGINEERING_HANDOFF.md)** ⭐ **START HERE**
2. **[Quick Start Guide](#-quick-start--2-minutes)** - This file

### API Reference
3. **[API Documentation](./KUDA_PHASE2_API_DOCUMENTATION.md)** - All 23 endpoints
4. **[Swagger UI](http://localhost:4000/api-docs)** - Interactive docs (after startup)
5. **[Postman Collection](./postman-collection.json)** - API testing

### Implementation Details
6. **[Phase 2 Complete](./KUDA_PHASE2_COMPLETE.md)** - Features & architecture
7. **[Deployment Status](./KUDA_PHASE2_DEPLOYMENT_STATUS.md)** - Infrastructure setup
8. **[Backend README](./backend/README.md)** - Backend-specific docs

### Testing & CI/CD
9. **[Testing Guide](./test-phase2.sh)** - Automated tests
10. **[CI/CD Workflows](./.github/workflows/)** - GitHub Actions

---

## 🔐 Authentication Flow

### JWT Token Authentication

```typescript
// 1. User logs in
POST /api/auth/login
{
  "email": "user@kargo.com",
  "password": "password"
}

// 2. Receive JWT token
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "email": "user@kargo.com", "name": "John Doe" }
}

// 3. Include token in all requests
GET /api/campaigns/{{campaign_id}}/access/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Three-Tier Access Control

| Tier | Users | Permissions |
|------|-------|-------------|
| **Kuda Ocean** | AMs, Designers, Engineers | All 14 permissions (full control) |
| **Kuda River** | Client Stakeholders | Approve/reject deliverables only |
| **Kuda Minnow** | Observers | View-only access |

---

## 🧪 Testing the API

### Option 1: Swagger UI (Recommended)

```bash
# Start backend
./quickstart.sh

# Open browser
open http://localhost:4000/api-docs

# Click "Authorize", enter JWT token, test endpoints
```

### Option 2: Postman

```bash
# Import collection
# File -> Import -> postman-collection.json

# Set environment variables:
# - base_url: http://localhost:4000
# - jwt_token: <your_token>

# Run requests
```

### Option 3: cURL

```bash
# Health check (no auth required)
curl http://localhost:4000/health

# Get campaign access (auth required)
curl http://localhost:4000/api/campaigns/test-id/access/me \
  -H "Authorization: Bearer <your_token>"
```

---

## 🚢 Deployment

### Development (Local)

```bash
# One command
./quickstart.sh

# Or manual
docker-compose up -d
```

### Staging

```bash
# Build and push
docker-compose -f docker-compose.production.yml build
docker-compose -f docker-compose.production.yml push

# Deploy (configure your deployment target)
```

### Production

See **[Deployment Guide](./KUDA_PHASE2_DEPLOYMENT_STATUS.md)** for:
- AWS ECS/Fargate setup
- Google Cloud Run deployment
- Kubernetes manifests
- Environment configuration

---

## 🐛 Troubleshooting

### Backend not starting?

```bash
# View logs
docker-compose logs -f backend

# Restart
docker-compose restart backend
```

### Database issues?

```bash
# Check PostgreSQL
docker-compose exec postgres pg_isready -U postgres

# View database
docker-compose exec postgres psql -U postgres -d kuda_dev
```

### Need to reset everything?

```bash
# Stop and remove all data
./quickstart.sh --clean

# Start fresh
./quickstart.sh
```

---

## 📊 Project Stats

- **Backend Code**: 6,300+ lines (TypeScript)
- **API Endpoints**: 23 (fully documented)
- **Database Tables**: 11 (Phase 1 + Phase 2)
- **Automated Tests**: 50+
- **Docker Services**: 6 (development)
- **Documentation**: 9 comprehensive files
- **Postman Requests**: 24

---

## 🤝 Team Handoff

### Backend Team (Complete ✅)

- [x] 23 API endpoints implemented
- [x] Database schema & migrations
- [x] Authentication & authorization
- [x] Docker Compose setup
- [x] Testing suite (50+ tests)
- [x] OpenAPI/Swagger docs
- [x] Postman collection
- [x] Engineering documentation
- [x] CI/CD workflows

### Frontend Team (Your Turn 🎯)

- [ ] Choose frontend framework
- [ ] Set up project structure
- [ ] Implement authentication
- [ ] Build campaign dashboard
- [ ] Implement access control UI
- [ ] Build notification center
- [ ] Create email thread viewer
- [ ] Implement changelog display
- [ ] Write frontend tests
- [ ] Deploy to staging
- [ ] Deploy to production

---

## 📞 Support

**Technical Questions**: See [Engineering Handoff](./ENGINEERING_HANDOFF.md)

**API Reference**: http://localhost:4000/api-docs

**Bug Reports**: GitHub Issues

**Slack**: #kuda-dev

---

## ⚡ Quick Commands

```bash
# Start all services
./quickstart.sh

# Stop all services
./quickstart.sh --stop

# Clean and reset
./quickstart.sh --clean

# View backend logs
docker-compose logs -f backend

# Run tests
./test-phase2.sh

# Access database
docker-compose exec postgres psql -U postgres -d kuda_dev

# Access Redis
docker-compose exec redis redis-cli -a devpassword
```

---

## 🎉 You're All Set!

1. ✅ **Backend is ready** - 23 API endpoints at your disposal
2. ✅ **Docker environment is configured** - One-command startup
3. ✅ **Documentation is complete** - Everything you need to know
4. ✅ **Tools are provided** - Postman, Swagger, automated tests

**Now go build an amazing frontend! 🚀**

Start with: **[ENGINEERING_HANDOFF.md](./ENGINEERING_HANDOFF.md)**

---

**Questions?** Read the docs first, then reach out on Slack (#kuda-dev)

**Good luck!** 🍀
