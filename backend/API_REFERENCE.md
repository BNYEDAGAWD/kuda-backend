# KCAP API Reference - Quick Guide

Base URL: `http://localhost:4000`

## Authentication
🚧 **Not Yet Implemented** - All endpoints currently unprotected

## Response Format
All successful responses return JSON with appropriate HTTP status codes:
- `200 OK` - Successful GET/PATCH
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE
- `400 Bad Request` - Validation error
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

## Campaigns API

### Create Campaign
```http
POST /api/campaigns
Content-Type: application/json

{
  "campaign_name": "Amazon Prime Day 2024",
  "client_name": "Amazon",
  "client_email": "marketing@amazon.com",
  "account_manager_name": "John Doe",
  "account_manager_email": "john.doe@kargo.com"
}
```

### List Campaigns
```http
GET /api/campaigns
GET /api/campaigns?status=active
GET /api/campaigns?client_id={uuid}
```

### Get Campaign
```http
GET /api/campaigns/{id}
```

### Add Format to Campaign
```http
POST /api/campaigns/{id}/formats
Content-Type: application/json

{
  "format_id": "{format_id}",
  "variations": ["desktop", "mobile", "tablet"]
}
```

### Get Campaign Formats
```http
GET /api/campaigns/{id}/formats
```

### Generate Portal Link
```http
POST /api/campaigns/{id}/portal-link
```

Returns: `{ "portal_link": "/portal/{unique_token}" }`

### Update Campaign Status
```http
PATCH /api/campaigns/{id}/status
Content-Type: application/json

{
  "status": "asset_pack_pending" | "in_production" | "client_review" | "approved" | "trafficking"
}
```

### Update Launch Date
```http
PATCH /api/campaigns/{id}/launch-date
Content-Type: application/json

{
  "launch_date": "2024-12-01"
}
```

## Asset Packs API

### Upload Asset Pack
```http
POST /api/asset-packs
Content-Type: multipart/form-data

campaign_id: {uuid}
uploaded_by_email: client@test.com
files: [file1.png, file2.jpg, assets.zip]
```

**Notes:**
- Max 50 files per upload
- ZIP files automatically extracted
- Files auto-categorized (logo, image, copy, brand_guide, font, other)

### Get Asset Pack
```http
GET /api/asset-packs/{id}
```

### List Asset Packs by Campaign
```http
GET /api/asset-packs/campaign/{campaignId}
```

### Approve Asset Pack
```http
POST /api/asset-packs/{id}/approve
Content-Type: application/json

{
  "reviewed_by": "john.doe@kargo.com"
}
```

**Side Effects:**
- Creates 48h SLA timer
- Updates campaign status
- Sends notification

### Reject Asset Pack
```http
POST /api/asset-packs/{id}/reject
Content-Type: application/json

{
  "reviewed_by": "john.doe@kargo.com",
  "rejection_note": "Missing high-res logo files and brand guidelines PDF"
}
```

⚠️ **MANDATORY:** `rejection_note` is required and must not be empty

### Get Asset Pack Files
```http
GET /api/asset-packs/{id}/files
```

Returns files with categorization and S3 URLs.

### Delete Asset Pack File
```http
DELETE /api/asset-packs/files/{fileId}
```

## Deliverables API

### Create Deliverable
```http
POST /api/deliverables
Content-Type: application/json

{
  "campaign_id": "{uuid}",
  "deliverable_type": "static_mock" | "animated",
  "deliverable_url": "https://docs.google.com/presentation/d/..." | "https://dropbox.com/...",
  "round_number": 1,
  "revision_number": 0
}
```

### Get Deliverable
```http
GET /api/deliverables/{id}
```

### List Deliverables by Campaign
```http
GET /api/deliverables/campaign/{campaignId}
GET /api/deliverables/campaign/{campaignId}?deliverable_type=static_mock
GET /api/deliverables/campaign/{campaignId}?status=ready_for_review
```

### Add Demo URL
```http
POST /api/deliverables/{id}/demo-urls
Content-Type: application/json

{
  "campaign_format_id": "{uuid}",
  "device": "desktop" | "mobile" | "tablet" | "ctv",
  "demo_url": "https://demo.kargo.com/preview/{uuid}?id={id}&site={publisher}&view={device}"
}
```

**Validation:** Device must be supported for the format (checked against format_library)

### Get Demo URLs
```http
GET /api/deliverables/{id}/demo-urls
```

### Mark Deliverable Ready
```http
POST /api/deliverables/{id}/mark-ready
```

**Side Effects:**
- Updates status to `ready_for_review`
- Sends client notification
- Updates SLA timer

### Create Revision
```http
POST /api/deliverables/{id}/revisions
Content-Type: application/json

{
  "changes_summary": "Updated mobile view logo positioning per client feedback"
}
```

Creates new deliverable with incremented revision number (R1 → R1.1)

### Get Revision History
```http
GET /api/deliverables/{id}/revisions
```

### Update Deliverable URL
```http
PATCH /api/deliverables/{id}/url
Content-Type: application/json

{
  "deliverable_url": "https://docs.google.com/presentation/d/new-version"
}
```

## Approvals API

### Approve Format (All Devices)
```http
POST /api/approvals/format/approve
Content-Type: application/json

{
  "deliverable_id": "{uuid}",
  "format_id": "{uuid}",
  "reviewed_by": "client@test.com"
}
```

Approves all device views for the format at once.

### Reject Format
```http
POST /api/approvals/format/reject
Content-Type: application/json

{
  "deliverable_id": "{uuid}",
  "format_id": "{uuid}",
  "reviewed_by": "client@test.com",
  "feedback": "Overall creative doesn't align with brand guidelines. Logo too small across all devices."
}
```

⚠️ **MANDATORY:** `feedback` is required and must not be empty

### Approve Device
```http
POST /api/approvals/device/approve
Content-Type: application/json

{
  "deliverable_id": "{uuid}",
  "format_id": "{uuid}",
  "device": "desktop" | "mobile" | "tablet" | "ctv",
  "reviewed_by": "client@test.com"
}
```

Approves specific device view only.

### Reject Device
```http
POST /api/approvals/device/reject
Content-Type: application/json

{
  "deliverable_id": "{uuid}",
  "format_id": "{uuid}",
  "device": "mobile",
  "reviewed_by": "client@test.com",
  "feedback": "Mobile view cuts off logo on iPhone 12. Please adjust positioning."
}
```

⚠️ **MANDATORY:** `feedback` is required and must not be empty

### Get Deliverable Approvals
```http
GET /api/approvals/deliverable/{deliverableId}
```

Returns all approvals/rejections with feedback.

### Get Approval Summary
```http
GET /api/approvals/deliverable/{deliverableId}/summary
```

Returns counts and aggregated approval status.

## SLA Timers API

### Start Timer
```http
POST /api/sla-timers
Content-Type: application/json

{
  "reference_type": "asset_pack" | "static_mock" | "animated" | "revision",
  "reference_id": "{uuid}",
  "duration_hours": 48 | 24
}
```

**Auto-calculated:** `deadline = started_at + duration_hours`

### Get Active Timers
```http
GET /api/sla-timers/active
```

Returns all active timers with `hours_remaining` calculated.

### Get At-Risk Timers
```http
GET /api/sla-timers/at-risk
```

Returns timers with < 6 hours remaining.

### Adjust Timer
```http
PATCH /api/sla-timers/{id}/adjust
Content-Type: application/json

{
  "new_duration_hours": 72,
  "reason": "Client requested additional review time for stakeholder alignment",
  "adjusted_by": "john.doe@kargo.com"
}
```

Preserves `original_duration_hours` and recalculates deadline.

### Complete Timer
```http
POST /api/sla-timers/{id}/complete
```

Updates status to `completed` and sets `completed_at`.

### Get Timer by Reference
```http
GET /api/sla-timers/reference/{type}/{id}
```

Example: `GET /api/sla-timers/reference/asset_pack/{asset_pack_id}`

### Get Timer History
```http
GET /api/sla-timers/reference/{type}/{id}/history
```

Returns all timers for a reference (including completed/adjusted).

## Formats API (Read-Only)

### Get All Formats
```http
GET /api/formats
```

Returns all 21 Kargo formats with metadata.

### Get Formats by Type
```http
GET /api/formats?type=video
GET /api/formats?type=display
GET /api/formats?type=ctv
```

### Get Format Devices
```http
GET /api/formats/{id}/devices
```

Returns supported devices for format:
- Cross-platform: `["desktop", "mobile", "tablet"]`
- Mobile-only: `["mobile"]`
- CTV-only: `["ctv"]`

## Error Responses

### 400 Bad Request
```json
{
  "error": "Rejection feedback is MANDATORY when rejecting a format"
}
```

### 404 Not Found
```json
{
  "error": "Campaign not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to create campaign",
  "message": "Database connection error"
}
```

## Workflow Examples

### Complete Asset Pack Workflow
```bash
# 1. Create campaign
campaign_id=$(curl -X POST /api/campaigns -d '{"campaign_name":"Test","client_name":"Client","client_email":"client@test.com","account_manager_name":"AM","account_manager_email":"am@kargo.com"}' | jq -r '.id')

# 2. Upload asset pack
asset_pack_id=$(curl -X POST /api/asset-packs -F "campaign_id=$campaign_id" -F "uploaded_by_email=client@test.com" -F "files=@logo.png" | jq -r '.id')

# 3. AM approves (starts 48h timer)
curl -X POST /api/asset-packs/$asset_pack_id/approve -d '{"reviewed_by":"am@kargo.com"}'

# 4. Check SLA timer
curl /api/sla-timers/reference/asset_pack/$asset_pack_id
```

### Complete Static Mock Workflow
```bash
# 1. Create deliverable
deliverable_id=$(curl -X POST /api/deliverables -d '{"campaign_id":"'$campaign_id'","deliverable_type":"static_mock","deliverable_url":"https://slides.google.com/123","round_number":1,"revision_number":0}' | jq -r '.id')

# 2. Add demo URLs per device
curl -X POST /api/deliverables/$deliverable_id/demo-urls -d '{"campaign_format_id":"'$format_id'","device":"desktop","demo_url":"https://demo.kargo.com/preview/abc?view=desktop"}'
curl -X POST /api/deliverables/$deliverable_id/demo-urls -d '{"campaign_format_id":"'$format_id'","device":"mobile","demo_url":"https://demo.kargo.com/preview/abc?view=mobile"}'

# 3. Mark ready for review
curl -X POST /api/deliverables/$deliverable_id/mark-ready

# 4. Client approves format (all devices)
curl -X POST /api/approvals/format/approve -d '{"deliverable_id":"'$deliverable_id'","format_id":"'$format_id'","reviewed_by":"client@test.com"}'
```

### Complete Hybrid Approval Workflow
```bash
# Client approves desktop, rejects mobile, approves tablet
curl -X POST /api/approvals/device/approve -d '{"deliverable_id":"'$deliverable_id'","format_id":"'$format_id'","device":"desktop","reviewed_by":"client@test.com"}'

curl -X POST /api/approvals/device/reject -d '{"deliverable_id":"'$deliverable_id'","format_id":"'$format_id'","device":"mobile","reviewed_by":"client@test.com","feedback":"Logo cut off on mobile view"}'

curl -X POST /api/approvals/device/approve -d '{"deliverable_id":"'$deliverable_id'","format_id":"'$format_id'","device":"tablet","reviewed_by":"client@test.com"}'
```

---

**For complete workflow documentation, see [KCAP_BACKEND_COMPLETE.md](KCAP_BACKEND_COMPLETE.md)**
