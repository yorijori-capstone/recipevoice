-- ============================================================================
-- Migration 005: Grant Permissions to recipevoice user
-- Purpose: Grant all necessary permissions for import and cleaning operations
-- ============================================================================

-- Grant permissions on core tables
GRANT ALL PRIVILEGES ON TABLE recipes TO recipevoice;
GRANT ALL PRIVILEGES ON TABLE ingredients TO recipevoice;
GRANT ALL PRIVILEGES ON TABLE steps TO recipevoice;

-- Grant permissions on cleaned recipe tables
GRANT ALL PRIVILEGES ON TABLE cleaned_recipes TO recipevoice;
GRANT ALL PRIVILEGES ON TABLE cleaned_steps TO recipevoice;

-- Grant permissions on session tables
GRANT ALL PRIVILEGES ON TABLE cooking_sessions TO recipevoice;
GRANT ALL PRIVILEGES ON TABLE session_states TO recipevoice;

-- Grant permissions on sequences
GRANT USAGE, SELECT ON SEQUENCE recipes_id_seq TO recipevoice;
GRANT USAGE, SELECT ON SEQUENCE ingredients_id_seq TO recipevoice;
GRANT USAGE, SELECT ON SEQUENCE steps_id_seq TO recipevoice;
GRANT USAGE, SELECT ON SEQUENCE cleaned_recipes_id_seq TO recipevoice;
GRANT USAGE, SELECT ON SEQUENCE cleaned_steps_id_seq TO recipevoice;
GRANT USAGE, SELECT ON SEQUENCE session_states_id_seq TO recipevoice;

-- ============================================================================
-- Success message
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 005 completed successfully!';
    RAISE NOTICE 'Granted all privileges to recipevoice user';
END $$;

