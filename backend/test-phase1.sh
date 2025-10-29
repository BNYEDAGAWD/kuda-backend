#!/bin/bash
# KUDA Phase 1 Automated Testing Script
# Tests all Phase 1 enhanced asset pack processing features

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🧪 KUDA Phase 1 Validation Tests"
echo "================================="
echo ""

# Configuration
API_BASE_URL="http://localhost:4000/api"
TEST_CAMPAIGN_ID="test-campaign-$(date +%s)"
TEST_EMAIL="test@kargo.com"

# Check if server is running
echo -e "${BLUE}Checking if backend server is running...${NC}"
if ! curl -s -f "${API_BASE_URL}/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ Backend server is not running${NC}"
    echo "Please start the server with: npm run dev"
    exit 1
fi
echo -e "${GREEN}✅ Backend server is running${NC}"
echo ""

# Check if test assets exist
if [ ! -d "test-assets" ] || [ -z "$(ls -A test-assets 2>/dev/null)" ]; then
    echo -e "${YELLOW}⚠️  No test assets found in test-assets/ directory${NC}"
    echo "Please add test files before running tests."
    echo "See test-assets/README.md for guidance."
    exit 1
fi

# Count test files
file_count=$(find test-assets -type f ! -name "README.md" ! -name ".DS_Store" | wc -l | tr -d ' ')
echo -e "${BLUE}Found ${file_count} test file(s)${NC}"
echo ""

# Test 1: Upload Asset Pack
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}TEST 1: Upload Asset Pack${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Build curl command with all test files
CURL_CMD="curl -s -X POST ${API_BASE_URL}/asset-packs"
CURL_CMD="${CURL_CMD} -F campaign_id=${TEST_CAMPAIGN_ID}"
CURL_CMD="${CURL_CMD} -F uploaded_by_email=${TEST_EMAIL}"
CURL_CMD="${CURL_CMD} -F upload_method=portal"

for file in test-assets/*; do
    if [[ -f "$file" && "$file" != *"README.md" && "$file" != *".DS_Store" ]]; then
        CURL_CMD="${CURL_CMD} -F files=@${file}"
    fi
done

echo "Uploading test assets..."
response=$(eval $CURL_CMD)

# Check if upload succeeded
if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Asset pack uploaded successfully${NC}"
    ASSET_PACK_ID=$(echo "$response" | jq -r '.id')
    echo "Asset Pack ID: ${ASSET_PACK_ID}"
else
    echo -e "${RED}❌ Upload failed${NC}"
    echo "$response" | jq '.' || echo "$response"
    exit 1
fi
echo ""

# Test 2: Verify Processing Time
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}TEST 2: Verify Processing Time${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

processing_time=$(echo "$response" | jq -r '.processing_time_ms')
target_time=120000 # 2 minutes

echo "Processing time: ${processing_time}ms"
echo "Target: < ${target_time}ms (2 minutes)"

if [ "$processing_time" -lt "$target_time" ]; then
    echo -e "${GREEN}✅ Processing time within target${NC}"
else
    echo -e "${YELLOW}⚠️  Processing time exceeds target${NC}"
fi
echo ""

# Test 3: Verify Logo Detection
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}TEST 3: Verify Logo Detection${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

logo_count=$(echo "$response" | jq -r '.quick_scan_flags.logo_count // 0')
echo "Logos detected: ${logo_count}"

if [ "$logo_count" -gt 0 ]; then
    echo -e "${GREEN}✅ Logo detection working${NC}"
else
    echo -e "${YELLOW}⚠️  No logos detected (may be expected if no logo files uploaded)${NC}"
fi
echo ""

# Test 4: Verify Brand Colors
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}TEST 4: Verify Brand Colors${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

colors_count=$(echo "$response" | jq -r '.brand_colors | length // 0')
echo "Brand colors extracted: ${colors_count}"

if [ "$colors_count" -gt 0 ]; then
    echo -e "${GREEN}✅ Color extraction working${NC}"
    echo "Colors:"
    echo "$response" | jq -r '.brand_colors[] | "  - \(.hex) (RGB: \(.rgb.r),\(.rgb.g),\(.rgb.b)) - \(.percentage)%"'
else
    echo -e "${YELLOW}⚠️  No colors extracted (may be expected if no logo files uploaded)${NC}"
fi
echo ""

# Test 5: Verify Document Scanning
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}TEST 5: Verify Document Scanning${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

brand_guidelines=$(echo "$response" | jq -r '.quick_scan_flags.brand_guidelines_found // false')
campaign_brief=$(echo "$response" | jq -r '.quick_scan_flags.campaign_brief_found // false')

echo "Brand guidelines found: ${brand_guidelines}"
echo "Campaign brief found: ${campaign_brief}"

if [ "$brand_guidelines" = "true" ] || [ "$campaign_brief" = "true" ]; then
    echo -e "${GREEN}✅ Document scanning working${NC}"
else
    echo -e "${YELLOW}⚠️  No documents detected (may be expected if no PDFs uploaded)${NC}"
fi
echo ""

# Test 6: Verify Minimal Brief
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}TEST 6: Verify Minimal Brief${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if echo "$response" | jq -e '.minimal_brief' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Minimal brief generated${NC}"
    brief_length=$(echo "$response" | jq -r '.minimal_brief | length')
    echo "Brief length: ${brief_length} characters"
else
    echo -e "${RED}❌ No minimal brief generated${NC}"
fi
echo ""

# Test 7: Test Brief Endpoint
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}TEST 7: Test Brief Endpoint${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

brief_response=$(curl -s "${API_BASE_URL}/asset-packs/${ASSET_PACK_ID}/brief")

if echo "$brief_response" | jq -e '.text' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Brief endpoint working${NC}"
else
    echo -e "${RED}❌ Brief endpoint failed${NC}"
fi
echo ""

# Test 8: Test Performance Endpoint
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}TEST 8: Test Performance Endpoint${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

perf_response=$(curl -s "${API_BASE_URL}/asset-packs/${ASSET_PACK_ID}/performance")

if echo "$perf_response" | jq -e '.processing_time_ms' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Performance endpoint working${NC}"
    echo "Performance metrics:"
    echo "  Processing time: $(echo "$perf_response" | jq -r '.processing_time_ms')ms"
    echo "  Target met: $(echo "$perf_response" | jq -r '.target_met')"
    echo "  Total files: $(echo "$perf_response" | jq -r '.total_files')"
else
    echo -e "${RED}❌ Performance endpoint failed${NC}"
fi
echo ""

# Test 9: Test Files Endpoint
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}TEST 9: Test Files Endpoint${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

files_response=$(curl -s "${API_BASE_URL}/asset-packs/${ASSET_PACK_ID}/files")

if echo "$files_response" | jq -e '.[0].id' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Files endpoint working${NC}"
    files_count=$(echo "$files_response" | jq '. | length')
    logos_found=$(echo "$files_response" | jq '[.[] | select(.is_likely_logo == true)] | length')
    echo "  Total files: ${files_count}"
    echo "  Logo files: ${logos_found}"
else
    echo -e "${RED}❌ Files endpoint failed${NC}"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}TEST SUMMARY${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Asset Pack ID: ${ASSET_PACK_ID}"
echo "Processing Time: ${processing_time}ms (target: <120,000ms)"
echo "Logos Detected: ${logo_count}"
echo "Colors Extracted: ${colors_count}"
echo "Documents Found: Brand Guidelines=${brand_guidelines}, Campaign Brief=${campaign_brief}"
echo ""

if [ "$processing_time" -lt "$target_time" ]; then
    echo -e "${GREEN}🎉 Phase 1 validation PASSED${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review detailed results in server logs"
    echo "2. Query phase1_performance_analytics view for metrics"
    echo "3. Test edge cases (ZIP extraction, large files)"
    echo "4. Proceed to Phase 2 implementation"
else
    echo -e "${YELLOW}⚠️  Phase 1 validation completed with warnings${NC}"
    echo ""
    echo "Review performance bottlenecks:"
    echo "1. Check S3 upload speed"
    echo "2. Review logo detection count (should be < 5)"
    echo "3. Check server logs for slow operations"
fi
echo ""
echo "See PHASE1_TESTING_GUIDE.md for comprehensive testing scenarios"
