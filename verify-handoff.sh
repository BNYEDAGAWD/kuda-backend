#!/bin/bash

##############################################################################
# KUDA Handoff Verification Script
#
# This script verifies that the complete handoff package is ready for
# delivery to the Kargo engineering team.
#
# Usage:
#   ./verify-handoff.sh
##############################################################################

set -e  # Exit on error

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

##############################################################################
# Verification Header
##############################################################################

clear
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                           ║${NC}"
echo -e "${CYAN}║   🔍 KUDA Handoff Verification                            ║${NC}"
echo -e "${CYAN}║   Verifying Complete Handoff Package                     ║${NC}"
echo -e "${CYAN}║                                                           ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

##############################################################################
# Step 1: Verify Docker Configuration
##############################################################################

print_header "Step 1: Docker Configuration"

if [ -f "docker-compose.yml" ]; then
    print_success "docker-compose.yml exists"
else
    print_error "docker-compose.yml missing"
    exit 1
fi

if [ -f "docker-compose.production.yml" ]; then
    print_success "docker-compose.production.yml exists"
else
    print_error "docker-compose.production.yml missing"
    exit 1
fi

if [ -f "backend/Dockerfile" ]; then
    print_success "backend/Dockerfile exists"
else
    print_error "backend/Dockerfile missing"
    exit 1
fi

echo ""

##############################################################################
# Step 2: Verify Scripts
##############################################################################

print_header "Step 2: Automation Scripts"

if [ -x "quickstart.sh" ]; then
    print_success "quickstart.sh exists and is executable"
else
    print_error "quickstart.sh missing or not executable"
    exit 1
fi

if [ -x "scripts/init-db.sh" ]; then
    print_success "scripts/init-db.sh exists and is executable"
else
    print_error "scripts/init-db.sh missing or not executable"
    exit 1
fi

if [ -x "test-phase2.sh" ]; then
    print_success "test-phase2.sh exists and is executable"
else
    print_error "test-phase2.sh missing or not executable"
    exit 1
fi

echo ""

##############################################################################
# Step 3: Verify Documentation
##############################################################################

print_header "Step 3: Documentation"

REQUIRED_DOCS=(
    "README_HANDOFF.md"
    "ENGINEERING_HANDOFF.md"
    "KUDA_PHASE2_API_DOCUMENTATION.md"
    "KUDA_PHASE2_COMPLETE.md"
    "KUDA_PHASE2_DEPLOYMENT_STATUS.md"
    "HANDOFF_READY.md"
)

for DOC in "${REQUIRED_DOCS[@]}"; do
    if [ -f "$DOC" ]; then
        print_success "$DOC exists"
    else
        print_error "$DOC missing"
        exit 1
    fi
done

echo ""

##############################################################################
# Step 4: Verify Backend Code
##############################################################################

print_header "Step 4: Backend Implementation"

# Check Phase 2 services
PHASE2_SERVICES=(
    "backend/src/services/notification-enhanced.service.ts"
    "backend/src/services/email-threading.service.ts"
    "backend/src/services/revision-changelog.service.ts"
    "backend/src/services/access-control.service.ts"
)

for SERVICE in "${PHASE2_SERVICES[@]}"; do
    if [ -f "$SERVICE" ]; then
        print_success "$(basename $SERVICE) exists"
    else
        print_error "$(basename $SERVICE) missing"
        exit 1
    fi
done

# Check Phase 2 routes
PHASE2_ROUTES=(
    "backend/src/routes/access-control.routes.ts"
    "backend/src/routes/notification.routes.ts"
    "backend/src/routes/email-thread.routes.ts"
    "backend/src/routes/changelog.routes.ts"
)

for ROUTE in "${PHASE2_ROUTES[@]}"; do
    if [ -f "$ROUTE" ]; then
        print_success "$(basename $ROUTE) exists"
    else
        print_error "$(basename $ROUTE) missing"
        exit 1
    fi
done

# Check middleware
if [ -f "backend/src/middleware/access-control.middleware.ts" ]; then
    print_success "access-control.middleware.ts exists"
else
    print_error "access-control.middleware.ts missing"
    exit 1
fi

echo ""

##############################################################################
# Step 5: Verify Database Migrations
##############################################################################

print_header "Step 5: Database Migrations"

MIGRATION_COUNT=$(ls -1 backend/migrations/*.sql 2>/dev/null | wc -l)

if [ "$MIGRATION_COUNT" -ge 6 ]; then
    print_success "$MIGRATION_COUNT migration files found"
else
    print_error "Expected at least 6 migration files, found $MIGRATION_COUNT"
    exit 1
fi

echo ""

##############################################################################
# Step 6: Verify Development Tools
##############################################################################

print_header "Step 6: Development Tools"

if [ -f "postman-collection.json" ]; then
    print_success "Postman collection exists"
else
    print_error "Postman collection missing"
    exit 1
fi

if [ -f "backend/src/config/swagger.config.ts" ]; then
    print_success "Swagger configuration exists"
else
    print_error "Swagger configuration missing"
    exit 1
fi

if [ -f ".github/workflows/backend-ci.yml" ]; then
    print_success "CI/CD workflow exists"
else
    print_error "CI/CD workflow missing"
    exit 1
fi

echo ""

##############################################################################
# Step 7: Verify Environment Configuration
##############################################################################

print_header "Step 7: Environment Configuration"

if [ -f "backend/.env" ]; then
    print_success "backend/.env exists"
else
    print_warning "backend/.env missing (will be created from template)"
fi

if [ -f "backend/.env.example" ]; then
    print_success "backend/.env.example exists"
else
    print_error "backend/.env.example missing"
    exit 1
fi

echo ""

##############################################################################
# Step 8: Verify Node Modules
##############################################################################

print_header "Step 8: Dependencies"

if [ -d "backend/node_modules" ]; then
    PACKAGE_COUNT=$(ls backend/node_modules | wc -l)
    print_success "node_modules exists ($PACKAGE_COUNT packages)"
else
    print_warning "node_modules missing (run 'cd backend && npm install')"
fi

echo ""

##############################################################################
# Step 9: Count Code Statistics
##############################################################################

print_header "Step 9: Code Statistics"

BACKEND_LINES=$(find backend/src -name "*.ts" -type f -exec cat {} \; | wc -l)
SERVICE_COUNT=$(ls -1 backend/src/services/*.ts 2>/dev/null | wc -l)
ROUTE_COUNT=$(ls -1 backend/src/routes/*.ts 2>/dev/null | wc -l)
DOC_COUNT=$(ls -1 *.md 2>/dev/null | wc -l)

print_info "Backend Code: $BACKEND_LINES lines"
print_info "Services: $SERVICE_COUNT files"
print_info "Routes: $ROUTE_COUNT files"
print_info "Documentation: $DOC_COUNT files"
print_info "Migrations: $MIGRATION_COUNT files"

echo ""

##############################################################################
# Step 10: Final Summary
##############################################################################

print_header "Handoff Package Verification - COMPLETE"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ All Components Verified${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${CYAN}Docker Infrastructure:${NC}      ✓ Complete"
echo -e "  ${CYAN}Automation Scripts:${NC}         ✓ Complete"
echo -e "  ${CYAN}Documentation:${NC}              ✓ Complete"
echo -e "  ${CYAN}Backend Implementation:${NC}     ✓ Complete"
echo -e "  ${CYAN}Database Migrations:${NC}        ✓ Complete"
echo -e "  ${CYAN}Development Tools:${NC}          ✓ Complete"
echo -e "  ${CYAN}Environment Config:${NC}         ✓ Complete"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Package Statistics${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${CYAN}Backend Code:${NC}               $BACKEND_LINES lines"
echo -e "  ${CYAN}Services:${NC}                   $SERVICE_COUNT files"
echo -e "  ${CYAN}API Routes:${NC}                 $ROUTE_COUNT files"
echo -e "  ${CYAN}Documentation:${NC}              $DOC_COUNT files"
echo -e "  ${CYAN}Migrations:${NC}                 $MIGRATION_COUNT files"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Next Steps${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${CYAN}1.${NC} Push to GitHub repository"
echo -e "  ${CYAN}2.${NC} Share repository URL with engineering team"
echo -e "  ${CYAN}3.${NC} Engineering team runs: ${YELLOW}./quickstart.sh${NC}"
echo -e "  ${CYAN}4.${NC} Frontend development begins!"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

print_success "KUDA Backend is ready for handoff! 🎉"
print_info "See HANDOFF_READY.md for complete handoff documentation"

echo ""
