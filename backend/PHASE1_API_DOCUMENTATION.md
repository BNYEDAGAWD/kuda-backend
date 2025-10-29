# Phase 1 Enhanced API Documentation

## Overview

The Phase 1 optimization brings enhanced metadata to all asset pack endpoints, including:
- **Processing time tracking** - Verify <2 minute target
- **Brand color extraction** - From detected logos only
- **Minimal brief generation** - One-page designer handoff
- **Logo detection** - Dimension heuristics + filename patterns
- **Document scanning** - Keyword flagging without OCR
- **Suggested starting files** - Smart file prioritization

## Base URL

```
http://localhost:4000/api/asset-packs
```

## Endpoints

### 1. Upload Asset Pack (Enhanced)

**POST** `/`

Upload client source materials with automatic processing and categorization.

**Request:**
```http
POST /api/asset-packs HTTP/1.1
Content-Type: multipart/form-data

files: [File, File, ...]  (max 50 files)
campaign_id: string
uploaded_by_email: string
upload_method: 'portal' | 'manual_am' (optional, default: 'portal')
client_notes: string (optional)
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "campaign_id": "uuid",
  "uploaded_by": "client@example.com",
  "upload_method": "portal",
  "status": "pending",
  "reviewed_by": null,
  "reviewed_at": null,
  "rejection_note": null,
  "total_files": 23,
  "total_size_bytes": 45678900,
  "client_notes": "Brand assets for Q4 campaign",
  "internal_notes": null,

  // Enhanced Phase 1 metadata
  "processing_time_ms": 87432,
  "categorization_method": "extension-based",
  "quick_scan_flags": {
    "logo_count": 3,
    "brand_guidelines_found": true,
    "campaign_brief_found": true,
    "suggested_starting_file": "Brand_Guidelines_2024.pdf"
  },
  "brand_colors": [
    {"hex": "#FF5733", "rgb": {"r": 255, "g": 87, "b": 51}, "percentage": 45.2},
    {"hex": "#2C3E50", "rgb": {"r": 44, "g": 62, "b": 80}, "percentage": 28.7},
    {"hex": "#ECF0F1", "rgb": {"r": 236, "g": 240, "b": 241}, "percentage": 15.3}
  ],
  "minimal_brief": "Campaign assets for Amazon Q4 Holiday Campaign...",
  "minimal_brief_json": {
    "projectName": "Amazon Q4 Holiday Campaign",
    "summary": "Campaign assets for Amazon Q4 Holiday Campaign. Includes 5 source files, 12 images, 2 videos, 4 reference docs. Assets organized and ready for designer review.",
    "assetInventory": {
      "source_files": 5,
      "images": 12,
      "video": 2,
      "reference": 4,
      "misc": 0,
      "total": 23
    },
    "brandBasics": {
      "brandColors": [...],
      "brandGuidelinesDoc": "Brand_Guidelines_2024.pdf",
      "logoFiles": ["logo_primary.png", "logo_secondary.svg", "logo_icon.png"]
    },
    "suggestedStartingFile": "Brand_Guidelines_2024.pdf",
    "criticalBlockers": [],
    "generatedAt": "2024-01-15T10:30:00Z",
    "processingTimeMs": 234
  },

  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z",

  // Files array with enhanced metadata
  "files": [
    {
      "id": "uuid",
      "asset_pack_id": "uuid",
      "original_filename": "logo_primary.png",
      "s3_key": "asset-packs/uuid/logo_primary.png",
      "s3_url": "https://s3.amazonaws.com/...",
      "file_size_bytes": 89234,
      "mime_type": "image/png",
      "category": "images",
      "is_extracted_from_zip": false,

      // Enhanced Phase 1 metadata
      "is_likely_logo": true,
      "logo_confidence": "high",
      "logo_detection_reasons": [
        "Filename contains logo-related keyword",
        "Small dimensions (400x400px)"
      ],
      "dimensions": {"width": 400, "height": 400},
      "filename_patterns": ["logo"],
      "suggested_starting_file": false,

      "uploaded_at": "2024-01-15T10:30:15Z"
    },
    {
      "id": "uuid",
      "original_filename": "Brand_Guidelines_2024.pdf",
      "category": "reference",
      "is_likely_logo": false,
      "logo_confidence": null,
      "dimensions": null,
      "suggested_starting_file": true,
      ...
    }
  ],

  // Brief object (for convenience)
  "brief": {
    "projectName": "Amazon Q4 Holiday Campaign",
    "summary": "...",
    "assetInventory": {...},
    "brandBasics": {...},
    "suggestedStartingFile": "Brand_Guidelines_2024.pdf",
    "criticalBlockers": []
  },

  // Performance summary
  "performance": {
    "processing_time_ms": 87432,
    "target_ms": 120000,
    "target_met": true
  }
}
```

**Performance Expectations:**
- **Extension categorization**: <1 second for 1000+ files
- **Logo detection**: ~10ms per image
- **Color extraction**: ~160ms per logo (max 5 logos)
- **Document scanning**: ~1 second per PDF
- **Brief generation**: <1 second
- **Total target**: <2 minutes (120,000ms)

---

### 2. Get Asset Pack by ID

**GET** `/:id`

Retrieve complete asset pack details including all enhanced metadata.

**Response (200 OK):**
```json
{
  "id": "uuid",
  "campaign_id": "uuid",
  // ... all fields from upload response ...
  "processing_time_ms": 87432,
  "brand_colors": [...],
  "minimal_brief": "...",
  "minimal_brief_json": {...}
}
```

---

### 3. Get Asset Pack Files (Enhanced)

**GET** `/:id/files`

Get all files with enhanced metadata, sorted by suggested starting file first.

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "asset_pack_id": "uuid",
    "original_filename": "Brand_Guidelines_2024.pdf",
    "s3_key": "...",
    "s3_url": "...",
    "category": "reference",
    "suggested_starting_file": true,
    "is_likely_logo": false,
    "uploaded_at": "2024-01-15T10:30:15Z"
  },
  {
    "original_filename": "logo_primary.png",
    "category": "images",
    "is_likely_logo": true,
    "logo_confidence": "high",
    "logo_detection_reasons": ["Filename contains logo-related keyword", "Small dimensions (400x400px)"],
    "dimensions": {"width": 400, "height": 400},
    "suggested_starting_file": false,
    ...
  }
]
```

**Sort Order:**
1. Suggested starting file first
2. Then by category (source_files, images, video, reference, misc)
3. Then by upload time

---

### 4. Get Minimal Brief (NEW)

**GET** `/:id/brief`

Retrieve the minimal one-page brief for designer handoff.

**Response (200 OK):**
```json
{
  "text": "============================================================\nCREATIVE BRIEF: Amazon Q4 Holiday Campaign\n============================================================\n\nSUMMARY\n------------------------------------------------------------\nCampaign assets for Amazon Q4 Holiday Campaign. Includes 5 source files...",

  "structured": {
    "projectName": "Amazon Q4 Holiday Campaign",
    "summary": "Campaign assets for Amazon Q4 Holiday Campaign...",
    "assetInventory": {
      "source_files": 5,
      "images": 12,
      "video": 2,
      "reference": 4,
      "misc": 0,
      "total": 23
    },
    "brandBasics": {
      "brandColors": [
        {"hex": "#FF5733", "rgb": {"r": 255, "g": 87, "b": 51}, "percentage": 45.2}
      ],
      "brandGuidelinesDoc": "Brand_Guidelines_2024.pdf",
      "logoFiles": ["logo_primary.png", "logo_secondary.svg", "logo_icon.png"]
    },
    "suggestedStartingFile": "Brand_Guidelines_2024.pdf",
    "criticalBlockers": [
      "No brand guidelines detected. May need to request from client if not in reference docs."
    ],
    "generatedAt": "2024-01-15T10:30:00Z",
    "processingTimeMs": 234
  }
}
```

**Use Cases:**
- Display in designer portal for quick onboarding
- Email to designer as plain text brief
- Programmatic access to project summary

---

### 5. Get Processing Performance Metrics (NEW)

**GET** `/:id/performance`

Retrieve detailed performance metrics for the asset pack processing.

**Response (200 OK):**
```json
{
  "processing_time_ms": 87432,
  "target_ms": 120000,
  "target_met": true,
  "categorization_method": "extension-based",
  "total_files": 23,
  "total_size_bytes": 45678900,
  "quick_scan_flags": {
    "logo_count": 3,
    "brand_guidelines_found": true,
    "campaign_brief_found": true,
    "suggested_starting_file": "Brand_Guidelines_2024.pdf"
  },
  "brand_colors": [
    {"hex": "#FF5733", "rgb": {"r": 255, "g": 87, "b": 51}, "percentage": 45.2},
    {"hex": "#2C3E50", "rgb": {"r": 44, "g": 62, "b": 80}, "percentage": 28.7}
  ],
  "processed_at": "2024-01-15T10:30:00Z"
}
```

**Use Cases:**
- Monitor Phase 1 performance targets
- Identify processing bottlenecks
- Track categorization accuracy
- Verify <2 minute target is met

---

### 6. Get Asset Packs by Campaign

**GET** `/campaign/:campaignId`

Get all asset packs for a campaign.

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "campaign_id": "uuid",
    "processing_time_ms": 87432,
    "brand_colors": [...],
    "minimal_brief": "...",
    ...
  }
]
```

---

### 7. Approve Asset Pack

**POST** `/:id/approve`

Approve asset pack and start 48h SLA timer.

**Request:**
```json
{
  "reviewed_by": "am@kargo.com"
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "status": "approved",
  "reviewed_by": "am@kargo.com",
  "reviewed_at": "2024-01-15T11:00:00Z",
  ...
}
```

---

### 8. Reject Asset Pack

**POST** `/:id/reject`

Reject asset pack with **MANDATORY** rejection note.

**Request:**
```json
{
  "reviewed_by": "am@kargo.com",
  "rejection_note": "Missing brand guidelines and high-res logo files"
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "status": "rejected",
  "reviewed_by": "am@kargo.com",
  "reviewed_at": "2024-01-15T11:00:00Z",
  "rejection_note": "Missing brand guidelines and high-res logo files",
  ...
}
```

**Validation:**
- `rejection_note` is **REQUIRED** and cannot be empty
- Returns 400 Bad Request if rejection note is missing

---

### 9. Delete Asset Pack File

**DELETE** `/files/:fileId`

Delete a single file from an asset pack.

**Response (204 No Content)**

---

## Enhanced Metadata Fields

### Asset Pack Level

| Field | Type | Description |
|-------|------|-------------|
| `processing_time_ms` | number | Total processing time in milliseconds |
| `categorization_method` | string | Always "extension-based" in Phase 1 |
| `quick_scan_flags` | object | Document scan results, logo count, suggestions |
| `brand_colors` | array | Top 3-5 dominant colors from detected logos |
| `minimal_brief` | string | Plain text one-page brief |
| `minimal_brief_json` | object | Structured brief data |

### File Level

| Field | Type | Description |
|-------|------|-------------|
| `is_likely_logo` | boolean | Logo detection result |
| `logo_confidence` | string | "high", "medium", "low" |
| `logo_detection_reasons` | array | Why file was flagged as logo |
| `dimensions` | object | `{width: number, height: number}` |
| `filename_patterns` | array | Matched keywords in filename |
| `suggested_starting_file` | boolean | Priority file for designer |

---

## Category Mappings

### Extension-Based Categorization

| Category | Extensions |
|----------|------------|
| `source_files` | .psd, .ai, .sketch, .fig, .xd, .indd |
| `images` | .jpg, .jpeg, .png, .gif, .svg, .webp, .bmp, .tiff, .ico |
| `video` | .mp4, .mov, .avi, .webm, .mkv, .flv, .wmv, .m4v |
| `reference` | .pdf, .doc, .docx, .txt, .md, .xlsx, .ppt, .pptx |
| `misc` | All other extensions |

---

## Performance Targets

### Overall Target: <2 Minutes (120,000ms)

| Phase | Target Time | Description |
|-------|-------------|-------------|
| Extension categorization | <1 second | Rule-based sorting of all files |
| S3 upload | Variable | Depends on file sizes and count |
| Logo detection | ~10ms/image | Dimension heuristic + filename patterns |
| Color extraction | ~160ms/logo | Max 5 logos processed |
| Document scanning | ~1s/document | Keyword flagging, no OCR |
| Brief generation | <1 second | Template-based generation |

### Success Criteria

✅ **95%+ of uploads complete in <2 minutes**
✅ **Extension categorization: 90-95% accuracy**
✅ **Logo detection: 85-90% accuracy (dimension only), 95%+ (combined)**
✅ **Color extraction: 95%+ accuracy for detected logos**
✅ **Document flagging: 80%+ accuracy**

---

## Error Handling

### Non-Fatal Errors

Logo detection and document scanning errors are non-fatal. Processing continues with limited metadata:

```json
{
  "is_likely_logo": false,
  "logo_confidence": null,
  "logo_detection_reasons": null,
  "dimensions": null
}
```

### Fatal Errors

- Database connection failures
- S3 upload failures
- Transaction rollback on any core processing error

---

## Progressive Disclosure Strategy

### Essentials (Upfront - Phase 1)
✅ Extension-based categorization
✅ File counts and sizes
✅ Logo detection (heuristics)
✅ Selective color extraction (top 3-5 logos)
✅ Document keyword flagging
✅ Minimal one-page brief

### Advanced (On-Demand - Future)
⏳ Full AI categorization with Claude
⏳ Deep OCR for all documents
⏳ Comprehensive 3-5 page brief
⏳ Layout analysis
⏳ Content extraction

---

## Migration Notes

### Breaking Changes from Previous API

1. **Endpoint method renamed**: `uploadAssetPack()` → `createAssetPack()`
2. **Enhanced response structure**: All endpoints now return enhanced metadata
3. **New endpoints added**:
   - `GET /:id/brief` - Get minimal brief
   - `GET /:id/performance` - Get performance metrics
4. **File ordering changed**: Suggested starting file now appears first

### Backward Compatibility

All existing fields are preserved. New fields are additive and optional for clients that don't need them.

---

## Examples

### Upload Asset Pack with ZIP

```bash
curl -X POST http://localhost:4000/api/asset-packs \
  -F "files=@campaign_assets.zip" \
  -F "campaign_id=uuid" \
  -F "uploaded_by_email=client@example.com" \
  -F "upload_method=portal" \
  -F "client_notes=Q4 holiday campaign assets"
```

### Get Minimal Brief

```bash
curl http://localhost:4000/api/asset-packs/{id}/brief
```

### Get Performance Metrics

```bash
curl http://localhost:4000/api/asset-packs/{id}/performance
```

### Get Files Ordered by Priority

```bash
curl http://localhost:4000/api/asset-packs/{id}/files
```

---

## Monitoring & Analytics

Track Phase 1 performance with the materialized view:

```sql
SELECT * FROM phase1_performance_analytics
WHERE processing_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY processing_date DESC;
```

Refresh the view:

```sql
REFRESH MATERIALIZED VIEW phase1_performance_analytics;
```

---

## Next Steps

1. ✅ Routes updated with enhanced metadata
2. ⏳ Run database migration (102_phase1_optimization.sql)
3. ⏳ Test end-to-end workflow with real files
4. ⏳ Verify <2 minute processing target
5. ⏳ Monitor performance analytics
6. ⏳ Add dependencies (sharp, pdf-parse) to package.json
