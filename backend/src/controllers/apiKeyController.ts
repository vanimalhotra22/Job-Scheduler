import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { getDb } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { logAudit } from './auditController';

export async function createApiKey(req: AuthenticatedRequest, res: Response) {
  try {
    const { name, project_id, expires_in_days } = req.body;
    const userId = req.user?.userId;

    if (!name || !project_id) {
      return res.status(400).json({ error: 'Name and project_id are required' });
    }

    const db = await getDb();
    
    // Verify project belongs to user's org
    const project = await db.get(
      'SELECT p.* FROM Projects p JOIN Organizations o ON p.organization_id = o.id WHERE p.id = ? AND o.owner_id = ?',
      project_id, userId
    );

    if (!project) {
      return res.status(403).json({ error: 'Project access denied or not found' });
    }

    const keyId = uuidv4();
    
    // Generate secure api key prefix + random bits
    const rawKey = `sk_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    let expiresAt: Date | null = null;
    if (expires_in_days) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + Number(expires_in_days));
    }

    await db.run(
      'INSERT INTO ApiKeys (id, user_id, project_id, key_hash, name, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      keyId, userId, project_id, keyHash, name, expiresAt ? expiresAt.toISOString() : null
    );

    await logAudit(
      db,
      userId || 'SYSTEM',
      'CREATE_API_KEY',
      'ApiKey',
      keyId,
      null,
      JSON.stringify({ name, project_id }),
      req
    );

    return res.status(201).json({
      message: 'API Key created successfully. Copy it now, it will not be shown again.',
      id: keyId,
      name,
      apiKey: rawKey,
      expires_at: expiresAt ? expiresAt.toISOString() : null
    });
  } catch (error: any) {
    console.error('Error creating API Key:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getApiKeys(req: AuthenticatedRequest, res: Response) {
  try {
    const { project_id } = req.query;
    const userId = req.user?.userId;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id query parameter is required' });
    }

    const db = await getDb();
    const keys = await db.all(
      'SELECT id, name, expires_at, created_at FROM ApiKeys WHERE user_id = ? AND project_id = ?',
      userId, project_id
    );

    return res.status(200).json(keys);
  } catch (error: any) {
    console.error('Error fetching API Keys:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteApiKey(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const db = await getDb();
    
    // Find key and verify ownership
    const key = await db.get('SELECT * FROM ApiKeys WHERE id = ? AND user_id = ?', id, userId);
    if (!key) {
      return res.status(404).json({ error: 'API Key not found' });
    }

    await db.run('DELETE FROM ApiKeys WHERE id = ?', id);

    await logAudit(
      db,
      userId || 'SYSTEM',
      'REVOKE_API_KEY',
      'ApiKey',
      id,
      JSON.stringify(key),
      null,
      req
    );

    return res.status(200).json({ message: 'API Key revoked successfully' });
  } catch (error: any) {
    console.error('Error deleting API Key:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
