import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { getDb, DbAdapter } from '../database/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * Global audit logger helper
 */
export async function logAudit(
  db: DbAdapter,
  userId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  oldValue: string | null = null,
  newValue: string | null = null,
  req?: any
): Promise<void> {
  try {
    const id = uuidv4();
    const ipAddress = req ? (req.ip || req.connection?.remoteAddress || '127.0.0.1') : '127.0.0.1';
    const userAgent = req ? req.headers['user-agent'] : 'SYSTEM';

    await db.run(
      'INSERT INTO AuditLogs (id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, userId, action, entityType, entityId, oldValue, newValue, ipAddress, userAgent
    );
  } catch (err: any) {
    console.error('[AuditLogs] Fail to record audit event:', err.message);
  }
}

export async function getAuditLogs(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { action, entity_type, limit = 50, offset = 0 } = req.query;

    const db = await getDb();
    
    let query = 'SELECT * FROM AuditLogs WHERE 1=1';
    const params: any[] = [];

    // Filter audits related to user actions (or show all to admins)
    if (req.user?.role !== 'ADMIN') {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }

    if (entity_type) {
      query += ' AND entity_type = ?';
      params.push(entity_type);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const logs = await db.all(query, params);
    return res.status(200).json(logs);
  } catch (error: any) {
    console.error('Error fetching Audit Logs:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
