/**
 * Session Service
 * Manages cooking sessions and state persistence
 */

import { pool } from '../db/pool.js';

// ============================================================================
// Interfaces
// ============================================================================

export interface CookingSessionData {
  session_id: string;
  user_id?: string;
  cleaned_recipe_id: number;
  current_step_index: number;
  viewing_step_index: number;
  status: 'planning' | 'active' | 'paused' | 'completed' | 'error';
  total_steps: number;
  voice_mode: 'none' | 'auto' | 'manual';
  started_at: Date;
  ended_at?: Date;
  last_activity_at: Date;
}

export interface SessionState {
  id: number;
  session_id: string;
  state_type: string;
  state_data: any;
  created_at: Date;
}

export type StateType =
  | 'step_change'
  | 'timer_event'
  | 'voice_command'
  | 'mode_change'
  | 'error'
  | 'user_action'
  | 'session_start'
  | 'session_end';

// ============================================================================
// SessionService Class
// ============================================================================

export class SessionService {
  /**
   * Create new cooking session
   */
  async createSession(
    cleanedRecipeId: number,
    totalSteps: number,
    userId?: string
  ): Promise<CookingSessionData> {
    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log(`[SessionService] Creating session: ${sessionId}`);

      const result = await pool.query(
        `INSERT INTO cooking_sessions (
          session_id, user_id, cleaned_recipe_id, current_step_index,
          viewing_step_index, status, total_steps, voice_mode
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [sessionId, userId || null, cleanedRecipeId, 0, 0, 'active', totalSteps, 'none']
      );

      const session = result.rows[0];

      // Log session start
      await this.logState(sessionId, 'session_start', {
        cleaned_recipe_id: cleanedRecipeId,
        total_steps: totalSteps,
        timestamp: new Date().toISOString()
      });

      console.log(`[SessionService] Session created: ${sessionId}`);

      return this.mapSessionData(session);
    } catch (error) {
      console.error('[SessionService] Failed to create session:', error);
      throw error;
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<CookingSessionData | null> {
    try {
      const result = await pool.query('SELECT * FROM cooking_sessions WHERE session_id = $1', [
        sessionId
      ]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapSessionData(result.rows[0]);
    } catch (error) {
      console.error('[SessionService] Failed to get session:', error);
      throw error;
    }
  }

  /**
   * Update session state
   */
  async updateSession(
    sessionId: string,
    updates: Partial<CookingSessionData>
  ): Promise<CookingSessionData> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.current_step_index !== undefined) {
        updateFields.push(`current_step_index = $${paramIndex++}`);
        values.push(updates.current_step_index);
      }

      if (updates.viewing_step_index !== undefined) {
        updateFields.push(`viewing_step_index = $${paramIndex++}`);
        values.push(updates.viewing_step_index);
      }

      if (updates.status) {
        updateFields.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }

      if (updates.voice_mode) {
        updateFields.push(`voice_mode = $${paramIndex++}`);
        values.push(updates.voice_mode);
      }

      if (updateFields.length === 0) {
        const current = await this.getSession(sessionId);
        if (!current) throw new Error('Session not found');
        return current;
      }

      values.push(sessionId);

      const query = `
        UPDATE cooking_sessions
        SET ${updateFields.join(', ')}
        WHERE session_id = $${paramIndex}
        RETURNING *
      `;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Session not found');
      }

      console.log(`[SessionService] Session updated: ${sessionId}`);

      return this.mapSessionData(result.rows[0]);
    } catch (error) {
      console.error('[SessionService] Failed to update session:', error);
      throw error;
    }
  }

  /**
   * End session
   */
  async endSession(sessionId: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE cooking_sessions
         SET status = 'completed', ended_at = NOW()
         WHERE session_id = $1`,
        [sessionId]
      );

      await this.logState(sessionId, 'session_end', {
        timestamp: new Date().toISOString()
      });

      console.log(`[SessionService] Session ended: ${sessionId}`);
    } catch (error) {
      console.error('[SessionService] Failed to end session:', error);
      throw error;
    }
  }

  /**
   * Log state change
   */
  async logState(sessionId: string, stateType: StateType, stateData: any): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO session_states (session_id, state_type, state_data)
         VALUES ($1, $2, $3)`,
        [sessionId, stateType, JSON.stringify(stateData)]
      );

      console.log(`[SessionService] State logged: ${sessionId} - ${stateType}`);
    } catch (error) {
      console.error('[SessionService] Failed to log state:', error);
      // Don't throw - logging failure shouldn't break the session
    }
  }

  /**
   * Get session states (history)
   */
  async getSessionStates(
    sessionId: string,
    stateType?: StateType,
    limit = 100
  ): Promise<SessionState[]> {
    try {
      let query = `
        SELECT * FROM session_states
        WHERE session_id = $1
      `;

      const values: any[] = [sessionId];

      if (stateType) {
        query += ` AND state_type = $2`;
        values.push(stateType);
      }

      query += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
      values.push(limit);

      const result = await pool.query(query, values);

      return result.rows.map((row) => ({
        id: row.id,
        session_id: row.session_id,
        state_type: row.state_type,
        state_data: row.state_data,
        created_at: row.created_at
      }));
    } catch (error) {
      console.error('[SessionService] Failed to get session states:', error);
      throw error;
    }
  }

  /**
   * Get active sessions (for cleanup/monitoring)
   */
  async getActiveSessions(): Promise<CookingSessionData[]> {
    try {
      const result = await pool.query(
        `SELECT * FROM cooking_sessions
         WHERE status IN ('active', 'paused')
         ORDER BY started_at DESC`
      );

      return result.rows.map(this.mapSessionData);
    } catch (error) {
      console.error('[SessionService] Failed to get active sessions:', error);
      throw error;
    }
  }

  /**
   * Clean up old sessions
   */
  async cleanupOldSessions(olderThanHours = 24): Promise<number> {
    try {
      const result = await pool.query(
        `DELETE FROM cooking_sessions
         WHERE started_at < NOW() - INTERVAL '${olderThanHours} hours'
         AND status IN ('completed', 'error')
         RETURNING session_id`
      );

      const count = result.rows.length;
      console.log(`[SessionService] Cleaned up ${count} old sessions`);

      return count;
    } catch (error) {
      console.error('[SessionService] Failed to cleanup sessions:', error);
      throw error;
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private mapSessionData(row: any): CookingSessionData {
    return {
      session_id: row.session_id,
      user_id: row.user_id,
      cleaned_recipe_id: row.cleaned_recipe_id,
      current_step_index: row.current_step_index,
      viewing_step_index: row.viewing_step_index,
      status: row.status,
      total_steps: row.total_steps,
      voice_mode: row.voice_mode,
      started_at: row.started_at,
      ended_at: row.ended_at,
      last_activity_at: row.last_activity_at
    };
  }
}
