# Kargo Creative Approval Platform (KCAP)

## Overview

KCAP is a comprehensive creative production and approval workflow platform designed specifically for Kargo's high-impact ad format production pipeline.

**Core Workflow:**
> Client uploads source materials → Kargo builds creatives → Client approves deliverables

## Project Status

### ✅ Backend Foundation - COMPLETE
- Complete database schema (11 tables)
- Complete service layer (6 services)
- Complete API layer (5 route files, 35+ endpoints)
- 21 Kargo formats seeded with device metadata
- Critical features fully implemented

### 🚧 In Development
- Authentication & authorization
- Email template system
- Frontend client portal
- Frontend AM dashboard
- Testing suite

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- AWS S3 account (for file storage)
- Gmail API credentials (for notifications)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd creative-approval-system/backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Setup database
psql -U postgres
CREATE DATABASE kcap;
\c kcap
\i migrations/100_kcap_complete_schema.sql
\i migrations/101_seed_format_library.sql

# Start development server
npm run dev
```

### Verify Installation

```bash
# Health check
curl http://localhost:4000/health

# API discovery
curl http://localhost:4000/
```

Expected response:
```json
{
  "name": "Kargo Creative Approval Platform (KCAP) API",
  "version": "2.0.0",
  "status": "running",
  "workflow": "Client uploads assets → Kargo builds creatives → Client approves",
  "endpoints": {
    "campaigns": "/api/campaigns",
    "assetPacks": "/api/asset-packs",
    "deliverables": "/api/deliverables",
    "approvals": "/api/approvals",
    "slaTimers": "/api/sla-timers"
  }
}
```

## Architecture

### Technology Stack

**Backend:**
- Node.js + TypeScript
- Express.js (REST API)
- PostgreSQL (primary database)
- AWS S3 (file storage)
- Gmail API (notifications)

**Libraries:**
- AdmZip (ZIP extraction)
- Multer (file uploads)
- Helmet (security)
- Morgan (logging)

### Database Schema

**Core Tables:**
1. `format_library` - 21 Kargo high-impact formats
2. `campaigns` - Campaign management
3. `campaign_formats` - Campaign ↔ Format relationships

**Asset Pack Workflow:**
4. `asset_packs` - Client-uploaded source materials
5. `asset_pack_files` - Individual files with categorization

**Deliverable Workflow:**
6. `deliverables` - Static mocks & animated creatives
7. `deliverable_demo_urls` - Per-device demo URLs
8. `deliverable_revisions` - Version history

**Approval & SLA:**
9. `format_approvals` - Hybrid approval tracking
10. `sla_timers` - 48h/24h countdown timers
11. `portal_notifications` - Client notifications

### Service Layer

```
services/
├── format.service.ts        # Format library & validation
├── campaign.service.ts      # Campaign management
├── asset-pack.service.ts    # Client uploads & AM review
├── deliverable.service.ts   # Static mocks & animated
├── approval.service.ts      # Hybrid approval logic
├── sla-timer.service.ts     # Countdown tracking
└── notification.service.ts  # Portal notifications
```

### API Routes

```
routes/
├── campaign.routes.ts       # Campaign CRUD & format selection
├── asset-pack.routes.ts     # Upload, review, approve/reject
├── deliverable.routes.ts    # Demo URLs, revisions, status
├── approval.routes.ts       # Format/device approval/rejection
└── sla.routes.ts           # Timer management & adjustments
```

## Key Features

### 1. ZIP Extraction
Automatic extraction of ZIP files with individual file upload to S3.

### 2. File Auto-Categorization
Smart categorization: logo, image, copy, brand_guide, font, other

### 3. Mandatory Rejection Feedback
Database-level enforcement ensures all rejections include detailed feedback.

### 4. Hybrid Approval
Clients can approve entire formats OR individual device views (desktop, mobile, tablet).

### 5. SLA Timer System
Automatic deadline calculation with AM adjustment capability.

### 6. Demo URL Per Device
Track multiple demo URLs per format, one per supported device.

### 7. Revision History
Complete version tracking with R1.x versioning.

## 21 Kargo High-Impact Formats

### Cross-Platform (15 formats)
Desktop, Mobile, Tablet support:
- Venti Video, Venti Display, Venti Video Shoppable Carousel
- Runway Video, Runway Display, Runway Core, Runway Wheel Core
- Spotlight Video, Spotlight Display
- Breakaway Display
- Enhance Pre-Roll OLV, Interactive Pre-Roll
- Top Banner, Middle Banner, Uptick

### Mobile-Only (2 formats)
- Lighthouse Display
- Lighthouse Video

### CTV-Only (4 formats)
- Enhanced CTV with Branded Canvas
- Enhanced CTV Mirage
- Enhanced CTV Tiles
- Enhanced CTV Flipbook

## Workflow

### Phase 1: Asset Pack Submission & Review
1. Client receives email with portal link
2. Client uploads asset pack (files or ZIP)
3. System extracts and categorizes files
4. AM reviews with design team
5. AM approves (starts 48h SLA) OR rejects (sends feedback email)

### Phase 2: Static Mock Production & Approval
1. Designers build static mocks (48h SLA)
2. AM uploads Google Slides or Dropbox link
3. Client reviews and approves/requests changes
4. 24h revision SLA for changes

### Phase 3: Animated Production & Approval
1. Designers build animated creatives (48h SLA)
2. AM uploads Celtra demo URLs per device
3. Client reviews and approves/requests changes
4. 24h revision SLA for changes
5. Once approved → Ready for trafficking

## Documentation

- **[KCAP_BACKEND_COMPLETE.md](KCAP_BACKEND_COMPLETE.md)** - Complete implementation guide
- **[VERIFICATION_CHECKLIST.md](backend/VERIFICATION_CHECKLIST.md)** - Testing guide
- **[API_REFERENCE.md](backend/API_REFERENCE.md)** - API endpoint reference
- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - High-level overview

## API Examples

### Create Campaign
```bash
curl -X POST http://localhost:4000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_name": "Prime Day 2024",
    "client_name": "Amazon",
    "client_email": "marketing@amazon.com",
    "account_manager_name": "John Doe",
    "account_manager_email": "john@kargo.com"
  }'
```

### Upload Asset Pack
```bash
curl -X POST http://localhost:4000/api/asset-packs \
  -F "campaign_id={uuid}" \
  -F "uploaded_by_email=client@amazon.com" \
  -F "files=@logo.png" \
  -F "files=@assets.zip"
```

### Approve Format
```bash
curl -X POST http://localhost:4000/api/approvals/format/approve \
  -H "Content-Type: application/json" \
  -d '{
    "deliverable_id": "{uuid}",
    "format_id": "{uuid}",
    "reviewed_by": "client@amazon.com"
  }'
```

### Reject with Feedback
```bash
curl -X POST http://localhost:4000/api/approvals/device/reject \
  -H "Content-Type: application/json" \
  -d '{
    "deliverable_id": "{uuid}",
    "format_id": "{uuid}",
    "device": "mobile",
    "reviewed_by": "client@amazon.com",
    "feedback": "Logo cut off on mobile. Please adjust positioning."
  }'
```

## Development

### Scripts
```bash
npm run dev          # Start development server with hot reload
npm run build        # Compile TypeScript to JavaScript
npm start            # Start production server
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
npm test             # Run test suite (when implemented)
```

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/kcap

# Server
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# AWS S3
AWS_S3_BUCKET=kcap-assets
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret

# Gmail API
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_secret
GMAIL_REFRESH_TOKEN=your_token
```

## Testing

### Health Check
```bash
curl http://localhost:4000/health
```

### API Discovery
```bash
curl http://localhost:4000/
```

### Database Verification
```bash
psql -U postgres -d kcap -c "SELECT COUNT(*) FROM format_library;"
# Expected: 21
```

## Contributing

### Code Style
- TypeScript with strict mode
- ESLint + Prettier for formatting
- Service layer for business logic
- Route layer for HTTP concerns only
- Database constraints for data integrity

### Commit Messages
```
feat: Add hybrid approval pattern
fix: Validate device support before adding demo URL
docs: Update API reference with new endpoints
refactor: Extract ZIP handling to utility function
test: Add unit tests for approval service
```

## License

Proprietary - Kargo Global Inc.

## Support

For questions or issues:
- Internal Wiki: [link to internal docs]
- Slack: #kcap-platform
- Email: platform-team@kargo.com

---

**Built with ❤️ by Claude Sonnet 4.5**
**Last Updated: 2025-10-28**
