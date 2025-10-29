#!/bin/bash

##############################################################################
# KUDA Database Initialization Script
#
# This script runs automatically when PostgreSQL container starts for the
# first time. It creates the database, enables required extensions, and
# runs all migrations in order.
#
# Location: /docker-entrypoint-initdb.d/01-init.sh
##############################################################################

set -e  # Exit on error

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "KUDA Database Initialization"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Database details from environment
DB_NAME="${POSTGRES_DB:-kuda_dev}"
DB_USER="${POSTGRES_USER:-postgres}"

echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

# Function to run SQL
run_sql() {
    psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" -c "$1"
}

# Enable required PostgreSQL extensions
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Enabling PostgreSQL Extensions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_sql "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
echo "✓ uuid-ossp extension enabled"

run_sql "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
echo "✓ pg_trgm extension enabled (for text search)"

run_sql "CREATE EXTENSION IF NOT EXISTS btree_gin;"
echo "✓ btree_gin extension enabled (for JSONB indexing)"

# Create migrations tracking table
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Creating Migrations Tracking Table"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

run_sql "CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);"
echo "✓ Migrations table created"

# Run migrations in order
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Running Database Migrations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

MIGRATIONS_DIR="/docker-entrypoint-initdb.d/migrations"

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "⚠️  Migrations directory not found: $MIGRATIONS_DIR"
    echo "Skipping migrations..."
    exit 0
fi

# Get list of migration files (sorted numerically)
MIGRATION_FILES=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort -V)

if [ -z "$MIGRATION_FILES" ]; then
    echo "⚠️  No migration files found in $MIGRATIONS_DIR"
    exit 0
fi

# Run each migration
MIGRATIONS_RUN=0
MIGRATIONS_SKIPPED=0

for MIGRATION_FILE in $MIGRATION_FILES; do
    MIGRATION_NAME=$(basename "$MIGRATION_FILE")

    # Check if migration has already been executed
    ALREADY_RUN=$(psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" -t -c "SELECT COUNT(*) FROM migrations WHERE name = '$MIGRATION_NAME';" | xargs)

    if [ "$ALREADY_RUN" -gt 0 ]; then
        echo "⏭  $MIGRATION_NAME (already executed)"
        MIGRATIONS_SKIPPED=$((MIGRATIONS_SKIPPED + 1))
        continue
    fi

    echo "▶  Running: $MIGRATION_NAME..."

    # Run the migration
    if psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" -f "$MIGRATION_FILE"; then
        # Record successful migration
        run_sql "INSERT INTO migrations (name) VALUES ('$MIGRATION_NAME');"
        echo "✓  $MIGRATION_NAME completed successfully"
        MIGRATIONS_RUN=$((MIGRATIONS_RUN + 1))
    else
        echo "✗  $MIGRATION_NAME FAILED"
        exit 1
    fi

    echo ""
done

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Migration Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Migrations Run: $MIGRATIONS_RUN"
echo "Migrations Skipped: $MIGRATIONS_SKIPPED"
echo ""

# Display table count
TABLE_COUNT=$(psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';" | xargs)
echo "Total Tables: $TABLE_COUNT"

# Display migration history
echo ""
echo "Migration History:"
psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname "$DB_NAME" -c "SELECT id, name, executed_at FROM migrations ORDER BY id;"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Database Initialization Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
