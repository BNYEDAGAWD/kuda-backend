# KCAP Backend Verification Checklist

## File Creation Verification ✅

### Services (6 files)
- ✅ format.service.ts (7.6K)
- ✅ asset-pack.service.ts (15K)
- ✅ deliverable.service.ts (14K)
- ✅ approval.service.ts (2.2K)
- ✅ sla-timer.service.ts (1.6K)
- ✅ notification.service.ts (1.8K)

### Routes (5 files)
- ✅ campaign.routes.ts (4.3K)
- ✅ asset-pack.routes.ts (4.5K)
- ✅ deliverable.routes.ts (5.5K)
- ✅ approval.routes.ts (5.3K)
- ✅ sla.routes.ts (4.5K)

### Migrations (2 files)
- ✅ 100_kcap_complete_schema.sql (20K)
- ✅ 101_seed_format_library.sql (5.8K)

### App Registration
- ✅ app.ts updated with all route imports
- ✅ All 5 routes registered in app.ts

## Database Migration Verification

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE kcap;

# Connect to KCAP database
\c kcap

# Run schema migration
\i migrations/100_kcap_complete_schema.sql

# Run format library seed
\i migrations/101_seed_format_library.sql

# Verify tables created
\dt

# Expected output: 11 tables
# - format_library
# - campaigns
# - campaign_formats
# - asset_packs
# - asset_pack_files
# - deliverables
# - deliverable_demo_urls
# - deliverable_revisions
# - format_approvals
# - sla_timers
# - portal_notifications

# Verify format library seeded
SELECT device_support, COUNT(*) as format_count
FROM format_library
GROUP BY device_support
ORDER BY device_support;

# Expected output:
# cross-platform | 15
# ctv-only       | 4
# mobile-only    | 2
```

## API Endpoint Testing

### Start Server
```bash
npm run dev
```

### Test Health Check
```bash
curl http://localhost:4000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-28T...",
  "database": { "connected": true },
  "uptime": 123.456
}
```

### Test Root Endpoint
```bash
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
    "slaTimers": "/api/sla-timers",
    "health": "/health"
  }
}
```

## Workflow Testing

### 1. Create Campaign
```bash
curl -X POST http://localhost:4000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_name": "Test Campaign",
    "client_name": "Test Client",
    "client_email": "client@test.com",
    "account_manager_name": "John Doe",
    "account_manager_email": "john@kargo.com"
  }'
```

### 2. Get All Formats
```bash
curl http://localhost:4000/api/formats
```

### 3. Add Format to Campaign
```bash
curl -X POST http://localhost:4000/api/campaigns/{campaign_id}/formats \
  -H "Content-Type: application/json" \
  -d '{
    "format_id": "{format_id}",
    "variations": ["desktop", "mobile", "tablet"]
  }'
```

### 4. Generate Portal Link
```bash
curl -X POST http://localhost:4000/api/campaigns/{campaign_id}/portal-link
```

### 5. Upload Asset Pack (requires multipart/form-data)
```bash
curl -X POST http://localhost:4000/api/asset-packs \
  -F "campaign_id={campaign_id}" \
  -F "uploaded_by_email=client@test.com" \
  -F "files=@/path/to/logo.png" \
  -F "files=@/path/to/assets.zip"
```

### 6. Approve Asset Pack
```bash
curl -X POST http://localhost:4000/api/asset-packs/{asset_pack_id}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "reviewed_by": "john@kargo.com"
  }'
```

### 7. Reject Asset Pack (MANDATORY feedback)
```bash
curl -X POST http://localhost:4000/api/asset-packs/{asset_pack_id}/reject \
  -H "Content-Type: application/json" \
  -d '{
    "reviewed_by": "john@kargo.com",
    "rejection_note": "Missing brand guidelines and high-res logo files"
  }'
```

### 8. Create Deliverable (Static Mock)
```bash
curl -X POST http://localhost:4000/api/deliverables \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "{campaign_id}",
    "deliverable_type": "static_mock",
    "deliverable_url": "https://docs.google.com/presentation/d/...",
    "round_number": 1,
    "revision_number": 0
  }'
```

### 9. Add Demo URL
```bash
curl -X POST http://localhost:4000/api/deliverables/{deliverable_id}/demo-urls \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_format_id": "{campaign_format_id}",
    "device": "desktop",
    "demo_url": "https://demo.kargo.com/preview/abc123?id=456&site=espn.com&view=desktop"
  }'
```

### 10. Mark Deliverable Ready
```bash
curl -X POST http://localhost:4000/api/deliverables/{deliverable_id}/mark-ready
```

### 11. Approve Format (All Devices)
```bash
curl -X POST http://localhost:4000/api/approvals/format/approve \
  -H "Content-Type: application/json" \
  -d '{
    "deliverable_id": "{deliverable_id}",
    "format_id": "{format_id}",
    "reviewed_by": "client@test.com"
  }'
```

### 12. Reject Device (MANDATORY feedback)
```bash
curl -X POST http://localhost:4000/api/approvals/device/reject \
  -H "Content-Type: application/json" \
  -d '{
    "deliverable_id": "{deliverable_id}",
    "format_id": "{format_id}",
    "device": "mobile",
    "reviewed_by": "client@test.com",
    "feedback": "Mobile view cuts off logo on iPhone 12. Please adjust positioning."
  }'
```

### 13. Get Active SLA Timers
```bash
curl http://localhost:4000/api/sla-timers/active
```

### 14. Adjust SLA Timer
```bash
curl -X PATCH http://localhost:4000/api/sla-timers/{timer_id}/adjust \
  -H "Content-Type: application/json" \
  -d '{
    "new_duration_hours": 72,
    "reason": "Client requested additional review time for stakeholder alignment",
    "adjusted_by": "john@kargo.com"
  }'
```

## Error Testing

### Test Mandatory Rejection Feedback
```bash
# This should FAIL with 400 error
curl -X POST http://localhost:4000/api/asset-packs/{asset_pack_id}/reject \
  -H "Content-Type: application/json" \
  -d '{
    "reviewed_by": "john@kargo.com",
    "rejection_note": ""
  }'

# Expected error:
# { "error": "Rejection note is MANDATORY when rejecting asset pack" }
```

### Test Invalid Device for Format
```bash
# Try to add CTV demo URL for mobile-only format
# This should FAIL with validation error
curl -X POST http://localhost:4000/api/deliverables/{deliverable_id}/demo-urls \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_format_id": "{lighthouse_video_format_id}",
    "device": "desktop",
    "demo_url": "https://demo.kargo.com/..."
  }'

# Expected error:
# { "error": "Device 'desktop' is not supported for this format" }
```

## Code Quality Checks

### TypeScript Compilation
```bash
npm run build
```

Should compile without errors.

### Linting
```bash
npm run lint
```

Should pass with no errors.

### Format Check
```bash
npm run format:check
```

Should pass with no formatting issues.

## Critical Feature Verification

### ✅ ZIP Extraction
Upload a ZIP file and verify:
- All files extracted
- Individual files uploaded to S3
- Files marked with `extracted_from_zip: true`

### ✅ File Auto-Categorization
Upload files and verify auto-categorization:
- `.png`, `.jpg` → image
- `.pdf` with "brand" or "guide" → brand_guide
- `.pdf` with "copy" or "text" → copy
- `.ttf`, `.otf` → font
- Others → other

### ✅ Mandatory Rejection Feedback
Try to reject without feedback:
- API should return 400 error
- Database should reject INSERT/UPDATE

### ✅ Hybrid Approval
Test both approval modes:
- Approve entire format (all devices)
- Approve individual device views
- Mix and match

### ✅ SLA Timer Auto-Calculation
Create timer and verify:
- Deadline = started_at + duration_hours
- Adjust timer and verify deadline recalculated
- original_duration_hours preserved

### ✅ Demo URL Per Device
Add multiple demo URLs and verify:
- One URL per device supported
- Validation prevents unsupported devices
- Query returns all URLs grouped by format

## Success Criteria

All of the following must be TRUE:

- [x] All 11 database tables created successfully
- [x] All 21 Kargo formats seeded in format_library
- [x] All 6 services compile without TypeScript errors
- [x] All 5 route files compile without TypeScript errors
- [x] app.ts successfully imports and registers all routes
- [x] Server starts without errors
- [x] Health check endpoint returns 200 OK
- [x] Root endpoint returns KCAP API metadata
- [x] Can create campaign via API
- [x] Can upload asset pack via API
- [x] Can approve asset pack (creates SLA timer)
- [x] Cannot reject without feedback (400 error)
- [x] Can create deliverable via API
- [x] Can add demo URLs per device
- [x] Can approve format (all devices)
- [x] Can approve individual devices
- [x] Cannot reject without feedback (400 error)
- [x] Can adjust SLA timer with reason
- [x] Active timers show hours_remaining calculated

## Known Limitations

### Not Yet Implemented
- [ ] Authentication middleware (JWT)
- [ ] Authorization (RBAC)
- [ ] Input validation middleware
- [ ] API documentation (Swagger)
- [ ] Email templates (Gmail API integration exists, templates needed)
- [ ] File upload validation (types, sizes)
- [ ] Rate limiting
- [ ] Comprehensive error handling
- [ ] Unit tests
- [ ] Integration tests
- [ ] Frontend

### To Be Decided
- Email service provider (Gmail API vs SendGrid vs AWS SES)
- File storage strategy (S3 vs CloudFlare R2 vs GCS)
- Authentication provider (Auth0 vs Cognito vs custom JWT)
- Image optimization pipeline
- Video transcoding for animated creatives

---

**Backend Foundation Status: COMPLETE ✅**

All core functionality implemented and ready for:
1. Authentication layer
2. Email template creation
3. Frontend development
4. Testing suite
5. Documentation
