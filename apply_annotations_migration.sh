#!/bin/bash

# Migration script to add annotations table to existing database
# Run this script after updating the backend code

DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-sti}
DB_USER=${DB_USER:-sti}

echo "Applying database migration: add_annotations_table.sql"
echo "Target database: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "Error: psql command not found. Please install PostgreSQL client tools."
    exit 1
fi

# Apply the migration
PGPASSWORD=${DB_PASSWORD:-sti} psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f database/migration/add_annotations_table.sql

if [ $? -eq 0 ]; then
    echo "Migration applied successfully!"
    echo "Verifying table creation..."
    
    # Verify the table was created
    PGPASSWORD=${DB_PASSWORD:-sti} psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "\d inspection_annotations"
    
    if [ $? -eq 0 ]; then
        echo "Table 'inspection_annotations' created successfully!"
    else
        echo "Warning: Could not verify table creation."
    fi
else
    echo "Error: Migration failed!"
    exit 1
fi