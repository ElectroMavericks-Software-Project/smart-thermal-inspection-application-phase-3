@echo off
REM Migration script to add annotations table to existing database
REM Run this script after updating the backend code

set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=sti
set DB_USER=sti
set DB_PASSWORD=sti

echo Applying database migration: add_annotations_table.sql
echo Target database: %DB_USER%@%DB_HOST%:%DB_PORT%/%DB_NAME%

REM Check if psql is available
where psql >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: psql command not found. Please install PostgreSQL client tools.
    pause
    exit /b 1
)

REM Apply the migration
set PGPASSWORD=%DB_PASSWORD%
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f database\migration\add_annotations_table.sql

if %errorlevel% equ 0 (
    echo Migration applied successfully!
    echo Verifying table creation...
    
    REM Verify the table was created
    psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "\d inspection_annotations"
    
    if %errorlevel% equ 0 (
        echo Table 'inspection_annotations' created successfully!
    ) else (
        echo Warning: Could not verify table creation.
    )
) else (
    echo Error: Migration failed!
    pause
    exit /b 1
)

pause