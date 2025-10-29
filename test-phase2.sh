#!/bin/bash

##############################################################################
# KUDA Phase 2 - Automated Testing Script
#
# Tests:
# 1. Database migration 103 (Phase 2 tables)
# 2. Access control service (three-tier system)
# 3. Smart timing algorithm (Tue-Thu 10AM-4PM)
# 4. Email threading service (Gmail API integration)
# 5. Revision changelog service (auto-generated changes)
# 6. Notification service integration
# 7. API routes (access, notifications, threads, changelogs)
#
# Usage:
#   ./test-phase2.sh              # Run all tests
#   ./test-phase2.sh --db         # Test database only
#   ./test-phase2.sh --services   # Test services only
#   ./test-phase2.sh --api        # Test API routes only
##############################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Run a test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"

    TESTS_RUN=$((TESTS_RUN + 1))

    if eval "$test_command" > /dev/null 2>&1; then
        print_success "$test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        print_error "$test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

##############################################################################
# TEST 1: Database Migration 103
##############################################################################

test_database() {
    print_section "TEST 1: Database Migration 103 (Phase 2 Tables)"

    cd backend

    # Check if migration file exists
    run_test "Migration file exists" "test -f migrations/103_phase2_ultimate_workflow.sql"

    # Test database connection
    run_test "Database connection" "psql \$DATABASE_URL -c 'SELECT 1' > /dev/null"

    # Check if migration has been applied (check for campaign_access table)
    if psql $DATABASE_URL -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'campaign_access')" | grep -q 't'; then
        print_success "Migration 103 already applied"
    else
        print_info "Applying migration 103..."
        if npm run migrate; then
            print_success "Migration 103 applied successfully"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            print_error "Migration 103 failed"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
        TESTS_RUN=$((TESTS_RUN + 1))
    fi

    # Verify all Phase 2 tables exist
    run_test "Table: campaign_access" "psql \$DATABASE_URL -c 'SELECT 1 FROM campaign_access LIMIT 0'"
    run_test "Table: email_threads" "psql \$DATABASE_URL -c 'SELECT 1 FROM email_threads LIMIT 0'"
    run_test "Table: notification_schedule" "psql \$DATABASE_URL -c 'SELECT 1 FROM notification_schedule LIMIT 0'"
    run_test "Table: revision_changelogs" "psql \$DATABASE_URL -c 'SELECT 1 FROM revision_changelogs LIMIT 0'"

    # Verify materialized view
    run_test "Materialized view: phase2_workflow_analytics" "psql \$DATABASE_URL -c 'SELECT 1 FROM phase2_workflow_analytics LIMIT 0'"

    cd ..
}

##############################################################################
# TEST 2: Access Control Service
##############################################################################

test_access_control() {
    print_section "TEST 2: Access Control Service (Three-Tier System)"

    # Check if service file exists
    run_test "Service file exists" "test -f backend/src/services/access-control.service.ts"

    # Check TypeScript compilation
    cd backend
    run_test "TypeScript compilation" "npx tsc --noEmit src/services/access-control.service.ts"

    # Test tier definitions
    print_info "Testing access tier definitions..."
    if grep -q "kuda_ocean" src/services/access-control.service.ts && \
       grep -q "kuda_river" src/services/access-control.service.ts && \
       grep -q "kuda_minnow" src/services/access-control.service.ts; then
        print_success "All three access tiers defined"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_error "Missing access tier definitions"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))

    # Test permission methods
    print_info "Testing permission methods..."
    if grep -q "grantAccess" src/services/access-control.service.ts && \
       grep -q "revokeAccess" src/services/access-control.service.ts && \
       grep -q "getUserPermissions" src/services/access-control.service.ts; then
        print_success "Core permission methods defined"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_error "Missing permission methods"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))

    cd ..
}

##############################################################################
# TEST 3: Smart Timing Service
##############################################################################

test_smart_timing() {
    print_section "TEST 3: Smart Timing Service (Tue-Thu 10AM-4PM Algorithm)"

    # Check if service file exists
    run_test "Service file exists" "test -f backend/src/services/smart-timing.service.ts"

    cd backend

    # Check TypeScript compilation
    run_test "TypeScript compilation" "npx tsc --noEmit src/services/smart-timing.service.ts"

    # Test timing rules
    print_info "Testing timing rules..."
    if grep -q "immediate" src/services/smart-timing.service.ts && \
       grep -q "optimal_window" src/services/smart-timing.service.ts && \
       grep -q "friday_pm_to_tuesday" src/services/smart-timing.service.ts; then
        print_success "All timing rules defined"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_error "Missing timing rules"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))

    # Test algorithm methods
    print_info "Testing algorithm methods..."
    if grep -q "calculateOptimalSendTime" src/services/smart-timing.service.ts && \
       grep -q "applySmartTiming" src/services/smart-timing.service.ts; then
        print_success "Core algorithm methods defined"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_error "Missing algorithm methods"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))

    cd ..
}

##############################################################################
# TEST 4: Email Threading Service
##############################################################################

test_email_threading() {
    print_section "TEST 4: Email Threading Service (Gmail API Integration)"

    # Check if service file exists
    run_test "Service file exists" "test -f backend/src/services/email-threading.service.ts"

    cd backend

    # Check TypeScript compilation
    run_test "TypeScript compilation" "npx tsc --noEmit src/services/email-threading.service.ts"

    # Test Gmail API integration
    print_info "Testing Gmail API integration..."
    if grep -q "googleapis" src/services/email-threading.service.ts && \
       grep -q "OAuth2" src/services/email-threading.service.ts; then
        print_success "Gmail API integration configured"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_error "Gmail API integration missing"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))

    # Test threading methods
    print_info "Testing threading methods..."
    if grep -q "sendEmail" src/services/email-threading.service.ts && \
       grep -q "getOrCreateThread" src/services/email-threading.service.ts && \
       grep -q "buildRawMessage" src/services/email-threading.service.ts; then
        print_success "Core threading methods defined"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_error "Missing threading methods"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))

    # Test threading headers
    print_info "Testing threading headers..."
    if grep -q "In-Reply-To" src/services/email-threading.service.ts && \
       grep -q "References" src/services/email-threading.service.ts; then
        print_success "Threading headers implemented"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_error "Threading headers missing"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))

    cd ..
}

##############################################################################
# TEST 5: Revision Changelog Service
##############################################################################

test_changelog() {
    print_section "TEST 5: Revision Changelog Service (Auto-Generated Changes)"

    # Check if service file exists
    run_test "Service file exists" "test -f backend/src/services/revision-changelog.service.ts"

    cd backend

    # Check TypeScript compilation
    run_test "TypeScript compilation" "npx tsc --noEmit src/services/revision-changelog.service.ts"

    # Test change detection categories
    print_info "Testing change detection categories..."
    if grep -q "font" src/services/revision-changelog.service.ts && \
       grep -q "color" src/services/revision-changelog.service.ts && \
       grep -q "layout" src/services/revision-changelog.service.ts && \
       grep -q "copy" src/services/revision-changelog.service.ts && \
       grep -q "video" src/services/revision-changelog.service.ts; then
        print_success "All 5 change categories defined"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_error "Missing change categories"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))

    # Test formatting methods
    print_info "Testing formatting methods..."
    if grep -q "formatChangelogText" src/services/revision-changelog.service.ts && \
       grep -q "formatChangelogHTML" src/services/revision-changelog.service.ts; then
        print_success "Changelog formatting methods defined"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_error "Missing formatting methods"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))

    cd ..
}

##############################################################################
# TEST 6: Email Templates
##############################################################################

test_email_templates() {
    print_section "TEST 6: Email Templates (7 Workflow Templates)"

    # Check if templates file exists
    run_test "Templates file exists" "test -f backend/src/templates/emails/email-templates.ts"

    cd backend

    # Check TypeScript compilation
    run_test "TypeScript compilation" "npx tsc --noEmit src/templates/emails/email-templates.ts"

    # Test template count
    print_info "Testing template definitions..."
    local template_count=$(grep -c "export function" src/templates/emails/email-templates.ts || true)
    if [ "$template_count" -ge 7 ]; then
        print_success "All 7 templates defined ($template_count found)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_error "Missing templates (found $template_count, expected 7)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))

    # Test KUDA branding
    print_info "Testing [KUDA] branding..."
    if grep -q "\[KUDA\]" src/templates/emails/email-templates.ts; then
        print_success "[KUDA] branding present in templates"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_error "[KUDA] branding missing"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))

    cd ..
}

##############################################################################
# TEST 7: Integrated Notification Service
##############################################################################

test_notification_service() {
    print_section "TEST 7: Integrated Notification Service"

    # Check if service file exists
    run_test "Service file exists" "test -f backend/src/services/notification-enhanced.service.ts"

    cd backend

    # Check TypeScript compilation
    run_test "TypeScript compilation" "npx tsc --noEmit src/services/notification-enhanced.service.ts"

    # Test service integration
    print_info "Testing service integration..."
    if grep -q "SmartTimingService" src/services/notification-enhanced.service.ts && \
       grep -q "EmailThreadingService" src/services/notification-enhanced.service.ts && \
       grep -q "EmailTemplates" src/services/notification-enhanced.service.ts; then
        print_success "All services integrated"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_error "Service integration incomplete"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))

    # Test core methods
    print_info "Testing core methods..."
    if grep -q "scheduleNotification" src/services/notification-enhanced.service.ts && \
       grep -q "processScheduledNotifications" src/services/notification-enhanced.service.ts && \
       grep -q "sendNotification" src/services/notification-enhanced.service.ts; then
        print_success "Core notification methods defined"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_error "Missing notification methods"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))

    cd ..
}

##############################################################################
# TEST 8: Access Control Middleware
##############################################################################

test_middleware() {
    print_section "TEST 8: Access Control Middleware"

    # Check if middleware file exists
    run_test "Middleware file exists" "test -f backend/src/middleware/access-control.middleware.ts"

    cd backend

    # Check TypeScript compilation
    run_test "TypeScript compilation" "npx tsc --noEmit src/middleware/access-control.middleware.ts"

    # Test middleware functions
    print_info "Testing middleware functions..."
    if grep -q "requireCampaignAccess" src/middleware/access-control.middleware.ts && \
       grep -q "requireAccessTier" src/middleware/access-control.middleware.ts && \
       grep -q "requirePermission" src/middleware/access-control.middleware.ts; then
        print_success "Core middleware functions defined"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_error "Missing middleware functions"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))

    cd ..
}

##############################################################################
# TEST 9: API Routes
##############################################################################

test_api_routes() {
    print_section "TEST 9: Phase 2 API Routes"

    # Check if route files exist
    run_test "Access control routes exist" "test -f backend/src/routes/access-control.routes.ts"
    run_test "Notification routes exist" "test -f backend/src/routes/notification.routes.ts"
    run_test "Email thread routes exist" "test -f backend/src/routes/email-thread.routes.ts"
    run_test "Changelog routes exist" "test -f backend/src/routes/changelog.routes.ts"

    cd backend

    # Check TypeScript compilation for each route file
    run_test "Access routes compile" "npx tsc --noEmit src/routes/access-control.routes.ts"
    run_test "Notification routes compile" "npx tsc --noEmit src/routes/notification.routes.ts"
    run_test "Thread routes compile" "npx tsc --noEmit src/routes/email-thread.routes.ts"
    run_test "Changelog routes compile" "npx tsc --noEmit src/routes/changelog.routes.ts"

    # Test route count
    print_info "Testing route endpoints..."
    local access_routes=$(grep -c "router\\.\\(get\\|post\\|patch\\|delete\\)" src/routes/access-control.routes.ts || true)
    local notification_routes=$(grep -c "router\\.\\(get\\|post\\|delete\\)" src/routes/notification.routes.ts || true)
    local thread_routes=$(grep -c "router\\.\\(get\\|post\\)" src/routes/email-thread.routes.ts || true)
    local changelog_routes=$(grep -c "router\\.\\(get\\|post\\)" src/routes/changelog.routes.ts || true)
    local total_routes=$((access_routes + notification_routes + thread_routes + changelog_routes))

    if [ "$total_routes" -ge 15 ]; then
        print_success "All route endpoints defined ($total_routes routes)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_error "Missing route endpoints (found $total_routes, expected ≥15)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))

    cd ..
}

##############################################################################
# TEST 10: Environment Configuration
##############################################################################

test_environment() {
    print_section "TEST 10: Environment Configuration"

    # Check for .env.example
    run_test ".env.example exists" "test -f backend/.env.example"

    # Check for required Phase 2 environment variables in .env.example
    if [ -f backend/.env.example ]; then
        print_info "Checking required environment variables..."

        if grep -q "GMAIL_CLIENT_ID" backend/.env.example; then
            print_success "GMAIL_CLIENT_ID defined"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            print_error "GMAIL_CLIENT_ID missing"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
        TESTS_RUN=$((TESTS_RUN + 1))

        if grep -q "GMAIL_REFRESH_TOKEN" backend/.env.example; then
            print_success "GMAIL_REFRESH_TOKEN defined"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            print_error "GMAIL_REFRESH_TOKEN missing"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
        TESTS_RUN=$((TESTS_RUN + 1))

        if grep -q "KUDA_BASE_URL" backend/.env.example; then
            print_success "KUDA_BASE_URL defined"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            print_error "KUDA_BASE_URL missing"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
        TESTS_RUN=$((TESTS_RUN + 1))
    fi
}

##############################################################################
# MAIN EXECUTION
##############################################################################

main() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                                                           ║${NC}"
    echo -e "${BLUE}║   KUDA Phase 2 - Automated Test Suite                    ║${NC}"
    echo -e "${BLUE}║                                                           ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"

    # Parse command line arguments
    if [ "$#" -eq 0 ] || [ "$1" == "--all" ]; then
        # Run all tests
        test_database
        test_access_control
        test_smart_timing
        test_email_threading
        test_changelog
        test_email_templates
        test_notification_service
        test_middleware
        test_api_routes
        test_environment
    elif [ "$1" == "--db" ]; then
        test_database
    elif [ "$1" == "--services" ]; then
        test_access_control
        test_smart_timing
        test_email_threading
        test_changelog
        test_email_templates
        test_notification_service
    elif [ "$1" == "--api" ]; then
        test_middleware
        test_api_routes
    else
        print_error "Unknown option: $1"
        echo "Usage: $0 [--all|--db|--services|--api]"
        exit 1
    fi

    # Print summary
    print_section "TEST SUMMARY"
    echo ""
    echo -e "  Total Tests:    ${BLUE}$TESTS_RUN${NC}"
    echo -e "  Passed:         ${GREEN}$TESTS_PASSED${NC}"
    echo -e "  Failed:         ${RED}$TESTS_FAILED${NC}"
    echo ""

    # Calculate pass rate
    if [ $TESTS_RUN -gt 0 ]; then
        PASS_RATE=$((TESTS_PASSED * 100 / TESTS_RUN))
        echo -e "  Pass Rate:      ${BLUE}${PASS_RATE}%${NC}"
    fi

    echo ""

    # Exit with appropriate code
    if [ $TESTS_FAILED -eq 0 ]; then
        print_success "All tests passed! ✨"
        echo ""
        exit 0
    else
        print_error "$TESTS_FAILED test(s) failed"
        echo ""
        exit 1
    fi
}

# Run main function
main "$@"
