export interface StoredSyncAction {
  user_id: string;
  response_json: string | null;
}

/** Cuánto se recuerda una acción ya aplicada. Una cola offline no debería tardar más en vaciarse. */
const RETENTION_DAYS = 30;

export function createSyncActionRepository(db: D1Database) {
  return {
    find(clientActionId: string): Promise<StoredSyncAction | null> {
      return db
        .prepare("SELECT user_id, response_json FROM sync_actions WHERE client_action_id = ?1")
        .bind(clientActionId)
        .first<StoredSyncAction>();
    },

    /**
     * Guarda el resultado de una acción aplicada. Si otra petición con el mismo id llegó antes,
     * se queda la primera (INSERT OR IGNORE). De paso borra lo muy antiguo de esa persona.
     */
    async record(action: {
      clientActionId: string;
      userId: string;
      actionType: string;
      entityType: string;
      responseJson: string;
    }): Promise<void> {
      await db.batch([
        db
          .prepare(
            `INSERT OR IGNORE INTO sync_actions (client_action_id, user_id, action_type, entity_type, status, response_json)
             VALUES (?1, ?2, ?3, ?4, 'applied', ?5)`,
          )
          .bind(action.clientActionId, action.userId, action.actionType, action.entityType, action.responseJson),
        db
          .prepare(`DELETE FROM sync_actions WHERE user_id = ?1 AND received_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-${RETENTION_DAYS} days')`)
          .bind(action.userId),
      ]);
    },
  };
}
