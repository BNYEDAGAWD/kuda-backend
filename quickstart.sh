#!/bin/bash

##############################################################################
# KUDA Quick Start Script
#
# One-command setup for the entire KUDA development environment.
# This script will:
# 1. Check prerequisites (Docker, Docker Compose)
# 2. Create .env files if they don't exist
# 3. Start all Docker services (PostgreSQL, Redis, Backend, etc.)
# 4. Wait for services to be healthy
# 5. Run database migrations
# 6. Display service URLs and access information
#
# Usage:
#   ./quickstart.sh          # Start all services
#   ./quickstart.sh --stop   # Stop all services
#   ./quickstart.sh --clean  # Stop and remove all data
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

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

##############################################################################
# Parse command line arguments
##############################################################################

COMMAND="${1:-start}"

##############################################################################
# Stop services
##############################################################################

if [ "$COMMAND" == "--stop" ]; then
    print_header "Stopping KUDA Services"
    docker-compose down
    print_success "All services stopped"
    exit 0
fi

##############################################################################
# Clean (stop and remove all data)
##############################################################################

if [ "$COMMAND" == "--clean" ]; then
    print_header "Cleaning KUDA Environment"
    print_warning "This will delete all data (database, uploads, logs)"
    read -p "Are you sure? (yes/no): " CONFIRM
    if [ "$CONFIRM" == "yes" ]; then
        docker-compose down -v
        print_success "All services stopped and data removed"
    else
        print_info "Clean cancelled"
    fi
    exit 0
fi

##############################################################################
# Start services
##############################################################################

clear
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                           ║${NC}"
echo -e "${CYAN}║   🚀 KUDA Quick Start                                     ║${NC}"
echo -e "${CYAN}║   Kargo Unified Design Approval Platform                 ║${NC}"
echo -e "${CYAN}║                                                           ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

##############################################################################
# Step 1: Check Prerequisites
##############################################################################

print_header "Step 1: Checking Prerequisites"

# Check Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | awk '{print $3}' | sed 's/,//')
    print_success "Docker installed (version $DOCKER_VERSION)"
else
    print_error "Docker is not installed"
    print_info "Install Docker from: https://www.docker.com/get-started"
    exit 1
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version | awk '{print $4}' | sed 's/,//')
    print_success "Docker Compose installed (version $COMPOSE_VERSION)"
else
    print_error "Docker Compose is not installed"
    print_info "Install Docker Compose from: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check Docker daemon
if docker info &> /dev/null; then
    print_success "Docker daemon is running"
else
    print_error "Docker daemon is not running"
    print_info "Start Docker Desktop or Docker daemon"
    exit 1
fi

echo ""

##############################################################################
# Step 2: Environment Setup
##############################################################################

print_header "Step 2: Environment Configuration"

# Check if backend .env exists
if [ ! -f "backend/.env" ]; then
    print_warning "backend/.env not found, creating from template..."
    cp backend/.env.example backend/.env
    print_success "backend/.env created from template"
    print_info "Update backend/.env with your credentials before production deployment"
else
    print_success "backend/.env exists"
fi

# Create .env.production template if it doesn't exist
if [ ! -f ".env.production" ]; then
    print_info "Creating .env.production template..."
    cat > .env.production << 'EOF'
# Production Environment Variables
# Copy this to .env and update with production values

# PostgreSQL
POSTGRES_PASSWORD=change_this_in_production

# Redis
REDIS_PASSWORD=change_this_in_production

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_production_access_key
AWS_SECRET_ACCESS_KEY=your_production_secret_key
S3_BUCKET_NAME=kuda-assets-production

# JWT
JWT_SECRET=your_production_jwt_secret_min_32_chars

# Gmail API
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret
GMAIL_REDIRECT_URI=https://kuda.kargo.com/auth/gmail/callback
GMAIL_REFRESH_TOKEN=your_gmail_refresh_token
GMAIL_FROM_EMAIL=noreply@kargo.com

# KUDA Platform
KUDA_BASE_URL=https://kuda.kargo.com
FRONTEND_URL=https://kuda.kargo.com

# Ports
POSTGRES_PORT=5432
REDIS_PORT=6379
BACKEND_PORT=4000
HTTP_PORT=80
HTTPS_PORT=443
EOF
    print_success ".env.production template created"
fi

echo ""

##############################################################################
# Step 3: Start Docker Services
##############################################################################

print_header "Step 3: Starting Docker Services"

print_info "Pulling latest images..."
docker-compose pull

print_info "Building containers..."
docker-compose build

print_info "Starting services..."
docker-compose up -d

echo ""

##############################################################################
# Step 4: Wait for Services to be Healthy
##############################################################################

print_header "Step 4: Waiting for Services"

# Function to wait for service
wait_for_service() {
    local service_name=$1
    local max_wait=$2
    local wait_time=0

    echo -n "Waiting for $service_name... "

    while [ $wait_time -lt $max_wait ]; do
        if docker-compose ps | grep "$service_name" | grep -q "healthy\|Up"; then
            echo -e "${GREEN}✓${NC}"
            return 0
        fi
        echo -n "."
        sleep 2
        wait_time=$((wait_time + 2))
    done

    echo -e "${RED}✗ (timeout)${NC}"
    return 1
}

wait_for_service "postgres" 30
wait_for_service "redis" 20
wait_for_service "backend" 60

print_success "All services are healthy"

echo ""

##############################################################################
# Step 5: Verify Database
##############################################################################

print_header "Step 5: Verifying Database"

# Check if migrations have been run
MIGRATION_COUNT=$(docker-compose exec -T postgres psql -U postgres -d kuda_dev -t -c "SELECT COUNT(*) FROM migrations;" 2>/dev/null | xargs)

if [ -z "$MIGRATION_COUNT" ] || [ "$MIGRATION_COUNT" -eq 0 ]; then
    print_warning "No migrations found - database may need initialization"
else
    print_success "Database initialized ($MIGRATION_COUNT migrations applied)"
fi

# Display table count
TABLE_COUNT=$(docker-compose exec -T postgres psql -U postgres -d kuda_dev -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" 2>/dev/null | xargs)
print_info "Database tables: $TABLE_COUNT"

echo ""

##############################################################################
# Step 6: Display Service Information
##############################################################################

print_header "KUDA Services - Ready"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Backend Services${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${CYAN}Backend API:${NC}          http://localhost:4000"
echo -e "  ${CYAN}API Health:${NC}           http://localhost:4000/health"
echo -e "  ${CYAN}API Documentation:${NC}    http://localhost:4000/api-docs"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Database & Cache${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${CYAN}PostgreSQL:${NC}           localhost:5432"
echo -e "  ${CYAN}  Database:${NC}           kuda_dev"
echo -e "  ${CYAN}  Username:${NC}           postgres"
echo -e "  ${CYAN}  Password:${NC}           postgres"
echo ""
echo -e "  ${CYAN}Redis:${NC}                localhost:6379"
echo -e "  ${CYAN}  Password:${NC}           devpassword"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Management UIs${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${CYAN}pgAdmin:${NC}              http://localhost:5050"
echo -e "  ${CYAN}  Email:${NC}              admin@kargo.com"
echo -e "  ${CYAN}  Password:${NC}           admin"
echo ""
echo -e "  ${CYAN}Redis Commander:${NC}      http://localhost:8081"
echo ""
echo -e "  ${CYAN}LocalStack (S3):${NC}      http://localhost:4566"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Quick Commands${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${CYAN}View logs:${NC}            docker-compose logs -f backend"
echo -e "  ${CYAN}Stop services:${NC}        ./quickstart.sh --stop"
echo -e "  ${CYAN}Clean all data:${NC}       ./quickstart.sh --clean"
echo -e "  ${CYAN}Run tests:${NC}            ./test-phase2.sh"
echo -e "  ${CYAN}Access database:${NC}      docker-compose exec postgres psql -U postgres -d kuda_dev"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

print_success "KUDA development environment is ready! 🎉"
print_info "Frontend engineers can now connect to: http://localhost:4000"
print_info "API documentation available at: http://localhost:4000/api-docs"
echo ""

# Check if backend is responding
if curl -s http://localhost:4000/health > /dev/null; then
    print_success "Backend health check passed ✓"
else
    print_warning "Backend may still be starting up..."
    print_info "Check logs with: docker-compose logs -f backend"
fi

echo ""
