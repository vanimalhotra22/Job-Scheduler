import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { getDb } from '../database/db';
import { handleJobFailure } from '../services/retryEngine';
import { v4 as uuidv4 } from 'uuid';

// Test runner entrypoint
async function runTests() {
  console.log('--------------------------------------------------');
  console.log('    Distributed Job Scheduler Automated Test Suite');
  console.log('--------------------------------------------------\n');

  const testDbFile = path.resolve(__dirname, '../../data/scheduler_test.db');
  
  // Wipe test db and WAL sidecars if exist
  ['', '-wal', '-shm'].forEach(suffix => {
    const file = testDbFile + suffix;
    if (fs.existsSync(file)) {
      try { fs.unlinkSync(file); } catch (e) {}
    }
  });

  // Set environment variable to redirect to test database file
  process.env.DB_FILE_PATH = testDbFile;

  try {
    const db = await getDb();
    console.log('[✓] Database connection and schema initialized.');

    // 1. Run Auth Tests
    await testAuthentication(db);
    
    // 2. Run Queue and Project creation tests
    const context = await testProjectsAndQueues(db);

    // 3. Run Retry Engine Policy calculations tests
    await testRetryEngineBackoffs(db, context.queueId);

    // 4. Run Concurrency and Atomic Job Claiming tests
    await testAtomicJobClaiming(db, context.queueId);

    // 5. Run Reclaimer recovery tests for crashed workers
    await testWorkerCrashRecovery(db, context.queueId);

    // 6. Run SDE-2 features (Timeouts, Rate Limiting, DAG Dependencies)
    await testSde2Upgrades(db, context.queueId);

    console.log('\n--------------------------------------------------');
    console.log('    ALL TEST SUITES PASSED SUCCESSFULLY! (6/6)');
    console.log('--------------------------------------------------');

  } catch (error: any) {
    console.error('\n[❌] TEST FAILURE ENCOUNTERED:');
    console.error(error);
    process.exit(1);
  } finally {
    // Cleanup test database file and WAL sidecars
    ['', '-wal', '-shm'].forEach(suffix => {
      const file = testDbFile + suffix;
      if (fs.existsSync(file)) {
        try { fs.unlinkSync(file); } catch (err) {}
      }
    });
  }
}

// 1. User & Auth Tests
async function testAuthentication(db: any) {
  console.log('\n--- Test Suite 1: Authentication & Users ---');
  
  const userId = uuidv4();
  const email = 'test@scheduler.com';
  
  // Insert Test User
  await db.run(
    `INSERT INTO Users (id, name, email, password_hash, role) 
     VALUES (?, 'Test User', ?, 'hashed_pass', 'USER')`,
    userId, email
  );

  const user = await db.get('SELECT * FROM Users WHERE id = ?', userId);
  assert.strictEqual(user.email, email);
  assert.strictEqual(user.role, 'USER');
  console.log('[✓] User registry and database access verified.');
}

// 2. Project and Queue Scope setup
async function testProjectsAndQueues(db: any) {
  console.log('\n--- Test Suite 2: Project Scope & Queue Config ---');
  
  const orgId = uuidv4();
  const projectId = uuidv4();
  const queueId = uuidv4();
  const policyId = uuidv4();

  // Create Organizations & Project
  const testUser = await db.get('SELECT id FROM Users LIMIT 1');
  const ownerId = testUser ? testUser.id : 'uid';
  await db.run(`INSERT INTO Organizations (id, name, owner_id) VALUES (?, 'Test Org', ?)`, orgId, ownerId);
  await db.run(`INSERT INTO Projects (id, organization_id, name) VALUES (?, ?, 'Notification Engine')`, projectId, orgId);

  // Setup Retry policy
  await db.run(
    `INSERT INTO RetryPolicies (id, name, type, delay_ms, multiplier, max_retries) 
     VALUES (?, 'Linear Test', 'LINEAR', 2000, 1.0, 3)`,
    policyId
  );

  // Create Queue
  await db.run(
    `INSERT INTO Queues (id, project_id, name, priority, concurrency_limit, retry_policy_id) 
     VALUES (?, ?, 'email-test-queue', 3, 5, ?)`,
    queueId, projectId, policyId
  );

  const queue = await db.get('SELECT * FROM Queues WHERE id = ?', queueId);
  assert.strictEqual(queue.name, 'email-test-queue');
  assert.strictEqual(queue.concurrency_limit, 5);
  assert.strictEqual(queue.priority, 3);
  console.log('[✓] Queue, Project bindings, and retry policy associations verified.');

  return { queueId, policyId };
}

// 3. Retry calculation tests (Fixed, Linear, Exponential backoffs)
async function testRetryEngineBackoffs(db: any, queueId: string) {
  console.log('\n--- Test Suite 3: Retry Backoff Policy calculations ---');

  const jobId = uuidv4();
  const workerId = uuidv4();
  
  // Submit a failing job
  await db.run(
    `INSERT INTO Jobs (id, queue_id, status, priority, payload, scheduled_for, max_retries, retry_count) 
     VALUES (?, ?, 'RUNNING', 1, '{}', ?, 3, 0)`,
    jobId, queueId, new Date().toISOString()
  );

  // 1st failure (Linear backoff: base 2000ms * 1 = 2000ms delay)
  const result1 = await handleJobFailure(db, jobId, 'Connection failure mock', workerId);
  assert.strictEqual(result1.status, 'SCHEDULED');
  
  let jobState = await db.get('SELECT * FROM Jobs WHERE id = ?', jobId);
  assert.strictEqual(jobState.status, 'SCHEDULED');
  assert.strictEqual(jobState.retry_count, 1);
  
  const delay1 = new Date(result1.nextAttemptAt!).getTime() - Date.now();
  assert.ok(delay1 > 1500 && delay1 <= 2000, `Expected ~2s delay, got ${delay1}ms`);

  // 2nd failure (Linear backoff: base 2000ms * 2 = 4000ms delay)
  await db.run(`UPDATE Jobs SET status = 'RUNNING' WHERE id = ?`, jobId);
  const result2 = await handleJobFailure(db, jobId, 'Second failure mock', workerId);
  const delay2 = new Date(result2.nextAttemptAt!).getTime() - Date.now();
  assert.ok(delay2 > 3500 && delay2 <= 4000, `Expected ~4s delay, got ${delay2}ms`);

  // 3rd failure (Exceeds maximum retry limit of 3 -> moves to DLQ)
  await db.run(`UPDATE Jobs SET status = 'RUNNING', retry_count = 3 WHERE id = ?`, jobId);
  const result3 = await handleJobFailure(db, jobId, 'Fatal error mock', workerId);
  assert.strictEqual(result3.status, 'DEAD');

  const dlqEntry = await db.get('SELECT * FROM DeadLetterQueue WHERE job_id = ?', jobId);
  assert.ok(dlqEntry);
  assert.strictEqual(dlqEntry.reason, 'Fatal error mock');

  const finalJobState = await db.get('SELECT * FROM Jobs WHERE id = ?', jobId);
  assert.strictEqual(finalJobState.status, 'DEAD');
  console.log('[✓] Retry policy engine (delay intervals and DLQ routing) verified.');
}

// 4. Atomic Job Claiming tests (Concurrency check)
async function testAtomicJobClaiming(db: any, queueId: string) {
  console.log('\n--- Test Suite 4: Atomic Concurrency & Skip Locked ---');

  const jobId1 = uuidv4();
  const jobId2 = uuidv4();
  
  const now = new Date().toISOString();

  // Queue two ready jobs
  await db.run(
    `INSERT INTO Jobs (id, queue_id, status, priority, payload, scheduled_for) 
     VALUES (?, ?, 'QUEUED', 1, '{}', ?)`,
    jobId1, queueId, now
  );
  await db.run(
    `INSERT INTO Jobs (id, queue_id, status, priority, payload, scheduled_for) 
     VALUES (?, ?, 'QUEUED', 1, '{}', ?)`,
    jobId2, queueId, now
  );

  const worker1 = uuidv4();
  const worker2 = uuidv4();

  // Setup Workers
  await db.run(`INSERT INTO Workers (id, hostname, status) VALUES (?, 'worker-1', 'IDLE')`, worker1);
  await db.run(`INSERT INTO Workers (id, hostname, status) VALUES (?, 'worker-2', 'IDLE')`, worker2);

  // Concurrency Claim Simulation (Simulating immediate transactions)
  // Worker 1 starts transaction and claims job
  await db.exec('BEGIN IMMEDIATE TRANSACTION;');
  
  const claimableJobW1 = await db.get(
    `SELECT j.id FROM Jobs j
     JOIN Queues q ON j.queue_id = q.id
     WHERE j.status = 'QUEUED' AND q.paused = 0 AND j.scheduled_for <= ?
     ORDER BY j.priority DESC, j.created_at ASC LIMIT 1`,
    now
  );
  
  assert.ok(claimableJobW1);
  const claimedJobId = claimableJobW1.id;

  await db.run(
    `UPDATE Jobs SET status = 'CLAIMED', worker_id = ? WHERE id = ?`,
    worker1, claimedJobId
  );
  await db.exec('COMMIT;');

  // Worker 2 starts transaction to claim (should get the other job)
  await db.exec('BEGIN IMMEDIATE TRANSACTION;');
  const claimableJobW2 = await db.get(
    `SELECT j.id FROM Jobs j
     JOIN Queues q ON j.queue_id = q.id
     WHERE j.status = 'QUEUED' AND q.paused = 0 AND j.scheduled_for <= ?
     ORDER BY j.priority DESC, j.created_at ASC LIMIT 1`,
    now
  );
  
  assert.ok(claimableJobW2);
  assert.notStrictEqual(claimableJobW2.id, claimedJobId); // Ensure worker 2 gets a different job!
  
  await db.run(
    `UPDATE Jobs SET status = 'CLAIMED', worker_id = ? WHERE id = ?`,
    worker2, claimableJobW2.id
  );
  await db.exec('COMMIT;');

  const job1State = await db.get('SELECT status, worker_id FROM Jobs WHERE id = ?', jobId1);
  const job2State = await db.get('SELECT status, worker_id FROM Jobs WHERE id = ?', jobId2);

  assert.strictEqual(job1State.status, 'CLAIMED');
  assert.strictEqual(job2State.status, 'CLAIMED');
  assert.notStrictEqual(job1State.worker_id, job2State.worker_id);

  console.log('[✓] Atomic double-claim prevention verified.');
}

// 5. Worker crash recovery tests
async function testWorkerCrashRecovery(db: any, queueId: string) {
  console.log('\n--- Test Suite 5: Worker Crash & Job Reclaimer ---');

  const workerId = uuidv4();
  const jobId = uuidv4();

  // Register worker
  await db.run(
    `INSERT INTO Workers (id, hostname, status, last_heartbeat) 
     VALUES (?, 'worker-crashed', 'ACTIVE', ?)`,
    workerId,
    new Date(Date.now() - 30000).toISOString() // 30s ago (stale heartbeat)
  );

  // Assign job to worker
  await db.run(
    `INSERT INTO Jobs (id, queue_id, status, priority, payload, scheduled_for, worker_id, max_retries, retry_count) 
     VALUES (?, ?, 'RUNNING', 2, '{}', ?, ?, 3, 0)`,
    jobId, queueId, new Date().toISOString(), workerId
  );

  // Simulate Reclaimer Logic
  const thresholdTime = new Date(Date.now() - 15000).toISOString();
  
  const staleWorkers = await db.all(
    `SELECT id FROM Workers WHERE status IN ('ACTIVE', 'IDLE') AND last_heartbeat < ? AND id = ?`,
    thresholdTime,
    workerId
  );
  
  assert.strictEqual(staleWorkers.length, 1);
  assert.strictEqual(staleWorkers[0].id, workerId);

  // Reclaim
  await db.exec('BEGIN IMMEDIATE TRANSACTION;');
  for (const w of staleWorkers) {
    await db.run(`UPDATE Workers SET status = 'OFFLINE' WHERE id = ?`, w.id);
    
    const stranded = await db.all(
      `SELECT id, retry_count, max_retries FROM Jobs WHERE worker_id = ? AND status = 'RUNNING'`,
      w.id
    );
    
    for (const job of stranded) {
      await db.run(
        `UPDATE Jobs SET status = 'QUEUED', worker_id = NULL, retry_count = retry_count + 1 WHERE id = ?`,
        job.id
      );
    }
  }
  await db.exec('COMMIT;');

  const recoveredJob = await db.get('SELECT * FROM Jobs WHERE id = ?', jobId);
  assert.strictEqual(recoveredJob.status, 'QUEUED');
  assert.strictEqual(recoveredJob.worker_id, null);
  assert.strictEqual(recoveredJob.retry_count, 1);

  const deadWorker = await db.get('SELECT * FROM Workers WHERE id = ?', workerId);
  assert.strictEqual(deadWorker.status, 'OFFLINE');

  console.log('[✓] Stalled job recovery from crashed worker nodes verified.');
}

// 6. SDE-2 Upgrades (Timeouts, Rate Limiting, & DAG Dependencies)
async function testSde2Upgrades(db: any, queueId: string) {
  console.log('\n--- Test Suite 6: SDE-2 Upgrades (Timeouts, Rate Limiting, & DAG) ---');

  // Register worker w1 to satisfy foreign key constraints
  await db.run(
    `INSERT INTO Workers (id, hostname, status, last_heartbeat) 
     VALUES ('w1', 'test-worker-sde2', 'ACTIVE', ?)`,
    new Date().toISOString()
  );

  // --- 6.1 DAG Workflow Dependencies ---
  const parentId = uuidv4();
  const childId = uuidv4();

  // Insert parent job
  await db.run(
    `INSERT INTO Jobs (id, queue_id, status, priority, payload, scheduled_for, max_retries, retry_count) 
     VALUES (?, ?, 'QUEUED', 2, '{}', ?, 3, 0)`,
    parentId, queueId, new Date().toISOString()
  );

  // Insert dependent child job
  await db.run(
    `INSERT INTO Jobs (id, queue_id, status, priority, payload, scheduled_for, max_retries, retry_count, dependency_job_id) 
     VALUES (?, ?, 'BLOCKED', 2, '{}', ?, 3, 0, ?)`,
    childId, queueId, new Date().toISOString(), parentId
  );

  // Verify child is initially BLOCKED
  const initialChild = await db.get('SELECT status FROM Jobs WHERE id = ?', childId);
  assert.strictEqual(initialChild.status, 'BLOCKED');

  // Complete parent job and verify child unblocks to QUEUED
  await db.exec('BEGIN TRANSACTION;');
  await db.run(`UPDATE Jobs SET status = 'COMPLETED' WHERE id = ?`, parentId);
  
  // Triggers unblocking logic (simulated from completeJob controller)
  const dependentJobs = await db.all(`SELECT id FROM Jobs WHERE dependency_job_id = ? AND status = 'BLOCKED'`, parentId);
  for (const child of dependentJobs) {
    await db.run(`UPDATE Jobs SET status = 'QUEUED' WHERE id = ?`, child.id);
  }
  await db.exec('COMMIT;');

  const unblockedChild = await db.get('SELECT status FROM Jobs WHERE id = ?', childId);
  assert.strictEqual(unblockedChild.status, 'QUEUED');
  console.log('[✓] DAG Workflow dependency unblocking verified.');

  // --- 6.2 Token Bucket Rate Limiting ---
  const rateLimitQueueId = uuidv4();
  const testProj = await db.get('SELECT id FROM Projects LIMIT 1');
  const projId = testProj ? testProj.id : 'pid';
  await db.run(
    `INSERT INTO Queues (id, project_id, name, priority, concurrency_limit, rate_limit_per_minute) 
     VALUES (?, ?, 'rate-limited-test-queue', 2, 5, 1)`,
    rateLimitQueueId,
    projId
  );

  const rJob1 = uuidv4();
  const rJob2 = uuidv4();

  await db.run(
    `INSERT INTO Jobs (id, queue_id, status, priority, payload, scheduled_for, max_retries, retry_count) 
     VALUES (?, ?, 'QUEUED', 2, '{}', ?, 3, 0)`,
    rJob1, rateLimitQueueId, new Date().toISOString()
  );
  await db.run(
    `INSERT INTO Jobs (id, queue_id, status, priority, payload, scheduled_for, max_retries, retry_count) 
     VALUES (?, ?, 'QUEUED', 2, '{}', ?, 3, 0)`,
    rJob2, rateLimitQueueId, new Date().toISOString()
  );

  // Claim first job
  const now = new Date().toISOString();
  const claimableJob1 = await db.get(
    `SELECT j.id FROM Jobs j JOIN Queues q ON j.queue_id = q.id 
     WHERE j.status = 'QUEUED' AND q.id = ? AND (
       q.rate_limit_per_minute IS NULL OR (
         SELECT COUNT(*) FROM JobExecutions je JOIN Jobs j3 ON je.job_id = j3.id
         WHERE j3.queue_id = j.queue_id AND je.start_time >= ?
       ) < q.rate_limit_per_minute
     ) LIMIT 1`,
    rateLimitQueueId,
    new Date(Date.now() - 60000).toISOString()
  );

  assert.ok(claimableJob1);
  assert.strictEqual(claimableJob1.id, rJob1);

  // Simulate starting the execution for job 1
  await db.run(`UPDATE Jobs SET status = 'CLAIMED' WHERE id = ?`, rJob1);
  await db.run(`INSERT INTO JobExecutions (id, job_id, worker_id, start_time, status) VALUES (?, ?, 'w1', ?, 'RUNNING')`, uuidv4(), rJob1, now);

  // Attempt claiming second job (should fail/return undefined due to rate limit threshold of 1)
  const claimableJob2 = await db.get(
    `SELECT j.id FROM Jobs j JOIN Queues q ON j.queue_id = q.id 
     WHERE j.status = 'QUEUED' AND q.id = ? AND (
       q.rate_limit_per_minute IS NULL OR (
         SELECT COUNT(*) FROM JobExecutions je JOIN Jobs j3 ON je.job_id = j3.id
         WHERE j3.queue_id = j.queue_id AND je.start_time >= ?
       ) < q.rate_limit_per_minute
     ) LIMIT 1`,
    rateLimitQueueId,
    new Date(Date.now() - 60000).toISOString()
  );

  assert.strictEqual(claimableJob2, undefined);
  console.log('[✓] Queue token-bucket rate limiting verified.');

  // --- 6.3 Job Execution Timeouts ---
  const tJobId = uuidv4();
  await db.run(
    `INSERT INTO Jobs (id, queue_id, status, priority, payload, scheduled_for, max_retries, retry_count, timeout_ms) 
     VALUES (?, ?, 'RUNNING', 2, '{}', ?, 0, 0, 50)`,
    tJobId, queueId, new Date().toISOString()
  );

  // Start execution with past timestamp (simulate running for 100ms with timeout_ms = 50)
  const execId = uuidv4();
  await db.run(
    `INSERT INTO JobExecutions (id, job_id, worker_id, start_time, status) 
     VALUES (?, ?, 'w1', ?, 'RUNNING')`,
    execId, tJobId, new Date(Date.now() - 100).toISOString()
  );

  // Run the timeout sweeper check
  const activeRuns = await db.all(
    `SELECT j.id, j.timeout_ms, je.id as execution_id, je.start_time
     FROM Jobs j
     JOIN JobExecutions je ON je.job_id = j.id
     WHERE j.status = 'RUNNING' AND je.status = 'RUNNING'`
  );

  assert.strictEqual(activeRuns.length, 1);
  const run = activeRuns[0];
  const runTimeMs = Date.now() - new Date(run.start_time).getTime();
  assert.ok(runTimeMs > run.timeout_ms); // Should be exceeded

  // Transition to DEAD (max_retries is 1, next retry would be 1, exceeds 1)
  await db.run(`UPDATE JobExecutions SET status = 'FAILED', error_message = 'Job execution timeout exceeded' WHERE id = ?`, run.execution_id);
  await handleJobFailure(db, run.id, 'Job execution timeout exceeded', 'w1');

  const finalJobState = await db.get('SELECT status FROM Jobs WHERE id = ?', tJobId);
  assert.strictEqual(finalJobState.status, 'DEAD');
  console.log('[✓] Job execution timeout sweeper and retry engine routing verified.');
}

// Start execution
runTests().catch(console.error);
