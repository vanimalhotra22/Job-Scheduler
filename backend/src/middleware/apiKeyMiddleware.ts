import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './authMiddleware';
import { getDb } from '../database/db';
import crypto from 'crypto';
import { checkQuota } from '../services/quotaService';

export async function authenticateApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const apiKeyHeader = req.header('X-API-Key');
  if (!apiKeyHeader) {
    return next(); // Fall through to standard JWT authentication
  }

  try {
    const db = await getDb();
    
    // Compute the SHA-256 hash of the API key
    const keyHash = crypto.createHash('sha256').update(apiKeyHeader).digest('hex');
    
    // Query database for key
    const keyRecord = await db.get(
      'SELECT ak.*, p.organization_id FROM ApiKeys ak JOIN Projects p ON ak.project_id = p.id WHERE ak.key_hash = ?',
      keyHash
    );

    if (!keyRecord) {
      return res.status(401).json({ error: 'Invalid API Key provided' });
    }

    if (keyRecord.expires_at && new Date(keyRecord.expires_at).getTime() < Date.now()) {
      return res.status(401).json({ error: 'API Key has expired' });
    }

    // Check project quota usage
    const quota = await checkQuota(keyRecord.project_id, 'FREE');
    if (!quota.allowed) {
      return res.status(429).json({ error: `Daily job creation quota limit reached. Maximum limit: ${quota.limit}` });
    }

    // Set request user context
    req.user = {
      userId: keyRecord.user_id,
      email: 'apikey-user@scheduler.local',
      role: 'USER'
    };

    // Inject tenant project scope parameters
    (req as any).projectScope = {
      projectId: keyRecord.project_id,
      organizationId: keyRecord.organization_id
    };

    next();
  } catch (err: any) {
    console.error('[ApiKeyMiddleware] Auth error:', err.message);
    return res.status(500).json({ error: 'API Key authentication failed' });
  }
}
