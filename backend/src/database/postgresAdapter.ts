import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';
import { DbAdapter } from './db';

export class PostgresAdapter implements DbAdapter {
  private pool: Pool | null = null;

  async init() {
    const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/scheduler';
    this.pool = new Pool({
      connectionString
    });

    const schemaPath = path.resolve(__dirname, './postgres-schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await this.pool.query(schemaSql);
    } else {
      // Fallback inline schema if file doesn't exist
      await this.createDefaultSchema();
    }
  }

  private convertSql(sql: string): string {
    let index = 1;
    // Replace all ? with $1, $2, etc. unless they are in quotes (our codebase doesn't do that)
    return sql.replace(/\?/g, () => `$${index++}`);
  }

  private getParams(params: any[]): any[] {
    if (params.length === 1 && Array.isArray(params[0])) {
      return params[0];
    }
    return params;
  }

  async run(sql: string, ...params: any[]): Promise<{ lastID?: any; changes?: number }> {
    if (!this.pool) throw new Error('Database not initialized');
    const converted = this.convertSql(sql);
    const args = this.getParams(params);
    const res = await this.pool.query(converted, args);
    return { 
      lastID: res.rows[0]?.id || null, 
      changes: res.rowCount ?? 0 
    };
  }

  async get<T = any>(sql: string, ...params: any[]): Promise<T | undefined> {
    if (!this.pool) throw new Error('Database not initialized');
    const converted = this.convertSql(sql);
    const args = this.getParams(params);
    const res = await this.pool.query(converted, args);
    return res.rows[0];
  }

  async all<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    if (!this.pool) throw new Error('Database not initialized');
    const converted = this.convertSql(sql);
    const args = this.getParams(params);
    const res = await this.pool.query(converted, args);
    return res.rows;
  }

  async exec(sql: string): Promise<void> {
    if (!this.pool) throw new Error('Database not initialized');
    // split by semicolon for multiple statements
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const statement of statements) {
      await this.pool.query(statement);
    }
  }

  private async createDefaultSchema() {
    if (!this.pool) return;
    // Basic setup script to run if postgres-schema.sql is missing
    const schema = `
      CREATE TABLE IF NOT EXISTS Users (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'USER',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await this.pool.query(schema);
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}
