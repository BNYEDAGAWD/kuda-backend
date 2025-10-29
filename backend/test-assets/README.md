# KUDA Phase 1 Test Assets

This directory contains test files for validating Phase 1 enhanced asset pack processing.

## Test File Requirements

To properly test Phase 1 features, you need:

### 1. Logo Files (for logo detection & color extraction)
- **Requirement**: Small image files (< 500x500px recommended)
- **Formats**: .png, .jpg, .svg
- **Filenames**: Should contain keywords like "logo", "icon", "brand"
- **Examples**:
  - `kargo-logo.png`
  - `brand-icon.svg`
  - `company-logo-black.png`

### 2. Brand Guidelines Document (for document scanning)
- **Requirement**: PDF file containing brand standards
- **Keywords**: Should contain "brand guidelines", "style guide", or "brand standards"
- **Example filename**: `brand-guidelines.pdf`

### 3. Campaign Brief Document (for document scanning)
- **Requirement**: PDF file with campaign information
- **Keywords**: Should contain "campaign brief", "creative brief", or "project brief"
- **Example filename**: `campaign-brief-q4-2025.pdf`

### 4. Source Files (for categorization)
- **Formats**: .psd, .ai, .sketch, .fig
- **Purpose**: Tests extension-based categorization
- **Examples**:
  - `billboard-970x250.psd`
  - `hero-banner.ai`

### 5. Reference Images (for categorization)
- **Formats**: .jpg, .png, .gif
- **Purpose**: Tests image categorization
- **Examples**:
  - `product-photo.jpg`
  - `background-texture.png`

### 6. Video Files (for categorization)
- **Formats**: .mp4, .mov
- **Purpose**: Tests video categorization
- **Examples**:
  - `product-demo.mp4`
  - `brand-video.mov`

## Creating Test Files

### Option 1: Use Placeholder Files (Quick Testing)

```bash
# Create simple test files
cd test-assets

# Create a simple logo image (requires ImageMagick)
convert -size 200x200 xc:blue -fill white -pointsize 72 -gravity center \
  -draw "text 0,0 'LOGO'" kargo-logo.png

# Create a simple PDF (requires pdflatex or similar)
echo "Brand Guidelines

Logo Usage:
- Maintain clear space
- Use approved colors only
- Do not distort or modify

Brand Colors:
- Primary: #0066CC
- Secondary: #FF6600" > brand-guidelines.txt

# Convert to PDF (requires pandoc or similar)
pandoc brand-guidelines.txt -o brand-guidelines.pdf
```

### Option 2: Use Real Assets (Comprehensive Testing)

Place actual client assets (ensuring they're cleared for testing) in this directory:

```bash
test-assets/
├── kargo-logo.png           # 200x200px logo
├── brand-icon.svg           # Vector logo
├── brand-guidelines.pdf     # 5-page brand standards
├── campaign-brief.pdf       # 2-page campaign overview
├── hero-banner.psd          # Source file
├── billboard-970x250.ai     # Source file
├── product-photo.jpg        # Reference image
├── background.png           # Reference image
├── demo-video.mp4           # Video asset
└── README.md                # This file
```

## Running Phase 1 Tests

Once test files are in place:

```bash
# 1. Start the backend server
cd backend
npm run dev

# 2. Upload test asset pack
curl -X POST http://localhost:4000/api/asset-packs \
  -F "files=@test-assets/kargo-logo.png" \
  -F "files=@test-assets/brand-guidelines.pdf" \
  -F "files=@test-assets/campaign-brief.pdf" \
  -F "campaign_id=test-campaign-001" \
  -F "uploaded_by_email=test@kargo.com" \
  -F "upload_method=portal"

# 3. Expected response includes:
# - processing_time_ms < 120000 (2 minutes)
# - brand_colors: [array of colors]
# - minimal_brief: "text brief"
# - minimal_brief_json: {structured data}
# - quick_scan_flags: {logo_count, brand_guidelines_found, etc.}
# - files: [array with is_likely_logo flags]
```

## Validation Checklist

After upload, verify:

- [ ] Upload completes successfully (201 status)
- [ ] Processing time < 2 minutes
- [ ] Logo files flagged with `is_likely_logo: true`
- [ ] Brand colors extracted from logos
- [ ] Brand guidelines PDF flagged in `quick_scan_flags`
- [ ] Campaign brief PDF flagged in `quick_scan_flags`
- [ ] Files categorized correctly (source_files, images, video, reference)
- [ ] Minimal brief generated with all sections
- [ ] Suggested starting file identified
- [ ] No errors in server logs

## Performance Benchmarks

Expected processing times for typical uploads:

| Asset Count | File Types | Target Time | Acceptable Time |
|-------------|-----------|-------------|-----------------|
| 5 files | Mixed (logos, PDFs) | < 30 seconds | < 60 seconds |
| 20 files | Mostly images | < 60 seconds | < 90 seconds |
| 50 files | Full campaign pack | < 120 seconds | < 180 seconds |
| 100 files | Large archive | < 180 seconds | < 240 seconds |

## Troubleshooting

### Upload fails with "Dependencies missing"
- Ensure `sharp` and `pdf-parse` are installed: `npm install`
- Check `npm list sharp pdf-parse`

### Logo detection not working
- Verify logo files are < 500x500px
- Check filenames contain keywords: logo, icon, brand, mark
- Review server logs for image processing errors

### Document scanning not finding documents
- Verify PDFs contain text (not scanned images)
- Check PDF filenames and content for keywords
- Ensure `pdf-parse` is working: `npm list pdf-parse`

### Processing time > 2 minutes
- Check S3 upload speed (network latency)
- Review number of logo files (should extract colors from max 5)
- Check server logs for slow operations
- Consider reducing file count for testing

## Next Steps

After Phase 1 validation:

1. Review performance metrics in `phase1_performance_analytics` view
2. Test edge cases (ZIP extraction, large files, missing data)
3. Validate API endpoints (`/brief`, `/performance`, `/files`)
4. Proceed to Phase 2 (KUDA Ultimate Workflow) implementation

See `PHASE1_TESTING_GUIDE.md` for comprehensive testing scenarios.
