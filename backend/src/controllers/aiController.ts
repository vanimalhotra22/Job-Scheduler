import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { getDb } from '../database/db';
import { 
  analyzeFailure, 
  recommendRetryDelay, 
  predictQueueLoad, 
  parseNaturalLanguageQuery 
} from '../services/aiOps';

export async function getAiFailureAnalysis(req: AuthenticatedRequest, res: Response) {
  try {
    const { error_message, payload } = req.body;
    if (!error_message) {
      return res.status(400).json({ error: 'error_message is required' });
    }

    const diagnosis = analyzeFailure(error_message, JSON.stringify(payload || {}));
    return res.status(200).json(diagnosis);
  } catch (error: any) {
    console.error('AI Failure Analysis error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAiQueuePrediction(req: AuthenticatedRequest, res: Response) {
  try {
    const { queueId } = req.params;
    if (!queueId) {
      return res.status(400).json({ error: 'queueId parameter is required' });
    }

    const db = await getDb();
    const predictions = await predictQueueLoad(db, queueId);
    return res.status(200).json(predictions);
  } catch (error: any) {
    console.error('AI Queue Prediction error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAiRetryRecommendation(req: AuthenticatedRequest, res: Response) {
  try {
    const { error_message, retry_count = 0 } = req.body;
    if (!error_message) {
      return res.status(400).json({ error: 'error_message is required' });
    }

    const recommendedDelay = recommendRetryDelay(error_message, Number(retry_count));
    return res.status(200).json({
      recommended_delay_ms: recommendedDelay,
      message: `Recommended backoff delay of ${(recommendedDelay / 1000).toFixed(1)} seconds.`
    });
  } catch (error: any) {
    console.error('AI Retry Recommendation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAiLogSearch(req: AuthenticatedRequest, res: Response) {
  try {
    const { query } = req.body;
    const userId = req.user?.userId;

    if (!query) {
      return res.status(400).json({ error: 'search query is required' });
    }

    const db = await getDb();
    const parsed = parseNaturalLanguageQuery(query);

    // Build dynamic query based on NLP parsing
    let sql = `
      SELECT jl.*, j.status, q.name as queue_name
      FROM JobLogs jl
      JOIN Jobs j ON jl.job_id = j.id
      JOIN Queues q ON j.queue_id = q.id
      JOIN Projects p ON q.project_id = p.id
      JOIN Organizations o ON p.organization_id = o.id
      WHERE o.owner_id = ?
    `;
    const params: any[] = [userId];

    if (parsed.status) {
      sql += ' AND j.status = ?';
      params.push(parsed.status);
    }

    if (parsed.level) {
      sql += ' AND jl.level = ?';
      params.push(parsed.level);
    }

    sql += ' ORDER BY jl.timestamp DESC LIMIT ?';
    params.push(parsed.limit);

    const logs = await db.all(sql, params);
    
    return res.status(200).json({
      query,
      filtersApplied: parsed,
      results: logs
    });
  } catch (error: any) {
    console.error('AI Log Search error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
