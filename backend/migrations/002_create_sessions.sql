-- ============================================================================
-- Migration 002: Create Session and State Database
-- Purpose: Track cooking sessions and user progress for resumable cooking
-- ============================================================================

-- Drop tables if they exist (for clean re-run)
DROP TABLE IF EXISTS session_states CASCADE;
DROP TABLE IF EXISTS cooking_sessions CASCADE;

-- ============================================================================
-- Table: cooking_sessions
-- Purpose: Store active and completed cooking sessions
-- ============================================================================
CREATE TABLE cooking_sessions (
    session_id VARCHAR(100) PRIMARY KEY,

    -- User identification (for future multi-user support)
    user_id VARCHAR(100),

    -- Recipe reference
    cleaned_recipe_id INTEGER NOT NULL REFERENCES cleaned_recipes(id) ON DELETE CASCADE,

    -- Step tracking
    current_step_index INTEGER NOT NULL DEFAULT 0,
    viewing_step_index INTEGER NOT NULL DEFAULT 0,

    -- Session status
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    -- status values: 'planning', 'active', 'paused', 'completed', 'error'

    -- Timestamps
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Session metadata
    total_steps INTEGER NOT NULL,
    voice_mode VARCHAR(20) DEFAULT 'none',
    -- voice_mode values: 'none', 'auto', 'manual'

    -- Constraints
    CONSTRAINT valid_status CHECK(status IN ('planning', 'active', 'paused', 'completed', 'error')),
    CONSTRAINT valid_voice_mode CHECK(voice_mode IN ('none', 'auto', 'manual')),
    CONSTRAINT non_negative_step_index CHECK(current_step_index >= 0),
    CONSTRAINT non_negative_viewing_index CHECK(viewing_step_index >= 0),
    CONSTRAINT positive_total_steps CHECK(total_steps > 0)
);

-- ============================================================================
-- Table: session_states
-- Purpose: Log all state changes and events during cooking session
-- ============================================================================
CREATE TABLE session_states (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL REFERENCES cooking_sessions(session_id) ON DELETE CASCADE,

    -- State type classification
    state_type VARCHAR(50) NOT NULL,
    -- state_type values:
    --   'step_change', 'timer_event', 'voice_command',
    --   'mode_change', 'error', 'user_action'

    -- State data (flexible JSONB for different event types)
    state_data JSONB NOT NULL,

    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT valid_state_type CHECK(state_type IN (
        'step_change',
        'timer_event',
        'voice_command',
        'mode_change',
        'error',
        'user_action',
        'session_start',
        'session_end'
    ))
);

-- ============================================================================
-- Indexes for performance optimization
-- ============================================================================

-- Fast lookup by session_id
CREATE INDEX idx_sessions_session_id ON cooking_sessions(session_id);

-- Fast lookup by user_id (for multi-user support)
CREATE INDEX idx_sessions_user_id ON cooking_sessions(user_id) WHERE user_id IS NOT NULL;

-- Fast lookup by status
CREATE INDEX idx_sessions_status ON cooking_sessions(status);

-- Fast lookup by cleaned_recipe_id (to see who's cooking what)
CREATE INDEX idx_sessions_recipe ON cooking_sessions(cleaned_recipe_id);

-- Fast lookup by started_at (for recent sessions)
CREATE INDEX idx_sessions_started_at ON cooking_sessions(started_at DESC);

-- Fast state lookup by session_id and type
CREATE INDEX idx_states_session_type ON session_states(session_id, state_type);

-- Fast state lookup by created_at (chronological order)
CREATE INDEX idx_states_created_at ON session_states(session_id, created_at DESC);

-- Fast error lookup
CREATE INDEX idx_states_errors ON session_states(session_id, state_type) WHERE state_type = 'error';

-- ============================================================================
-- Trigger: Update last_activity_at on state change
-- ============================================================================
CREATE OR REPLACE FUNCTION update_session_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE cooking_sessions
    SET last_activity_at = NEW.created_at
    WHERE session_id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_last_activity
    AFTER INSERT ON session_states
    FOR EACH ROW
    EXECUTE FUNCTION update_session_last_activity();

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE cooking_sessions IS 'Active and completed cooking sessions with progress tracking';
COMMENT ON COLUMN cooking_sessions.session_id IS 'Unique session identifier (UUID format)';
COMMENT ON COLUMN cooking_sessions.user_id IS 'User identifier for future authentication support';
COMMENT ON COLUMN cooking_sessions.cleaned_recipe_id IS 'Reference to cleaned recipe being cooked';
COMMENT ON COLUMN cooking_sessions.current_step_index IS 'Actual cooking progress (voice interaction)';
COMMENT ON COLUMN cooking_sessions.viewing_step_index IS 'UI navigation step (for recipe review)';
COMMENT ON COLUMN cooking_sessions.status IS 'Session status: planning/active/paused/completed/error';
COMMENT ON COLUMN cooking_sessions.voice_mode IS 'Voice interaction mode: none/auto/manual';

COMMENT ON TABLE session_states IS 'Event log for all state changes during cooking';
COMMENT ON COLUMN session_states.state_type IS 'Type of event: step_change/timer_event/voice_command/error';
COMMENT ON COLUMN session_states.state_data IS 'Event details in flexible JSONB format';

-- ============================================================================
-- Example state_data structures for reference
-- ============================================================================

COMMENT ON COLUMN session_states.state_data IS 'JSONB examples:
step_change: {"from_step": 1, "to_step": 2, "direction": "next"}
timer_event: {"action": "start", "duration_sec": 600, "step": 2}
voice_command: {"command": "다음 단계", "transcript": "...", "intent": "next_step"}
mode_change: {"from_mode": "manual", "to_mode": "auto"}
error: {"error_type": "api_error", "message": "...", "stack": "..."}
user_action: {"action": "button_click", "button": "next", "step": 3}
';

-- ============================================================================
-- Success message
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 002 completed successfully!';
    RAISE NOTICE 'Created tables: cooking_sessions, session_states';
    RAISE NOTICE 'Created indexes for performance optimization';
    RAISE NOTICE 'Created trigger: update_session_last_activity';
END $$;
