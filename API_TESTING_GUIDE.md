# API Testing Guide
**Quick Reference for Testing Backend Endpoints**

---

## Prerequisites

```bash
# 1. Start backend server
cd backend
npm run dev

# Server running at: http://localhost:4000

# 2. Verify health check
curl http://localhost:4000/health
```

---

## Test Workflow: End-to-End

### 1. Create Campaign with Portal Link

```bash
curl -X POST http://localhost:4000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Amazon XCM Q4 2025",
    "client_name": "Amazon",
    "client_email": "client@amazon.com",
    "kargo_account_manager_email": "am@kargo.com",
    "celtra_integration_enabled": true,
    "default_landing_url": "https://amazon.com/prime",
    "start_date": "2025-11-01",
    "end_date": "2025-12-31"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "campaign": {
      "id": "...",
      "name": "Amazon XCM Q4 2025",
      "status": "draft",
      ...
    },
    "portal": {
      "url": "http://localhost:3000/portal/abc123...",
      "token": "abc123...",
      "expiresAt": "2025-11-28T..."
    }
  }
}
```

**Save the `portal.token` for next steps!**

---

### 2. Validate Portal Token

```bash
# Replace {TOKEN} with actual token from step 1
curl http://localhost:4000/api/portal/{TOKEN}/validate
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "campaign": {
      "id": "...",
      "name": "Amazon XCM Q4 2025",
      ...
    },
    "isValid": true,
    "expiresAt": "2025-11-28T..."
  }
}
```

---

### 3. Upload Creative via Portal

```bash
# Replace {TOKEN} with actual token
curl -X POST http://localhost:4000/api/portal/{TOKEN}/upload \
  -F "file=@/path/to/banner-300x250.png" \
  -F "creative_name=Amazon Prime Banner 300x250" \
  -F "creative_type=display" \
  -F "dimensions=300x250" \
  -F "landing_url=https://amazon.com/prime" \
  -F "client_notes=R1 Static Mock"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "creative": {
      "id": "...",
      "name": "Amazon Prime Banner 300x250",
      "status": "pending",
      "presignedUrl": "https://s3.amazonaws.com/..."
    }
  },
  "message": "Creative uploaded successfully. Kargo team will review shortly."
}
```

**Save the `creative.id` for next steps!**

---

### 4. Get Pending Creatives (Kargo AM Dashboard)

```bash
curl http://localhost:4000/api/creatives/pending
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Amazon Prime Banner 300x250",
      "status": "pending",
      "priority": "normal",
      "submitted_at": "2025-10-28T...",
      ...
    }
  ],
  "count": 1
}
```

---

### 5. Approve Creative

```bash
# Replace {CREATIVE_ID} with actual creative ID
curl -X POST http://localhost:4000/api/creatives/{CREATIVE_ID}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "actor_email": "am@kargo.com",
    "feedback": "Looks great! Approved for launch."
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "status": "approved",
    "approved_by": "am@kargo.com",
    "approved_at": "2025-10-28T...",
    ...
  },
  "message": "Creative approved successfully"
}
```

**This triggers:**
- ✅ Tag generation (Celtra integrated)
- ✅ Email sent to client
- ✅ Approval history logged

---

### 6. Get Generated Tag

```bash
# Replace {CREATIVE_ID} with actual creative ID
curl http://localhost:4000/api/creatives/{CREATIVE_ID}/tags
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "creative_id": "...",
      "tag_type": "celtra",
      "tag_code": "<!-- BEGIN CREATIVE TAG ... -->",
      "celtra_pixel_included": true,
      "version": 1,
      "generated_at": "2025-10-28T..."
    }
  ],
  "count": 1
}
```

---

### 7. View Dashboard Analytics

```bash
curl http://localhost:4000/api/analytics/dashboard
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "creatives": {
      "pending": 0,
      "approved": 1,
      "rejected": 0,
      "needsChanges": 0,
      "urgent": 0,
      "highPriority": 0
    },
    "campaigns": {
      "active": 1,
      "draft": 0,
      "total": 1
    },
    "performance": {
      "avgApprovalTimeHours": 2.5,
      "submittedLast24h": 1,
      "approvedLast24h": 1
    }
  }
}
```

---

## Test Workflow: Rejection & Changes

### Reject Creative

```bash
curl -X POST http://localhost:4000/api/creatives/{CREATIVE_ID}/reject \
  -H "Content-Type: application/json" \
  -d '{
    "actor_email": "am@kargo.com",
    "reason": "Brand logo is incorrect. Please use the updated logo from the brand guidelines."
  }'
```

### Request Changes

```bash
curl -X POST http://localhost:4000/api/creatives/{CREATIVE_ID}/request-changes \
  -H "Content-Type: application/json" \
  -d '{
    "actor_email": "am@kargo.com",
    "changes": "Please adjust the following:\n1. Increase font size to 18px\n2. Change CTA button color to #FF9900\n3. Add 10px padding around the logo"
  }'
```

---

## Test Workflow: Bulk Operations

### Bulk Approve

```bash
curl -X POST http://localhost:4000/api/creatives/bulk-approve \
  -H "Content-Type: application/json" \
  -d '{
    "creative_ids": [
      "creative-id-1",
      "creative-id-2",
      "creative-id-3"
    ],
    "actor_email": "am@kargo.com",
    "feedback": "All R1 static mocks approved!"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    { "creativeId": "creative-id-1", "success": true },
    { "creativeId": "creative-id-2", "success": true },
    { "creativeId": "creative-id-3", "success": true }
  ],
  "summary": {
    "total": 3,
    "success": 3,
    "failed": 0
  }
}
```

---

## Test Workflow: Batch Upload

### Upload Multiple Creatives at Once

```bash
curl -X POST http://localhost:4000/api/portal/{TOKEN}/upload-batch \
  -F "files=@/path/to/banner-300x250.png" \
  -F "files=@/path/to/banner-728x90.png" \
  -F "files=@/path/to/banner-160x600.png" \
  -F "creative_type=display" \
  -F "landing_url=https://amazon.com/prime" \
  -F "client_notes=R1 Static Mocks - 10.28.25" \
  -F "priority=high"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "creatives": [
      { "id": "...", "name": "banner-300x250", "status": "pending" },
      { "id": "...", "name": "banner-728x90", "status": "pending" },
      { "id": "...", "name": "banner-160x600", "status": "pending" }
    ],
    "errors": []
  },
  "summary": {
    "total": 3,
    "successful": 3,
    "failed": 0
  },
  "message": "3 creative(s) uploaded successfully. 0 failed."
}
```

---

## Test Workflow: Analytics

### Campaign Analytics

```bash
curl http://localhost:4000/api/analytics/campaign/{CAMPAIGN_ID}
```

### Approval Velocity (Last 30 Days)

```bash
curl http://localhost:4000/api/analytics/approval-velocity?days=30
```

### Account Manager Performance

```bash
curl http://localhost:4000/api/analytics/account-manager-performance
```

### Creative Type Breakdown

```bash
curl http://localhost:4000/api/analytics/creative-type-breakdown
```

### Timeline Risks

```bash
curl http://localhost:4000/api/analytics/timeline-risks
```

---

## Test Workflow: Portal Features

### View Client's Uploaded Creatives

```bash
curl http://localhost:4000/api/portal/{TOKEN}/creatives
```

### View Single Creative (Client View)

```bash
curl http://localhost:4000/api/portal/{TOKEN}/creative/{CREATIVE_ID}
```

---

## Test Workflow: Campaign Management

### List All Campaigns

```bash
curl http://localhost:4000/api/campaigns
```

### Filter Campaigns by Status

```bash
curl "http://localhost:4000/api/campaigns?status=active"
```

### Get Campaign Details

```bash
curl http://localhost:4000/api/campaigns/{CAMPAIGN_ID}
```

### Update Campaign

```bash
curl -X PATCH http://localhost:4000/api/campaigns/{CAMPAIGN_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Amazon XCM Q4 2025 - Updated",
    "default_landing_url": "https://amazon.com/prime/deals"
  }'
```

### Update Campaign Status

```bash
curl -X PATCH http://localhost:4000/api/campaigns/{CAMPAIGN_ID}/status \
  -H "Content-Type: application/json" \
  -d '{ "status": "active" }'
```

### Regenerate Portal Link

```bash
curl -X POST http://localhost:4000/api/campaigns/{CAMPAIGN_ID}/portal/regenerate \
  -H "Content-Type: application/json" \
  -d '{ "client_email": "client@amazon.com" }'
```

---

## Test Workflow: Creative Management

### List All Creatives

```bash
curl http://localhost:4000/api/creatives
```

### Filter by Campaign

```bash
curl "http://localhost:4000/api/creatives?campaign_id={CAMPAIGN_ID}"
```

### Filter by Status

```bash
curl "http://localhost:4000/api/creatives?status=pending"
```

### Get Creative Details

```bash
curl http://localhost:4000/api/creatives/{CREATIVE_ID}
```

**Response includes:**
- Creative details
- Approval history
- Latest generated tag (if approved)

### Update Priority

```bash
curl -X PATCH http://localhost:4000/api/creatives/{CREATIVE_ID}/priority \
  -H "Content-Type: application/json" \
  -d '{ "priority": "urgent" }'
```

### Update Internal Notes

```bash
curl -X PATCH http://localhost:4000/api/creatives/{CREATIVE_ID}/notes \
  -H "Content-Type: application/json" \
  -d '{ "notes": "Discussed with client on 10/28. Waiting for revised copy." }'
```

### Get Approval History

```bash
curl http://localhost:4000/api/creatives/{CREATIVE_ID}/history
```

### Regenerate Tag

```bash
curl -X POST http://localhost:4000/api/creatives/{CREATIVE_ID}/regenerate-tag \
  -H "Content-Type: application/json" \
  -d '{ "actor_email": "am@kargo.com" }'
```

---

## Common Test Scenarios

### Scenario 1: Happy Path (R1 → R2 Workflow)

1. Create campaign → Get portal token
2. Client uploads R1 static mocks (batch)
3. Kargo AM bulk approves R1 package
4. Client uploads R2 animated versions
5. Kargo AM reviews and approves R2
6. Campaign status updated to 'active'
7. Tags exported for trafficking

### Scenario 2: Rejection & Revision

1. Create campaign → Get portal token
2. Client uploads creative
3. Kargo AM rejects with detailed reason
4. Client receives email
5. Client uploads revised version
6. Kargo AM approves
7. Tag generated

### Scenario 3: Changes Requested

1. Create campaign → Get portal token
2. Client uploads creative
3. Kargo AM requests changes (detailed list)
4. Client receives email with changes
5. Client uploads revised version
6. Kargo AM approves
7. Tag generated

---

## Error Testing

### Test Expired Token

```bash
# Use old token (>30 days)
curl http://localhost:4000/api/portal/expired-token-here/validate
```

**Expected: 401 Unauthorized**
```json
{
  "error": "This portal link has expired. Please contact your Kargo account manager for a new link."
}
```

### Test Invalid Token

```bash
curl http://localhost:4000/api/portal/invalid-token/validate
```

**Expected: 401 Unauthorized**
```json
{
  "error": "Invalid or expired portal link"
}
```

### Test Missing Required Fields

```bash
curl -X POST http://localhost:4000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{ "name": "Test Campaign" }'
```

**Expected: 400 Bad Request**
```json
{
  "error": "Missing required fields: name, client_name, client_email, kargo_account_manager_email"
}
```

### Test Reject Without Reason

```bash
curl -X POST http://localhost:4000/api/creatives/{CREATIVE_ID}/reject \
  -H "Content-Type: application/json" \
  -d '{ "actor_email": "am@kargo.com" }'
```

**Expected: 400 Bad Request**
```json
{
  "error": "Rejection reason is required"
}
```

---

## Performance Testing

### Load Test: Bulk Upload

```bash
# Upload 50 files at once (max limit)
for i in {1..50}; do
  echo "banner-$i.png" > /tmp/banner-$i.png
done

curl -X POST http://localhost:4000/api/portal/{TOKEN}/upload-batch \
  $(for i in {1..50}; do echo "-F files=@/tmp/banner-$i.png"; done) \
  -F "creative_type=display"
```

### Load Test: Bulk Approve

```bash
# Generate 100 creative IDs and approve in batches of 10
curl -X POST http://localhost:4000/api/creatives/bulk-approve \
  -H "Content-Type: application/json" \
  -d '{
    "creative_ids": [/* 100 IDs */],
    "actor_email": "am@kargo.com"
  }'
```

---

## Postman Collection

Import this JSON into Postman for visual testing:

```json
{
  "info": {
    "name": "Creative Approval Workflow API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    { "key": "BASE_URL", "value": "http://localhost:4000" },
    { "key": "CAMPAIGN_ID", "value": "" },
    { "key": "CREATIVE_ID", "value": "" },
    { "key": "PORTAL_TOKEN", "value": "" }
  ],
  "item": [
    {
      "name": "Campaigns",
      "item": [
        {
          "name": "Create Campaign",
          "request": {
            "method": "POST",
            "url": "{{BASE_URL}}/api/campaigns",
            "body": {
              "mode": "raw",
              "raw": "{\n  \"name\": \"Test Campaign\",\n  \"client_name\": \"Client\",\n  \"client_email\": \"client@example.com\",\n  \"kargo_account_manager_email\": \"am@kargo.com\"\n}"
            }
          }
        }
      ]
    }
  ]
}
```

---

## Troubleshooting

### Database Connection Errors

```bash
# Check if PostgreSQL is running
psql -h localhost -U postgres -d kargo_creative_approval

# Verify connection string
echo $DATABASE_URL
```

### S3 Upload Errors

```bash
# Verify AWS credentials
aws s3 ls s3://kargo-creative-approval

# Test presigned URL generation
curl -X GET "presigned-url-here"
```

### Email Sending Errors

```bash
# Check Gmail API credentials
# Verify refresh token is valid
# Test email sending separately
```

---

## Quick Reference: All Endpoints

### Campaigns (7)
- `POST /api/campaigns` - Create with portal link
- `GET /api/campaigns` - List campaigns
- `GET /api/campaigns/:id` - Get campaign
- `PATCH /api/campaigns/:id` - Update campaign
- `PATCH /api/campaigns/:id/status` - Update status
- `POST /api/campaigns/:id/portal/regenerate` - Regenerate link
- `DELETE /api/campaigns/:id` - Archive

### Creatives (12)
- `GET /api/creatives` - List creatives
- `GET /api/creatives/pending` - Pending queue
- `GET /api/creatives/:id` - Get creative
- `POST /api/creatives/:id/approve` - Approve
- `POST /api/creatives/:id/reject` - Reject
- `POST /api/creatives/:id/request-changes` - Request changes
- `POST /api/creatives/bulk-approve` - Bulk approve
- `PATCH /api/creatives/:id/priority` - Update priority
- `PATCH /api/creatives/:id/notes` - Update notes
- `GET /api/creatives/:id/history` - Approval history
- `GET /api/creatives/:id/tags` - Tag versions
- `POST /api/creatives/:id/regenerate-tag` - Regenerate tag

### Portal (5)
- `GET /api/portal/:token/validate` - Validate token
- `GET /api/portal/:token/creatives` - Client's creatives
- `POST /api/portal/:token/upload` - Upload creative
- `POST /api/portal/:token/upload-batch` - Batch upload
- `GET /api/portal/:token/creative/:id` - View creative

### Analytics (7)
- `GET /api/analytics/dashboard` - Overview metrics
- `GET /api/analytics/campaign/:id` - Campaign analytics
- `GET /api/analytics/approval-velocity` - Velocity trends
- `GET /api/analytics/account-manager-performance` - AM metrics
- `GET /api/analytics/creative-type-breakdown` - Type distribution
- `GET /api/analytics/timeline-risks` - Risk detection
- `GET /api/analytics/approval-history-timeline/:id` - Timeline

**Total: 31 endpoints**

---

## Next Steps

1. ✅ Backend API complete
2. ⬜ Frontend development
3. ⬜ End-to-end testing
4. ⬜ Production deployment

---

**Happy Testing! 🚀**
