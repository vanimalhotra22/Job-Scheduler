import { SQLiteAdapter } from './sqliteAdapter';
import { PostgresAdapter } from './postgresAdapter';

export interface DbAdapter {
  run(sql: string, ...params: any[]): Promise<{ lastID?: any; changes?: number }>;
  get<T = any>(sql: string, ...params: any[]): Promise<T | undefined>;
  all<T = any>(sql: string, ...params: any[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

let dbInstance: DbAdapter | null = null;

export async function getDb(): Promise<DbAdapter> {
  if (dbInstance) return dbInstance;

  const dbType = process.env.DB_TYPE || 'sqlite';
  if (dbType === 'postgres') {
    dbInstance = new PostgresAdapter();
  } else {
    dbInstance = new SQLiteAdapter();
  }

  // Initialize the chosen adapter
  await (dbInstance as any).init();
  return dbInstance;
}

export async function runInImmediateTransaction<T>(
  callback: (db: DbAdapter) => Promise<T>
): Promise<T> {
  const db = await getDb();
  
  if (process.env.DB_TYPE === 'postgres') {
    await db.exec('BEGIN;');
    try {
      const result = await callback(db);
      await db.exec('COMMIT;');
      return result;
    } catch (error) {
      await db.exec('ROLLBACK;');
      throw error;
    }
  } else {
    await db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      const result = await callback(db);
      await db.exec('COMMIT;');
      return result;
    } catch (error) {
      await db.exec('ROLLBACK;');
      throw error;
    }
  }
}
