# Phase 1 Enhanced Workflow - Testing Guide

## Overview

This guide provides comprehensive testing procedures to verify the Phase 1 enhanced workflow meets all performance targets and accuracy requirements.

## Prerequisites

### 1. Database Migration

Run the Phase 1 optimization migration:

```bash
cd /Users/brandon.nye/Documents/CudaCode\ Workspace/projects/kargo/creative-approval-system/backend

# Check migration status
npm run migrate:status

# Run migration 102
npm run migrate
```

**Verify migration success:**
```sql
-- Check new columns exist
\d asset_packs
\d asset_pack_files

-- Verify materialized view was created
\dv phase1_performance_analytics
```

### 2. Install Dependencies

All required dependencies are already in package.json:
```bash
npm install
```

### 3. Environment Setup

Ensure `.env` has required S3 and database configuration:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/kcap
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=kcap-assets
```

---

## Test Scenarios

### Test 1: Basic Upload with Mixed File Types

**Objective**: Verify extension-based categorization and basic processing

**Test Files:**
```
test-assets/
├── logo.png (400x400px)
├── hero-image.jpg (1920x1080px)
├── Brand_Guidelines.pdf
├── campaign-brief.psd
└── video-ad.mp4
```

**Expected Results:**
- ✅ All files categorized correctly by extension
- ✅ `logo.png` flagged as likely logo (high confidence)
- ✅ `Brand_Guidelines.pdf` flagged as brand_guidelines
- ✅ `Brand_Guidelines.pdf` set as suggested starting file
- ✅ Processing time <120,000ms
- ✅ Brand colors extracted from logo.png only

**API Request:**
```bash
curl -X POST http://localhost:4000/api/asset-packs \
  -F "files=@logo.png" \
  -F "files=@hero-image.jpg" \
  -F "files=@Brand_Guidelines.pdf" \
  -F "files=@campaign-brief.psd" \
  -F "files=@video-ad.mp4" \
  -F "campaign_id=test-campaign-001" \
  -F "uploaded_by_email=tester@example.com"
```

**Validation Queries:**
```sql
-- Check asset pack was created with enhanced metadata
SELECT
  id, processing_time_ms, categorization_method,
  quick_scan_flags, brand_colors, minimal_brief IS NOT NULL as has_brief
FROM asset_packs
WHERE uploaded_by = 'tester@example.com'
ORDER BY created_at DESC LIMIT 1;

-- Check files were categorized and logo detected
SELECT
  original_filename, category,
  is_likely_logo, logo_confidence,
  suggested_starting_file
FROM asset_pack_files
WHERE asset_pack_id = 'uuid-from-above'
ORDER BY suggested_starting_file DESC NULLS LAST;
```

**Expected Category Breakdown:**
```json
{
  "source_files": 1,  // campaign-brief.psd
  "images": 2,        // logo.png, hero-image.jpg
  "video": 1,         // video-ad.mp4
  "reference": 1,     // Brand_Guidelines.pdf
  "misc": 0
}
```

---

### Test 2: ZIP File Extraction

**Objective**: Verify ZIP files are extracted and processed

**Test File:**
```
campaign-assets.zip
├── assets/
│   ├── logo_primary.png
│   ├── logo_secondary.svg
│   └── style-guide.pdf
└── templates/
    ├── ad-template.ai
    └── social-template.psd
```

**Expected Results:**
- ✅ ZIP extracted to flat structure
- ✅ All files marked as `is_extracted_from_zip: true`
- ✅ Both logos detected and used for color extraction
- ✅ `style-guide.pdf` flagged as brand_guidelines
- ✅ Processing time <120,000ms

**API Request:**
```bash
curl -X POST http://localhost:4000/api/asset-packs \
  -F "files=@campaign-assets.zip" \
  -F "campaign_id=test-campaign-002" \
  -F "uploaded_by_email=tester@example.com"
```

**Validation:**
```sql
-- Check all files were extracted
SELECT COUNT(*) FROM asset_pack_files
WHERE asset_pack_id = 'uuid'
AND is_extracted_from_zip = true;
-- Expected: 5 files

-- Check logos detected
SELECT original_filename, is_likely_logo, logo_confidence
FROM asset_pack_files
WHERE asset_pack_id = 'uuid'
AND is_likely_logo = true;
-- Expected: 2 logos
```

---

### Test 3: Large Upload (Performance Target)

**Objective**: Verify <2 minute processing target with realistic file count

**Test Files:**
- 10 source files (.psd, .ai, .sketch)
- 25 images (.jpg, .png)
- 5 videos (.mp4, .mov)
- 8 reference docs (.pdf, .docx)
- **Total: 48 files, ~500MB**

**Expected Results:**
- ✅ Processing time <120,000ms (2 minutes)
- ✅ Max 5 logos processed for color extraction
- ✅ All files categorized correctly
- ✅ Minimal brief generated
- ✅ Performance breakdown logged

**Validation:**
```bash
# Check server logs for processing breakdown
tail -f logs/app.log | grep "Asset pack processing complete"
```

**Expected Log Output:**
```json
{
  "message": "Asset pack processing complete",
  "assetPackId": "uuid",
  "totalProcessingTimeMs": 95234,
  "breakdown": {
    "categorization": 42,
    "upload": 82341,
    "logoDetection": 8234,
    "documentScan": 3421,
    "briefGeneration": 196
  },
  "targetMet": true
}
```

---

### Test 4: Logo Detection Accuracy

**Objective**: Verify logo detection heuristics (dimension + filename)

**Test Files:**
```
logos/
├── logo_primary.png (300x300px)        # High confidence (both)
├── icon.svg (64x64px)                  # High confidence (both)
├── brand-mark.png (150x150px)          # High confidence (both)
├── hero-banner.jpg (1920x400px)        # Not logo (dimensions)
├── logo-large.png (2000x2000px)        # Medium confidence (filename only)
└── screenshot.png (400x400px)          # Medium confidence (dimensions only)
```

**Expected Logo Detection:**
```json
[
  {"filename": "logo_primary.png", "confidence": "high"},
  {"filename": "icon.svg", "confidence": "high"},
  {"filename": "brand-mark.png", "confidence": "high"},
  {"filename": "logo-large.png", "confidence": "medium"},
  {"filename": "screenshot.png", "confidence": "medium"}
]
```

**Top 5 Selected for Color Extraction:**
1. logo_primary.png (high)
2. icon.svg (high)
3. brand-mark.png (high)
4. logo-large.png (medium)
5. screenshot.png (medium)

**Validation:**
```sql
SELECT
  original_filename,
  is_likely_logo,
  logo_confidence,
  logo_detection_reasons,
  dimensions
FROM asset_pack_files
WHERE asset_pack_id = 'uuid'
AND category = 'images'
ORDER BY
  CASE logo_confidence
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    ELSE 3
  END;
```

---

### Test 5: Document Scanning

**Objective**: Verify keyword flagging without OCR

**Test Files:**
```
documents/
├── Brand_Guidelines_2024.pdf           # brand_guidelines
├── Campaign_Brief_Q4.pdf               # campaign_brief
├── Product_Specs.pdf                   # specs
├── Copy_Requirements.docx              # copy
├── Reference_Inspiration.pdf           # reference
└── Random_Invoice.pdf                  # (no flags)
```

**Expected Flags:**
```json
{
  "Brand_Guidelines_2024.pdf": ["brand_guidelines"],
  "Campaign_Brief_Q4.pdf": ["campaign_brief"],
  "Product_Specs.pdf": ["specs"],
  "Copy_Requirements.docx": ["copy"],
  "Reference_Inspiration.pdf": ["reference"],
  "Random_Invoice.pdf": []
}
```

**Validation:**
```bash
curl http://localhost:4000/api/asset-packs/{id} | jq '.quick_scan_flags'
```

**Expected Response:**
```json
{
  "logo_count": 0,
  "brand_guidelines_found": true,
  "campaign_brief_found": true,
  "suggested_starting_file": "Campaign_Brief_Q4.pdf"
}
```

---

### Test 6: Minimal Brief Generation

**Objective**: Verify brief contains essential information only

**Test Upload:**
- 5 source files
- 12 images (3 detected as logos)
- 2 videos
- 4 reference docs
- Brand guidelines found
- Campaign brief found

**Expected Brief Structure:**
```json
{
  "projectName": "campaign_id",
  "summary": "Campaign assets for campaign_id. Includes 5 source files, 12 images, 2 videos, 4 reference docs. Assets organized and ready for designer review.",
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
      {"hex": "#FF5733", "rgb": {...}, "percentage": 45.2}
    ],
    "brandGuidelinesDoc": "Brand_Guidelines_2024.pdf",
    "logoFiles": ["logo1.png", "logo2.svg", "logo3.png"]
  },
  "suggestedStartingFile": "Campaign_Brief_Q4.pdf",
  "criticalBlockers": [],
  "generatedAt": "2024-01-15T10:30:00Z",
  "processingTimeMs": 234
}
```

**Validation:**
```bash
# Get plain text brief
curl http://localhost:4000/api/asset-packs/{id}/brief | jq -r '.text'

# Get structured brief
curl http://localhost:4000/api/asset-packs/{id}/brief | jq '.structured'
```

**Brief Quality Checklist:**
- ✅ Summary is 2-3 sentences maximum
- ✅ Asset inventory shows accurate counts
- ✅ Brand colors limited to top 5-6
- ✅ Suggested starting file is campaign brief OR brand guidelines OR first source file
- ✅ Critical blockers only show major issues (no source files, no guidelines when needed)

---

### Test 7: Suggested Starting File Logic

**Objective**: Verify correct file prioritization

**Test Scenarios:**

**Scenario A: Campaign brief present**
```
Files: campaign-brief.pdf, brand-guidelines.pdf, template.psd
Expected: campaign-brief.pdf
```

**Scenario B: No campaign brief, brand guidelines present**
```
Files: brand-guidelines.pdf, master-template.psd, logo.png
Expected: brand-guidelines.pdf
```

**Scenario C: No briefs or guidelines, source file with "master" in name**
```
Files: master-template.psd, template-v2.ai, hero.jpg
Expected: master-template.psd
```

**Scenario D: No special files**
```
Files: template1.psd, template2.ai, logo.png
Expected: template1.psd (first source file alphabetically)
```

**Validation:**
```sql
SELECT
  original_filename,
  suggested_starting_file,
  category
FROM asset_pack_files
WHERE asset_pack_id = 'uuid'
ORDER BY suggested_starting_file DESC NULLS LAST
LIMIT 1;
```

---

### Test 8: Performance Monitoring

**Objective**: Verify performance analytics tracking

**Setup:**
Upload 3 asset packs over a few days with varying complexity.

**Validation:**
```sql
-- Check materialized view has data
SELECT * FROM phase1_performance_analytics
ORDER BY processing_date DESC;

-- Expected output:
-- processing_date | categorization_method | upload_count | avg_processing_time_ms | p95_processing_time_ms
-- 2024-01-15      | extension-based       | 3            | 87432                  | 95234
```

**Refresh view:**
```sql
REFRESH MATERIALIZED VIEW phase1_performance_analytics;
```

---

### Test 9: Error Handling

**Objective**: Verify non-fatal errors don't block processing

**Test Scenarios:**

**A. Corrupted image file (logo detection fails)**
```
Expected: File still uploaded, is_likely_logo = false, dimensions = null
```

**B. Encrypted PDF (document scan fails)**
```
Expected: File still uploaded, no document flags, processing continues
```

**C. Unsupported file type**
```
Expected: File categorized as 'misc', no logo detection attempted
```

**Validation:**
Check logs for non-fatal errors:
```bash
tail -f logs/app.log | grep "Logo detection failed"
tail -f logs/app.log | grep "Document scan failed"
```

**Expected Behavior:**
- Errors logged as warnings
- Processing continues
- Affected files have null metadata
- Overall processing completes successfully

---

### Test 10: API Response Validation

**Objective**: Verify all new endpoints return correct data

**A. Upload Response**
```bash
UPLOAD_RESPONSE=$(curl -X POST http://localhost:4000/api/asset-packs \
  -F "files=@test.zip" \
  -F "campaign_id=test" \
  -F "uploaded_by_email=test@example.com")

# Verify response has enhanced metadata
echo $UPLOAD_RESPONSE | jq '.processing_time_ms'
echo $UPLOAD_RESPONSE | jq '.brand_colors'
echo $UPLOAD_RESPONSE | jq '.minimal_brief'
echo $UPLOAD_RESPONSE | jq '.performance.target_met'
```

**B. Brief Endpoint**
```bash
curl http://localhost:4000/api/asset-packs/{id}/brief | jq '.'
# Expected: {text: "...", structured: {...}}
```

**C. Performance Endpoint**
```bash
curl http://localhost:4000/api/asset-packs/{id}/performance | jq '.'
# Expected: {processing_time_ms, target_ms, target_met, ...}
```

**D. Files Endpoint (with ordering)**
```bash
curl http://localhost:4000/api/asset-packs/{id}/files | jq '.[0].suggested_starting_file'
# Expected: true (first file should be suggested starting file)
```

---

## Performance Benchmarks

### Target Breakdown

| File Count | Total Size | Expected Processing Time |
|-----------|------------|-------------------------|
| 1-10 files | <100MB | <30 seconds |
| 11-25 files | <250MB | <60 seconds |
| 26-50 files | <500MB | <120 seconds |

### Processing Phase Targets

| Phase | Target | Notes |
|-------|--------|-------|
| Extension categorization | <1s | For 1000+ files |
| S3 upload | Variable | Network dependent |
| Logo detection | ~10ms/image | Max 50 images processed |
| Color extraction | ~160ms/logo | Max 5 logos processed |
| Document scanning | ~1s/doc | Keyword flagging only |
| Brief generation | <1s | Template based |

---

## Success Criteria

### Functional Requirements

- ✅ All files categorized by extension
- ✅ ZIP files extracted correctly
- ✅ Logos detected with 85-90% accuracy (dimension) / 95%+ (combined)
- ✅ Top 5 logos selected for color extraction
- ✅ Brand colors extracted accurately
- ✅ Documents flagged by keywords (80%+ accuracy)
- ✅ Minimal brief generated with essential info
- ✅ Suggested starting file prioritized correctly
- ✅ All database migrations applied successfully

### Performance Requirements

- ✅ 95%+ of uploads complete in <2 minutes
- ✅ Processing time tracked and logged
- ✅ Performance analytics view populated
- ✅ Target met flag accurate

### API Requirements

- ✅ All endpoints return enhanced metadata
- ✅ New /brief and /performance endpoints functional
- ✅ Files ordered by suggested starting file first
- ✅ Error handling doesn't block processing

---

## Troubleshooting

### Issue: Processing time exceeds 2 minutes

**Possible Causes:**
- Large video files slowing S3 upload
- Too many images triggering logo detection
- Network latency to S3

**Solutions:**
- Check S3 upload time in breakdown log
- Verify max 50 images processed for logo detection
- Consider S3 transfer acceleration
- Check network connectivity

### Issue: Logo detection not working

**Possible Causes:**
- Sharp library not installed
- Images corrupted or unsupported format
- Dimensions metadata not available

**Solutions:**
```bash
npm install sharp
```
- Check logs for sharp errors
- Verify image file format is supported

### Issue: Document scanning missing keywords

**Possible Causes:**
- PDF encrypted or password protected
- Keyword patterns too strict
- Filename doesn't match patterns

**Solutions:**
- Review keyword patterns in document-scanner.ts
- Check PDF metadata extraction
- Test with sample documents

### Issue: Brief not generated

**Possible Causes:**
- Missing category stats
- Error in brief generation logic

**Solutions:**
- Check logs for brief generation errors
- Verify categoryStats object is populated
- Test minimal-brief-generator.ts in isolation

---

## Next Steps After Testing

1. ✅ Verify all tests pass
2. ⏳ Monitor production uploads for 1 week
3. ⏳ Collect performance metrics
4. ⏳ Adjust thresholds based on real data
5. ⏳ Consider future enhancements (AI categorization, deep OCR)

---

## Test Checklist

- [ ] Database migration 102 applied successfully
- [ ] All dependencies installed (sharp, pdf-parse)
- [ ] Test 1: Basic upload with mixed file types - PASS
- [ ] Test 2: ZIP file extraction - PASS
- [ ] Test 3: Large upload (<2 minute target) - PASS
- [ ] Test 4: Logo detection accuracy - PASS
- [ ] Test 5: Document scanning - PASS
- [ ] Test 6: Minimal brief generation - PASS
- [ ] Test 7: Suggested starting file logic - PASS
- [ ] Test 8: Performance monitoring - PASS
- [ ] Test 9: Error handling - PASS
- [ ] Test 10: API response validation - PASS
- [ ] Performance benchmarks met
- [ ] All API endpoints functional
- [ ] Logs show detailed processing breakdown
- [ ] Ready for production deployment

---

## Automated Test Suite (Future)

Create Jest integration tests:

```typescript
// tests/integration/phase1-workflow.test.ts
describe('Phase 1 Enhanced Workflow', () => {
  it('should process upload in <2 minutes', async () => {
    const response = await uploadTestFiles();
    expect(response.processing_time_ms).toBeLessThan(120000);
  });

  it('should detect logos accurately', async () => {
    const files = await getAssetPackFiles(assetPackId);
    const logos = files.filter(f => f.is_likely_logo);
    expect(logos.length).toBeGreaterThan(0);
  });

  // Add more automated tests...
});
```
