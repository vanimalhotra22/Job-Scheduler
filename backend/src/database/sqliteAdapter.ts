import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { DbAdapter } from './db';

export class SQLiteAdapter implements DbAdapter {
  private db: Database | null = null;

  async init() {
    const dbDir = path.resolve(__dirname, '../../data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = process.env.DB_FILE_PATH || path.join(dbDir, 'scheduler.db');
    this.db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    await this.db.exec('PRAGMA foreign_keys = ON;');
    await this.db.exec('PRAGMA journal_mode = WAL;');

    let schemaPath = path.resolve(__dirname, './schema.sql');
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.resolve(process.cwd(), 'src/database/schema.sql');
    }
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.resolve(process.cwd(), 'dist/database/schema.sql');
    }

    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await this.db.exec(schemaSql);
    } else {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }

    // Run lightweight schema alterations for backwards compatibility
    try {
      await this.db.exec('ALTER TABLE Queues ADD COLUMN rate_limit_per_minute INTEGER;');
    } catch (e) {}
    try {
      await this.db.exec('ALTER TABLE Queues ADD COLUMN webhook_url TEXT;');
    } catch (e) {}
    try {
      await this.db.exec('ALTER TABLE Jobs ADD COLUMN dependency_job_id TEXT;');
    } catch (e) {}
    try {
      await this.db.exec('ALTER TABLE Jobs ADD COLUMN tags TEXT;');
    } catch (e) {}
    try {
      await this.db.exec('ALTER TABLE Jobs ADD COLUMN version INTEGER DEFAULT 1;');
    } catch (e) {}
    try {
      await this.db.exec('ALTER TABLE Jobs ADD COLUMN correlation_id TEXT;');
    } catch (e) {}
    try {
      await this.db.exec('ALTER TABLE Jobs ADD COLUMN payload_history TEXT;');
    } catch (e) {}
    try {
      await this.db.exec('ALTER TABLE Queues ADD COLUMN shard_count INTEGER DEFAULT 1;');
    } catch (e) {}
    try {
      await this.db.exec('ALTER TABLE Queues ADD COLUMN region TEXT;');
    } catch (e) {}
  }

  private getParams(params: any[]): any[] {
    if (params.length === 1 && Array.isArray(params[0])) {
      return params[0];
    }
    return params;
  }

  async run(sql: string, ...params: any[]): Promise<{ lastID?: any; changes?: number }> {
    if (!this.db) throw new Error('Database not initialized');
    const res = await this.db.run(sql, ...this.getParams(params));
    return { lastID: res.lastID, changes: res.changes };
  }

  async get<T = any>(sql: string, ...params: any[]): Promise<T | undefined> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.get<T>(sql, ...this.getParams(params));
  }

  async all<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.all<T[]>(sql, ...this.getParams(params));
  }

  async exec(sql: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.exec(sql);
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
    }
  }
}
