-- ============================================================================
-- Migration 004: Add raw_data column to recipes table
-- Purpose: Store original raw recipe data as-is for GPT processing
-- ============================================================================

-- Add raw_data column to recipes table
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS raw_data JSONB;

-- Add index for raw_data queries
CREATE INDEX IF NOT EXISTS idx_recipes_raw_data ON recipes USING GIN (raw_data);

-- Add comment
COMMENT ON COLUMN recipes.raw_data IS 'Original raw recipe data in JSON format (preserved as-is for GPT processing)';

-- ============================================================================
-- Success message
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 004 completed successfully!';
    RAISE NOTICE 'Added raw_data JSONB column to recipes table';
    RAISE NOTICE 'Created GIN index on raw_data for efficient queries';
END $$;

