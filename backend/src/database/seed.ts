import { getDb } from './db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export async function seedDatabase() {
  const db = await getDb();
  
  // Check if admin user already exists
  const existingAdmin = await db.get('SELECT * FROM Users WHERE email = ?', 'admin@scheduler.com');
  if (existingAdmin) {
    console.log('Database already initialized (Admin user exists). Skipping seed.');
    return;
  }
  
  console.log('Seeding database with default configuration...');

  // 1. Seed admin user
  const adminId = uuidv4();
  const passwordHash = await bcrypt.hash('admin123', 10);
  await db.run(
    `INSERT INTO Users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
    adminId, 'System Admin', 'admin@scheduler.com', passwordHash, 'ADMIN'
  );
  
  // 2. Seed Default Organization
  const orgId = uuidv4();
  await db.run(
    `INSERT INTO Organizations (id, name, owner_id) VALUES (?, ?, ?)`,
    orgId, 'Acme Corp', adminId
  );
  
  // 3. Seed Projects
  const notifyProjectId = uuidv4();
  const mediaProjectId = uuidv4();
  await db.run(
    `INSERT INTO Projects (id, organization_id, name, description) VALUES (?, ?, ?, ?)`,
    notifyProjectId, orgId, 'Notification Services', 'System handling notifications and user messaging'
  );
  await db.run(
    `INSERT INTO Projects (id, organization_id, name, description) VALUES (?, ?, ?, ?)`,
    mediaProjectId, orgId, 'Media Processing', 'Handles transcoding, image resizing, and PDF generations'
  );
  
  // 4. Seed Retry Policies
  const policyFixedId = uuidv4();
  const policyLinearId = uuidv4();
  const policyExponentialId = uuidv4();
  
  await db.run(
    `INSERT INTO RetryPolicies (id, name, type, delay_ms, multiplier, max_retries) VALUES (?, ?, ?, ?, ?, ?)`,
    policyFixedId, 'Fixed Delay (5s)', 'FIXED', 5000, 1.0, 3
  );
  await db.run(
    `INSERT INTO RetryPolicies (id, name, type, delay_ms, multiplier, max_retries) VALUES (?, ?, ?, ?, ?, ?)`,
    policyLinearId, 'Linear Backoff (10s base)', 'LINEAR', 10000, 1.0, 4
  );
  await db.run(
    `INSERT INTO RetryPolicies (id, name, type, delay_ms, multiplier, max_retries) VALUES (?, ?, ?, ?, ?, ?)`,
    policyExponentialId, 'Exponential Backoff (2s base)', 'EXPONENTIAL', 2000, 2.0, 5
  );
  
  // 5. Seed Queues
  await db.run(
    `INSERT INTO Queues (id, project_id, name, priority, concurrency_limit, retry_policy_id, paused) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    uuidv4(), notifyProjectId, 'email-queue', 3, 10, policyFixedId, 0
  );
  await db.run(
    `INSERT INTO Queues (id, project_id, name, priority, concurrency_limit, retry_policy_id, paused) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    uuidv4(), notifyProjectId, 'sms-queue', 2, 5, policyLinearId, 0
  );
  await db.run(
    `INSERT INTO Queues (id, project_id, name, priority, concurrency_limit, retry_policy_id, paused) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    uuidv4(), mediaProjectId, 'video-transcode', 1, 2, policyExponentialId, 0
  );
  await db.run(
    `INSERT INTO Queues (id, project_id, name, priority, concurrency_limit, retry_policy_id, paused) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    uuidv4(), mediaProjectId, 'image-resize', 2, 8, policyFixedId, 0
  );
  
  console.log('Database seeding completed successfully.');
}
