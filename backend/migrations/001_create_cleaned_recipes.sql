-- ============================================================================
-- Migration 001: Create Cleaned Recipe Database
-- Purpose: Store pre-processed planning results for fast cooking session start
-- ============================================================================

-- Drop tables if they exist (for clean re-run)
DROP TABLE IF EXISTS cleaned_steps CASCADE;
DROP TABLE IF EXISTS cleaned_recipes CASCADE;

-- ============================================================================
-- Table: cleaned_recipes
-- Purpose: Store planning metadata and overall recipe information
-- ============================================================================
CREATE TABLE cleaned_recipes (
    id SERIAL PRIMARY KEY,
    recipe_id VARCHAR(50) NOT NULL REFERENCES recipes(recipe_id) ON DELETE CASCADE,

    -- Planning metadata
    cleaned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    planning_version VARCHAR(20) DEFAULT '1.0',

    -- Planning result (full JSON for reference)
    planning_result JSONB NOT NULL,

    -- Extracted fields for quick access
    title VARCHAR(255) NOT NULL,
    opening_remark TEXT NOT NULL,
    closing_remark TEXT NOT NULL,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_cleaned_recipe UNIQUE(recipe_id)
);

-- ============================================================================
-- Table: cleaned_steps
-- Purpose: Store step-by-step voice scripts for cooking guidance
-- ============================================================================
CREATE TABLE cleaned_steps (
    id SERIAL PRIMARY KEY,
    cleaned_recipe_id INTEGER NOT NULL REFERENCES cleaned_recipes(id) ON DELETE CASCADE,

    -- Step metadata
    step_order INTEGER NOT NULL,

    -- Voice scripts (5 types)
    script TEXT NOT NULL,                -- Main explanation
    retry_script TEXT NOT NULL,          -- Detailed retry explanation
    fallback_script TEXT NOT NULL,       -- Simple explanation
    pause_hint TEXT NOT NULL,            -- Hint when paused

    -- Timer information
    estimated_time_sec INTEGER NOT NULL DEFAULT 0,
    timer_required BOOLEAN NOT NULL DEFAULT false,
    timer_message TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT unique_step_order UNIQUE(cleaned_recipe_id, step_order),
    CONSTRAINT positive_step_order CHECK(step_order > 0),
    CONSTRAINT positive_time CHECK(estimated_time_sec >= 0)
);

-- ============================================================================
-- Indexes for performance optimization
-- ============================================================================

-- Fast lookup by recipe_id
CREATE INDEX idx_cleaned_recipes_recipe_id ON cleaned_recipes(recipe_id);

-- Fast lookup by cleaned_at (for batch processing monitoring)
CREATE INDEX idx_cleaned_recipes_cleaned_at ON cleaned_recipes(cleaned_at);

-- Fast step lookup by cleaned_recipe_id and order
CREATE INDEX idx_cleaned_steps_recipe_order ON cleaned_steps(cleaned_recipe_id, step_order);

-- Fast timer-required steps lookup
CREATE INDEX idx_cleaned_steps_timer ON cleaned_steps(cleaned_recipe_id, timer_required) WHERE timer_required = true;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE cleaned_recipes IS 'Pre-processed planning results for recipes';
COMMENT ON COLUMN cleaned_recipes.recipe_id IS 'Foreign key to raw recipes table';
COMMENT ON COLUMN cleaned_recipes.planning_result IS 'Full planning output from OpenAI (JSONB format)';
COMMENT ON COLUMN cleaned_recipes.opening_remark IS 'AI-generated opening message for cooking session';
COMMENT ON COLUMN cleaned_recipes.closing_remark IS 'AI-generated completion message';

COMMENT ON TABLE cleaned_steps IS 'Voice scripts for each cooking step';
COMMENT ON COLUMN cleaned_steps.script IS 'Main voice script for the step';
COMMENT ON COLUMN cleaned_steps.retry_script IS 'Detailed script when user asks to repeat';
COMMENT ON COLUMN cleaned_steps.fallback_script IS 'Simplified script for easier understanding';
COMMENT ON COLUMN cleaned_steps.pause_hint IS 'Message to show when cooking is paused';
COMMENT ON COLUMN cleaned_steps.timer_required IS 'Whether this step requires a timer';
COMMENT ON COLUMN cleaned_steps.timer_message IS 'AI message to announce timer start';

-- ============================================================================
-- Success message
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 001 completed successfully!';
    RAISE NOTICE 'Created tables: cleaned_recipes, cleaned_steps';
    RAISE NOTICE 'Created indexes for performance optimization';
END $$;
