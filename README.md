# Creative Approval Workflow Automation System

> Comprehensive Digital Asset Management and creative approval platform for programmatic advertising campaigns - from organized asset uploads to tag generation, all in one system.

## Overview

This system combines **Digital Asset Management (DAM)** capabilities with an automated creative approval workflow for Kargo's programmatic advertising campaigns. It accepts any file type as an "organized asset dump" - from layered PSDs and product shots to brand guidelines, fonts, and Figma links - intelligently categorizing and organizing them for easy designer retrieval while streamlining the approval process.

### Key Features

#### Digital Asset Management
- **Intelligent Asset Organization**: Accepts any file type (PSDs, PDFs, MP4s, fonts, ZIPs, brand guidelines, Figma links) and auto-organizes using 50+ taxonomy rules
- **Bulk Upload Processing**: Handle entire asset packages (folders, ZIP files) with automatic categorization and metadata extraction
- **Smart File Categorization**: Regex-based pattern matching identifies display creatives, video assets, source files, brand materials automatically
- **Metadata Extraction**: Auto-extract dimensions, transparency, layer count, duration, and file properties
- **Designer-Friendly Organization**: Auto-generated folder structures (e.g., `display/banners/300x250/`) for easy asset discovery
- **Search & Discovery**: Full-text search across filenames, tags, categories, and metadata
- **Duplicate Detection**: SHA-256 file hashing prevents duplicate uploads
- **Thumbnail Generation**: Automatic preview generation for images and videos
- **Asset Relationships**: Track source files, final creatives, and their connections

#### Creative Approval Workflow
- **Campaign Setup & Client Invites**: Kargo account managers create campaigns and send secure upload links to clients
- **Client Portal**: Token-based, no-login-required upload interface for external clients
- **Approval Workflow**: Streamlined approve/reject/request changes interface for internal team
- **Automated Notifications**: Gmail API integration for all workflow events
- **Tag Generation**: Automatic HTML tag creation with Celtra measurement pixel integration
- **Real-time Dashboard**: Live view of pending approvals, metrics, and performance analytics
- **Bulk Operations**: Process multiple creatives and assets simultaneously
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

## Digital Asset Management System

### Intelligent File Categorization

The system uses **50+ pre-configured taxonomy rules** to automatically categorize and organize uploaded files. Each rule consists of:
- **Pattern**: Regex to match filenames (e.g., `.*[-_]300x250\.(jpg|jpeg|png|gif)`)
- **Category**: Primary classification (display_creative, video_creative, source_file, brand_guideline, etc.)
- **Subcategory**: Detailed classification (banner_300x250, video_15s, photoshop, brand_guide, etc.)
- **Organized Path**: Auto-generated folder structure
- **Auto-tags**: Searchable tags for discovery
- **Priority**: Rules are processed by priority (highest first)
- **Confidence Score**: Indicates categorization accuracy

### Supported File Categories

#### Display Creatives (Ready for Approval)
- Banner sizes: 300x250, 728x90, 160x600, 320x50, 970x250, and 40+ more
- Formats: JPG, PNG, GIF, WEBP
- Auto-organized: `display/banners/{size}/`

#### Video Creatives (Ready for Approval)
- Durations: 6s, 15s, 30s, 60s
- Formats: MP4, WEBM, MOV, AVI
- Auto-organized: `video/{duration}/`

#### Source Files (Designer Assets)
- Photoshop: .psd
- Illustrator: .ai
- After Effects: .aep
- Premiere: .prproj
- Auto-organized: `source/{software}/`

#### Brand Materials
- Guidelines: brand guides, style guides (PDF)
- Fonts: .ttf, .otf, .woff, .woff2
- Logos: vector and raster formats
- Auto-organized: `brand/guidelines/`, `brand/fonts/`, `brand/logos/`

#### Product Assets
- Product shots: high-res images
- Photography: campaign photography
- Auto-organized: `product/shots/`, `product/photography/`

#### Archives & Packages
- ZIP files: Auto-extracted and processed
- RAR files: Support for compressed archives
- Auto-organized: Individual files organized by type

#### External Links
- Figma links tracked in `external_asset_links` table
- Google Drive links
- Other design tool URLs

### Metadata Extraction

**For Images:**
- Dimensions (width × height)
- File size
- Transparency detection
- Layer count (for PSDs)
- Color space

**For Videos:**
- Dimensions (width × height)
- Duration (seconds)
- Frame rate
- Codec information
- File size

**For Documents:**
- Page count (PDFs)
- Author/creator
- Creation date
- File size

### Search & Discovery

**Search by:**
- Filename (full-text search)
- Tags (array search with GIN indexes)
- Category and subcategory
- Dimensions
- File type
- Campaign
- Date range

**Filter by:**
- Is Final Creative (ready for approval)
- Approval status
- File category
- Package
- Confidence score

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

#### Assets & Asset Packages
- `GET /api/assets` - List all assets with filters
- `POST /api/assets/package` - Upload asset package (bulk upload)
- `GET /api/assets/:id` - Get asset details with metadata
- `GET /api/assets/search` - Search assets by filename, tags, category
- `GET /api/packages/:id` - Get asset package summary
- `GET /api/packages/:id/assets` - List assets in package

#### Creatives (Final Assets)
- `GET /api/creatives` - List final creatives ready for approval
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

### Complete Asset Upload to Tag Generation Flow

1. **Kargo Account Manager** creates campaign for "Amazon Q1 2024"
2. System generates secure client portal link (30-day expiration)
3. Email sent to **client** with upload instructions
4. **Client** clicks link, uploads entire asset package:
   - ZIP file containing layered PSDs, product shots, brand guidelines
   - Individual MP4 videos
   - PDF brand guidelines
   - Fonts folder
   - Figma links (external asset links)
5. **System automatically processes assets**:
   - Extracts files from ZIP archives
   - Categorizes each file using 50+ taxonomy rules
   - Extracts metadata (dimensions, transparency, layers, duration)
   - Generates thumbnails for preview
   - Creates organized folder structure (`display/banners/300x250/`, `video/15s/`, `source/photoshop/`)
   - Auto-tags assets for search (display, banner, 300x250, source, brand)
   - Detects duplicates via file hashing
6. **Designer/Account Manager** views organized assets:
   - Browses by category (Display Creatives, Video Creatives, Source Files, Brand Materials)
   - Searches by filename, dimensions, tags
   - Locates final creatives ready for approval
7. **Account Manager** marks final creatives for approval workflow
8. **Account Manager** approves creative
9. System auto-generates HTML tags with Celtra measurement pixels
10. **Account Manager** copies tags to DSP platform
11. **Client** receives approval confirmation email

### Asset Organization Examples

**Input**: `Amazon_Q1_Display_300x250_v3.psd`
- **Category**: Source File → Photoshop
- **Organized Path**: `source/photoshop/Amazon_Q1_Display_300x250_v3.psd`
- **Tags**: source, psd, layered, 300x250
- **Is Final Creative**: No

**Input**: `banner_300x250.jpg`
- **Category**: Display Creative → Banner 300x250
- **Organized Path**: `display/banners/300x250/banner_300x250.jpg`
- **Tags**: display, banner, 300x250, final
- **Is Final Creative**: Yes (ready for approval)

**Input**: `brand-guidelines-Q1-2024.pdf`
- **Category**: Brand Guideline → Brand Guide
- **Organized Path**: `brand/guidelines/brand-guidelines-Q1-2024.pdf`
- **Tags**: brand, guidelines
- **Is Final Creative**: No

## Support

For issues or questions:
- Email: brandon.nye@kargo.com
- GitHub Issues: [Create issue](https://github.com/YOUR_USERNAME/creative-approval-system/issues)

## License

Proprietary - Kargo Global Inc.

## Roadmap

### Phase 1: Digital Asset Management (Current)
- ✅ Intelligent file categorization with 50+ taxonomy rules
- ✅ Bulk upload processing (ZIP files, folders)
- ✅ Metadata extraction (dimensions, transparency, layers, duration)
- ✅ Auto-organized folder structures
- ✅ Search and discovery with tags
- ✅ Duplicate detection via file hashing
- ✅ Thumbnail generation
- ✅ Support for all file types (PSDs, PDFs, videos, fonts, brand guidelines)
- ✅ External asset link tracking (Figma, Google Drive)

### Phase 2: Creative Approval Workflow (In Progress)
- ⏳ Campaign setup
- ⏳ Client portal
- ⏳ Approval workflow (approve/reject/request changes)
- ⏳ Email notifications
- ⏳ Tag generation with Celtra integration
- ⏳ Analytics dashboard
- ⏳ Bulk operations

### Future Enhancements
- AI-powered brand safety detection
- Automatic asset version tracking
- Slack integration
- Mobile app (iOS/Android)
- Advanced analytics & reporting
- DSP platform auto-upload
- Multi-language support
- Custom approval chains
- Video creative preview with frame extraction
- Smart asset recommendations based on campaign type

---

**Built with ❤️ by Kargo Engineering**
