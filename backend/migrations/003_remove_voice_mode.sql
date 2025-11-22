-- ============================================================================
-- Migration 003: Remove voice_mode column
-- Purpose: Phase 2 - V3 Architecture Migration
-- Reason: Manual/Auto mode removed, voice is simply ON/OFF
-- ============================================================================

-- Drop voice_mode constraint first
ALTER TABLE cooking_sessions DROP CONSTRAINT IF EXISTS valid_voice_mode;

-- Remove voice_mode column
ALTER TABLE cooking_sessions DROP COLUMN IF EXISTS voice_mode;

-- Update comment to reflect removal
COMMENT ON TABLE cooking_sessions IS 'Active and completed cooking sessions with progress tracking (V3: voice mode removed)';

-- ============================================================================
-- Success message
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 003 completed successfully!';
    RAISE NOTICE 'Removed voice_mode column from cooking_sessions';
    RAISE NOTICE 'Phase 2: Manual/Auto mode removed - Voice is now simple ON/OFF';
END $$;
