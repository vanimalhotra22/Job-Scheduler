import os from 'os';

const API_SERVER = process.env.API_SERVER || 'http://localhost:5000/api';
const HOSTNAME = os.hostname() || 'worker-instance';
let workerId: string | null = null;
let activeJobsCount = 0;
let isShuttingDown = false;
let heartbeatTimer: NodeJS.Timeout | null = null;
let pollTimer: NodeJS.Timeout | null = null;

// Mock job executor
async function executeJob(job: { id: string; queue_id: string; payload: any; priority: number }): Promise<void> {
  const { payload } = job;
  const taskType = payload.type || 'generic';
  
  console.log(`[Worker] Started executing job ${job.id} (Type: ${taskType}, Priority: ${job.priority})`);

  // Simulate work based on job types
  switch (taskType) {
    case 'email':
      // Mock sending email
      await sleep(1500);
      console.log(`[Worker] Email sent to ${payload.to || 'recipient@acme.com'}`);
      break;

    case 'video-transcode':
      // Mock heavy processing
      console.log(`[Worker] Transcoding video file: ${payload.filename || 'movie.mp4'} to resolution ${payload.resolution || '1080p'}...`);
      await sleep(6000);
      console.log(`[Worker] Video transcode completed for ${payload.filename}`);
      break;

    case 'image-resize':
      // Mock quick processing
      await sleep(800);
      console.log(`[Worker] Resized image ${payload.image_url || 'asset.png'} to ${payload.width || 300}x${payload.height || 300}`);
      break;

    case 'failure-test':
      // Mock intentional failure
      await sleep(1000);
      throw new Error(payload.error_message || 'Simulated execution exception');

    default:
      // Generic mock execution
      const duration = payload.duration_ms || 2000;
      await sleep(duration);
      console.log(`[Worker] Completed generic job task in ${duration}ms`);
      break;
  }
}

async function register() {
  try {
    const res = await fetch(`${API_SERVER}/workers/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostname: HOSTNAME })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Registration failed: ${errText}`);
    }

    const data: any = await res.json();
    workerId = data.workerId;
    console.log(`[Worker] Registered successfully with Server. ID: ${workerId}`);
    
    // Start heartbeats and job polling
    startHeartbeatLoop();
    startPollingLoop();
  } catch (error) {
    console.error('[Worker] Error registering worker. Retrying in 5 seconds...', error);
    setTimeout(register, 5000);
  }
}

function startHeartbeatLoop() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);

  heartbeatTimer = setInterval(async () => {
    if (!workerId || isShuttingDown) return;

    // Calculate OS metrics
    const cpus = os.cpus();
    const loadAvg = os.loadavg()[0]; // 1-minute load average
    const cpuUsage = Math.min(100, Math.round((loadAvg / cpus.length) * 100));

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);

    try {
      const res = await fetch(`${API_SERVER}/workers/${workerId}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpu_usage: cpuUsage, memory_usage: memoryUsage })
      });

      if (!res.ok) {
        console.warn(`[Worker] Heartbeat failed with status: ${res.status}`);
      }
    } catch (error) {
      console.error('[Worker] Heartbeat network error:', error);
    }
  }, 5000);
}

async function startPollingLoop() {
  if (isShuttingDown) return;

  try {
    const res = await fetch(`${API_SERVER}/workers/${workerId}/poll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.status === 204) {
      // No jobs available. Backoff poll for 1 second.
      pollTimer = setTimeout(startPollingLoop, 1000);
      return;
    }

    if (!res.ok) {
      console.warn(`[Worker] Poll failed with status: ${res.status}. Retrying in 3s...`);
      pollTimer = setTimeout(startPollingLoop, 3000);
      return;
    }

    const job: any = await res.json();
    if (job && job.id) {
      activeJobsCount++;
      // Run execution asynchronously
      runJob(job).catch(err => console.error('[Worker] Job runner crash:', err));
    }

    // Immediately poll again for concurrent job handling
    pollTimer = setTimeout(startPollingLoop, 10);
  } catch (error) {
    console.error('[Worker] Poll connection error. Retrying in 5 seconds...', error);
    pollTimer = setTimeout(startPollingLoop, 5000);
  }
}

async function runJob(job: { id: string; queue_id: string; payload: any; priority: number }) {
  try {
    // 1. Report job start
    const startRes = await fetch(`${API_SERVER}/workers/${workerId}/jobs/${job.id}/start`, {
      method: 'POST'
    });
    if (!startRes.ok) {
      throw new Error(`Could not notify start of job ${job.id}`);
    }

    // 2. Execute task
    try {
      await executeJob(job);
      
      // 3. Report completion
      const completeRes = await fetch(`${API_SERVER}/workers/${workerId}/jobs/${job.id}/complete`, {
        method: 'POST'
      });
      if (!completeRes.ok) {
        console.error(`[Worker] Failed to report completion of job ${job.id}`);
      }
    } catch (jobError: any) {
      console.error(`[Worker] Job ${job.id} failed execution. Error: ${jobError.message}`);
      
      // 3. Report failure
      const failRes = await fetch(`${API_SERVER}/workers/${workerId}/jobs/${job.id}/fail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: jobError.message || 'Execution error' })
      });
      if (!failRes.ok) {
        console.error(`[Worker] Failed to report failure of job ${job.id}`);
      }
    }
  } catch (error) {
    console.error(`[Worker] Error managing lifecycle of job ${job.id}:`, error);
  } finally {
    activeJobsCount--;
    if (isShuttingDown && activeJobsCount === 0) {
      console.log('[Worker] All active tasks completed. Exiting worker process.');
      process.exit(0);
    }
  }
}

// Utility delay
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Graceful shutdown handling
function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('[Worker] Shutting down. Stopping job polling...');
  
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (pollTimer) clearTimeout(pollTimer);

  if (activeJobsCount > 0) {
    console.log(`[Worker] Draining active tasks: waiting for ${activeJobsCount} running jobs to finish...`);
    // Force shut down after 15s if it takes too long
    setTimeout(() => {
      console.error('[Worker] Force shutting down due to timeout.');
      process.exit(1);
    }, 15000);
  } else {
    console.log('[Worker] No active tasks. Exiting worker process.');
    process.exit(0);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('[Worker] Starting worker service...');
register();
