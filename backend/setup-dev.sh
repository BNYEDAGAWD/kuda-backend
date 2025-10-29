#!/bin/bash
# KUDA Backend Development Setup Script
# Automates database setup, dependency installation, and migration

set -e

echo "🚀 KUDA Backend Development Setup"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  No .env file found${NC}"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo -e "${GREEN}✅ Created .env file${NC}"
    echo -e "${YELLOW}⚠️  Please update .env with your actual configuration${NC}"
    echo ""
else
    echo -e "${GREEN}✅ .env file exists${NC}"
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo ""
    echo "📦 Installing dependencies..."
    npm install
    echo -e "${GREEN}✅ Dependencies installed${NC}"
else
    echo -e "${GREEN}✅ Dependencies already installed${NC}"
fi

# Check if DATABASE_URL is set
if ! grep -q "DATABASE_URL=postgresql://" .env; then
    echo -e "${RED}❌ DATABASE_URL not configured in .env${NC}"
    echo "Please set DATABASE_URL in .env before running migrations"
    exit 1
fi

# Check migration status
echo ""
echo "📊 Checking migration status..."
npm run migrate:status

echo ""
echo -e "${YELLOW}Ready to run migrations?${NC}"
echo "This will execute all pending migrations including Phase 1 enhancements."
echo ""
read -p "Run migrations now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🔄 Running migrations..."
    npm run migrate
    echo -e "${GREEN}✅ Migrations complete${NC}"

    echo ""
    echo "📊 Final migration status:"
    npm run migrate:status
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your actual configuration if needed"
echo "2. Start development server: npm run dev"
echo "3. Run Phase 1 validation tests"
echo ""
echo "For testing guidance, see: PHASE1_TESTING_GUIDE.md"
