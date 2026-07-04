import { DbAdapter } from '../database/db';
import { v4 as uuidv4 } from 'uuid';

export async function handleJobFailure(
  db: DbAdapter,
  jobId: string,
  errorMessage: string,
  workerId: string
): Promise<{ status: string; nextAttemptAt?: string }> {
  // 1. Fetch job, its queue's retry policy, queue name, and webhook URL
  const job = await db.get(
    `SELECT j.*, q.retry_policy_id, q.name as queue_name, q.webhook_url 
     FROM Jobs j
     JOIN Queues q ON j.queue_id = q.id
     WHERE j.id = ?`,
    jobId
  );

  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  const nextRetryCount = job.retry_count + 1;
  const maxRetries = job.max_retries;

  // Write failure execution log
  await db.run(
    `INSERT INTO JobLogs (id, job_id, worker_id, message, level) 
     VALUES (?, ?, ?, ?, ?)`,
    uuidv4(),
    jobId,
    workerId,
    `Execution failed: ${errorMessage}`,
    'ERROR'
  );

  // If we have exhausted all retries, move to Dead Letter Queue (DLQ)
  if (nextRetryCount > maxRetries) {
    await db.run(
      `UPDATE Jobs 
       SET status = 'DEAD', retry_count = ?, worker_id = NULL, updated_at = ? 
       WHERE id = ?`,
      nextRetryCount,
      new Date().toISOString(),
      jobId
    );

    // Insert into DLQ (with ON CONFLICT update if already exists)
    await db.run(
      `INSERT INTO DeadLetterQueue (id, job_id, reason, failed_at, resolved) 
       VALUES (?, ?, ?, ?, 0)
       ON CONFLICT(job_id) DO UPDATE SET reason = excluded.reason, failed_at = excluded.failed_at, resolved = 0`,
      uuidv4(),
      jobId,
      errorMessage,
      new Date().toISOString()
    );

    await db.run(
      `INSERT INTO JobLogs (id, job_id, worker_id, message, level) 
       VALUES (?, ?, ?, ?, ?)`,
      uuidv4(),
      jobId,
      workerId,
      `Job reached maximum retries (${maxRetries}). Moved to Dead Letter Queue.`,
      'ERROR'
    );

    // Recursively fail any child jobs depending on this parent job (DAG Failure Cascade)
    await cascadeJobFailure(db, jobId);

    // Send Slack DLQ alert if webhook URL is configured
    if (job.webhook_url) {
      sendSlackAlert(job.webhook_url, jobId, errorMessage, job.queue_name).catch(err => {
        console.error('[Notifier] Slack notification error:', err);
      });
    }

    return { status: 'DEAD' };
  }

  // Calculate backoff delay
  let delayMs = 5000; // default 5s
  let policyType = 'FIXED';

  if (job.retry_policy_id) {
    const policy = await db.get('SELECT * FROM RetryPolicies WHERE id = ?', job.retry_policy_id);
    if (policy) {
      policyType = policy.type;
      const baseDelay = policy.delay_ms;
      const multiplier = policy.multiplier;

      if (policy.type === 'FIXED') {
        delayMs = baseDelay;
      } else if (policy.type === 'LINEAR') {
        delayMs = baseDelay * nextRetryCount;
      } else if (policy.type === 'EXPONENTIAL') {
        delayMs = baseDelay * Math.pow(multiplier, nextRetryCount - 1);
      }
    }
  }

  const nextAttemptDate = new Date(Date.now() + delayMs);
  const nextAttemptAt = nextAttemptDate.toISOString();

  // Set job back to SCHEDULED status with calculated delay
  await db.run(
    `UPDATE Jobs 
     SET status = 'SCHEDULED', retry_count = ?, worker_id = NULL, scheduled_for = ?, updated_at = ? 
     WHERE id = ?`,
    nextRetryCount,
    nextAttemptAt,
    new Date().toISOString(),
    jobId
  );

  await db.run(
    `INSERT INTO JobLogs (id, job_id, worker_id, message, level) 
     VALUES (?, ?, ?, ?, ?)`,
    uuidv4(),
    jobId,
    workerId,
    `Job scheduled for retry #${nextRetryCount} in ${Math.round(delayMs / 1000)}s (Policy: ${policyType}) at ${nextAttemptAt}`,
    'WARN'
  );

  return { status: 'SCHEDULED', nextAttemptAt };
}

// Recursive helper to fail child workflows when dependency parent fails permanently
async function cascadeJobFailure(db: DbAdapter, parentJobId: string): Promise<void> {
  const dependentJobs = await db.all(
    `SELECT id FROM Jobs WHERE dependency_job_id = ? AND status = 'BLOCKED'`,
    parentJobId
  );

  const now = new Date().toISOString();

  for (const child of dependentJobs) {
    // 1. Mark child job as DEAD
    await db.run(
      `UPDATE Jobs SET status = 'DEAD', worker_id = NULL, updated_at = ? WHERE id = ?`,
      now,
      child.id
    );

    // 2. Insert into Dead Letter Queue
    await db.run(
      `INSERT INTO DeadLetterQueue (id, job_id, reason, failed_at, resolved) 
       VALUES (?, ?, ?, ?, 0)
       ON CONFLICT(job_id) DO UPDATE SET reason = excluded.reason, failed_at = excluded.failed_at, resolved = 0`,
      uuidv4(),
      child.id,
      `Parent dependency failed: job ${parentJobId} entered DLQ.`,
      now
    );

    // 3. Log the cascade failure event
    await db.run(
      `INSERT INTO JobLogs (id, job_id, message, level) 
       VALUES (?, ?, ?, 'ERROR')`,
      uuidv4(),
      child.id,
      `Job automatically failed and routed to DLQ because parent dependency job ${parentJobId} failed.`
    );

    // 4. Recursively propagate down the tree
    await cascadeJobFailure(db, child.id);
  }
}

// Helper to send DLQ notification alerts to Slack/Discord webhooks
async function sendSlackAlert(
  webhookUrl: string,
  jobId: string,
  errorMessage: string,
  queueName: string
): Promise<void> {
  try {
    const payload = {
      text: `🚨 *Dead Letter Queue Alert* 🚨\n\n*Job ID*: \`${jobId}\`\n*Queue*: \`${queueName}\`\n*Error*: \`${errorMessage}\`\n*Time*: \`${new Date().toISOString()}\`\n\n_Action Required: Inspect and retry this job from the scheduler dashboard._`
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('[Notifier] Error sending Slack alert:', error);
  }
}
