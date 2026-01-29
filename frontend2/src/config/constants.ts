/**
 * Configuration Constants
 * Centralized configuration values for the Yorijori V3 application
 */

// ============================================================================
// Voice Activity Detection (VAD) Configuration
// ============================================================================
export const VAD_CONFIG = {
    /**
     * Voice activity detection sensitivity threshold (0-1)
     * Higher values = less sensitive (requires louder/clearer voice)
     * Lower values = more sensitive (may pick up background noise)
     */
    THRESHOLD: 0.90,

    /**
     * Audio buffer duration before speech starts (milliseconds)
     * Captures audio slightly before detected speech to avoid clipping
     */
    PREFIX_PADDING_MS: 200,

    /**
     * Silence duration required to end speech turn (milliseconds)
     * Longer values = more tolerance for pauses within speech
     */
    SILENCE_DURATION_MS: 300,
} as const;

// ============================================================================
// Audio Processing Configuration
// ============================================================================
export const AUDIO_CONFIG = {
    /**
     * Audio sample rate (Hz)
     * Must match OpenAI Realtime API requirements
     */
    SAMPLE_RATE: 24000,

    /**
     * Audio format
     */
    FORMAT: 'pcm16',

    /**
     * Audio queue processing interval (milliseconds)
     */
    QUEUE_PROCESS_INTERVAL_MS: 10,
} as const;

// ============================================================================
// WebSocket Reconnection Configuration
// ============================================================================
export const RECONNECT_CONFIG = {
    /**
     * Maximum number of reconnection attempts
     */
    MAX_ATTEMPTS: 5,

    /**
     * Initial reconnection delay (milliseconds)
     * Actual delay uses exponential backoff: delay * 2^(attempt - 1)
     */
    INITIAL_DELAY_MS: 1000,
} as const;

// ============================================================================
// Text-to-Speech (TTS) Timing Configuration
// ============================================================================
export const TTS_DELAYS = {
    /**
     * Delay before playing timer completion TTS (milliseconds)
     * Prevents collision with other responses
     */
    TIMER_COMPLETE_MS: 500,

    /**
     * Delay before prompting user for next step after timer (milliseconds)
     * Timer completion TTS at 500ms + 500ms wait = 1000ms total
     */
    NEXT_STEP_PROMPT_MS: 1000,

    /**
     * Auto-dismiss duration for timer completion message (milliseconds)
     */
    MESSAGE_DISMISS_MS: 5000,
} as const;

// ============================================================================
// UI Configuration
// ============================================================================
export const UI_CONFIG = {
    /**
     * Maximum number of steps to show step numbers below progress circles
     * For recipes with more steps, only circles are shown to save space
     */
    MAX_STEPS_FOR_LABELS: 10,

    /**
     * Minimum width for each step circle in progress bar (pixels)
     */
    STEP_CIRCLE_MIN_WIDTH: 40,
} as const;
