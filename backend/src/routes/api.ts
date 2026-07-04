import { Router } from 'express';
import { signup, login, getProfile } from '../controllers/authController';
import { 
  createOrganization, 
  getOrganizations, 
  createProject, 
  getProjects, 
  deleteProject 
} from '../controllers/projectController';
import { 
  createQueue, 
  getQueues, 
  toggleQueuePause, 
  getQueueStatistics, 
  getRetryPolicies, 
  createRetryPolicy,
  purgeQueue,
  toggleAllQueues
} from '../controllers/queueController';
import { 
  createJob, 
  getJobs, 
  getJobById, 
  deleteJob, 
  retryJob,
  cancelJob,
  retryAllJobs,
  searchJobs,
  exportJobs
} from '../controllers/jobController';
import { 
  registerWorker, 
  sendHeartbeat, 
  pollJob, 
  startJob, 
  completeJob, 
  failJob, 
  getWorkers 
} from '../controllers/workerController';
import { 
  getSystemLogs, 
  getSystemMetrics,
  getPrometheusMetrics,
  livenessProbe,
  readinessProbe
} from '../controllers/metricsController';
import { getAuditLogs } from '../controllers/auditController';
import { createApiKey, getApiKeys, deleteApiKey } from '../controllers/apiKeyController';
import { 
  getAiFailureAnalysis, 
  getAiQueuePrediction, 
  getAiRetryRecommendation, 
  getAiLogSearch 
} from '../controllers/aiController';
import { getScalingMetrics, getScalingRecommendation } from '../controllers/scalingController';
import { authenticate } from '../middleware/authMiddleware';
import { authenticateApiKey } from '../middleware/apiKeyMiddleware';

const router = Router();

// --- Authentication ---
router.post('/auth/signup', signup);
router.post('/auth/login', login);
router.get('/auth/profile', authenticate, getProfile);

// --- Organizations & Projects ---
router.post('/organizations', authenticate, createOrganization);
router.get('/organizations', authenticate, getOrganizations);
router.post('/projects', authenticate, createProject);
router.get('/projects', authenticate, getProjects);
router.delete('/projects/:id', authenticate, deleteProject);

// --- Queues & Retry Policies ---
router.post('/queues', authenticateApiKey, authenticate, createQueue);
router.get('/queues', authenticateApiKey, authenticate, getQueues);
router.patch('/queues/:id/pause', authenticateApiKey, authenticate, toggleQueuePause);
router.get('/queues/:id/statistics', authenticateApiKey, authenticate, getQueueStatistics);
router.get('/retry-policies', authenticateApiKey, authenticate, getRetryPolicies);
router.post('/retry-policies', authenticateApiKey, authenticate, createRetryPolicy);
router.post('/queues/bulk/pause', authenticateApiKey, authenticate, toggleAllQueues);
router.post('/queues/:id/purge', authenticateApiKey, authenticate, purgeQueue);

// --- Jobs ---
router.post('/jobs', authenticateApiKey, authenticate, createJob);
router.get('/jobs', authenticateApiKey, authenticate, getJobs);
router.get('/jobs/search', authenticateApiKey, authenticate, searchJobs);
router.get('/jobs/export', authenticateApiKey, authenticate, exportJobs);
router.get('/jobs/:id', authenticateApiKey, authenticate, getJobById);
router.delete('/jobs/:id', authenticateApiKey, authenticate, deleteJob);
router.post('/jobs/:id/retry', authenticateApiKey, authenticate, retryJob);
router.post('/jobs/:id/cancel', authenticateApiKey, authenticate, cancelJob);
router.post('/jobs/bulk/retry', authenticateApiKey, authenticate, retryAllJobs);

// --- API Keys ---
router.post('/api-keys', authenticate, createApiKey);
router.get('/api-keys', authenticate, getApiKeys);
router.delete('/api-keys/:id', authenticate, deleteApiKey);

// --- Audit Logs ---
router.get('/audit-logs', authenticate, getAuditLogs);

// --- AI Ops ---
router.post('/ai/failure-analysis', authenticate, getAiFailureAnalysis);
router.get('/ai/queue-prediction/:queueId', authenticate, getAiQueuePrediction);
router.post('/ai/retry-recommendation', authenticate, getAiRetryRecommendation);
router.post('/ai/log-search', authenticate, getAiLogSearch);

// --- Scaling & Cluster Health ---
router.get('/scaling/metrics', authenticate, getScalingMetrics);
router.get('/scaling/recommendation', authenticate, getScalingRecommendation);

// --- Worker Lifecycle (Decoupled APIs) ---
router.post('/workers/register', registerWorker);
router.post('/workers/:id/heartbeat', sendHeartbeat);
router.post('/workers/:id/poll', pollJob);
router.post('/workers/:id/jobs/:jobId/start', startJob);
router.post('/workers/:id/jobs/:jobId/complete', completeJob);
router.post('/workers/:id/jobs/:jobId/fail', failJob);
router.get('/workers', getWorkers);

// --- Observability & Dashboard Metrics ---
router.get('/logs', authenticate, getSystemLogs);
router.get('/metrics', authenticate, getSystemMetrics);
router.get('/prometheus/metrics', getPrometheusMetrics);

// --- Health Probes ---
router.get('/health/liveness', livenessProbe);
router.get('/health/readiness', readinessProbe);

// --- Server-Sent Events for Live Updates ---
import { addSseClient } from '../services/sse';
import { verifyToken } from '../utils/jwt';

router.get('/events', (req, res) => {
  const token = req.query.token as string;
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorized event connection' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  addSseClient(res);
});

export default router;
