/**
 * Database utilities for Cloudflare D1
 * This replaces Prisma for Cloudflare deployment
 */

// For local development, we'll use Prisma
// For Cloudflare deployment, we'll use D1 bindings

export interface Env {
  DB: D1Database;
}

// User type
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

// Session type
export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

// Cloudflare Account type
export interface CloudflareAccount {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  accountId: string;
  apiTokenEncrypted: string;
  encryptionIv: string;
  isActive: boolean;
  lastSync: string | null;
  createdAt: string;
  updatedAt: string;
}

// Worker type
export interface Worker {
  id: string;
  accountId: string;
  workerId: string;
  name: string;
  script: string | null;
  compatibilityDate: string | null;
  createdAt: string;
  updatedAt: string;
}

// D1 Database type
export interface D1Db {
  id: string;
  accountId: string;
  databaseId: string;
  name: string;
  version: string | null;
  createdAt: string;
  updatedAt: string;
}

// KV Namespace type
export interface KVNamespaceDb {
  id: string;
  accountId: string;
  namespaceId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// R2 Bucket type
export interface R2BucketDb {
  id: string;
  accountId: string;
  bucketName: string;
  creationDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * D1 Database client for Cloudflare Workers
 */
export class D1Client {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  // Initialize database schema
  async initSchema(): Promise<void> {
    await this.db.batch([
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          passwordHash TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `),
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          token TEXT UNIQUE NOT NULL,
          expiresAt DATETIME NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        )
      `),
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS cloudflare_accounts (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          name TEXT NOT NULL,
          email TEXT,
          accountId TEXT NOT NULL,
          apiTokenEncrypted TEXT NOT NULL,
          encryptionIv TEXT NOT NULL,
          isActive BOOLEAN DEFAULT TRUE,
          lastSync DATETIME,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        )
      `),
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS workers (
          id TEXT PRIMARY KEY,
          accountId TEXT NOT NULL,
          workerId TEXT NOT NULL,
          name TEXT NOT NULL,
          script TEXT,
          compatibilityDate TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (accountId) REFERENCES cloudflare_accounts(id) ON DELETE CASCADE,
          UNIQUE(accountId, workerId)
        )
      `),
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS d1_databases (
          id TEXT PRIMARY KEY,
          accountId TEXT NOT NULL,
          databaseId TEXT NOT NULL,
          name TEXT NOT NULL,
          version TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (accountId) REFERENCES cloudflare_accounts(id) ON DELETE CASCADE,
          UNIQUE(accountId, databaseId)
        )
      `),
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS kv_namespaces (
          id TEXT PRIMARY KEY,
          accountId TEXT NOT NULL,
          namespaceId TEXT NOT NULL,
          title TEXT NOT NULL,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (accountId) REFERENCES cloudflare_accounts(id) ON DELETE CASCADE,
          UNIQUE(accountId, namespaceId)
        )
      `),
      this.db.prepare(`
        CREATE TABLE IF NOT EXISTS r2_buckets (
          id TEXT PRIMARY KEY,
          accountId TEXT NOT NULL,
          bucketName TEXT NOT NULL,
          creationDate DATETIME,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (accountId) REFERENCES cloudflare_accounts(id) ON DELETE CASCADE,
          UNIQUE(accountId, bucketName)
        )
      `),
      // Create indexes
      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(userId)`),
      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`),
      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_accounts_user ON cloudflare_accounts(userId)`),
      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_workers_account ON workers(accountId)`),
      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_d1_account ON d1_databases(accountId)`),
      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_kv_account ON kv_namespaces(accountId)`),
      this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_r2_account ON r2_buckets(accountId)`),
    ]);
  }

  // User operations
  async createUser(id: string, email: string, passwordHash: string): Promise<User> {
    const result = await this.db.prepare(`
      INSERT INTO users (id, email, passwordHash) VALUES (?, ?, ?)
      RETURNING *
    `).bind(id, email, passwordHash).first<User>();
    return result!;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await this.db.prepare(`SELECT * FROM users WHERE email = ?`).bind(email).first<User>();
  }

  async getUserById(id: string): Promise<User | null> {
    return await this.db.prepare(`SELECT * FROM users WHERE id = ?`).bind(id).first<User>();
  }

  // Session operations
  async createSession(id: string, userId: string, token: string, expiresAt: string): Promise<Session> {
    const result = await this.db.prepare(`
      INSERT INTO sessions (id, userId, token, expiresAt) VALUES (?, ?, ?, ?)
      RETURNING *
    `).bind(id, userId, token, expiresAt).first<Session>();
    return result!;
  }

  async getSessionByToken(token: string): Promise<(Session & { user: User }) | null> {
    return await this.db.prepare(`
      SELECT s.*, u.id as userId, u.email, u.passwordHash, u.createdAt as userCreatedAt, u.updatedAt as userUpdatedAt
      FROM sessions s
      JOIN users u ON s.userId = u.id
      WHERE s.token = ?
    `).bind(token).first();
  }

  async deleteSession(token: string): Promise<void> {
    await this.db.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
  }

  // Cloudflare Account operations
  async createAccount(data: {
    id: string;
    userId: string;
    name: string;
    email: string | null;
    accountId: string;
    apiTokenEncrypted: string;
    encryptionIv: string;
  }): Promise<CloudflareAccount> {
    const result = await this.db.prepare(`
      INSERT INTO cloudflare_accounts (id, userId, name, email, accountId, apiTokenEncrypted, encryptionIv)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      data.id, data.userId, data.name, data.email, data.accountId, data.apiTokenEncrypted, data.encryptionIv
    ).first<CloudflareAccount>();
    return result!;
  }

  async getAccountsByUserId(userId: string): Promise<CloudflareAccount[]> {
    const result = await this.db.prepare(`
      SELECT * FROM cloudflare_accounts WHERE userId = ? ORDER BY createdAt DESC
    `).bind(userId).all<CloudflareAccount>();
    return result.results;
  }

  async getAccountById(id: string): Promise<CloudflareAccount | null> {
    return await this.db.prepare(`SELECT * FROM cloudflare_accounts WHERE id = ?`).bind(id).first<CloudflareAccount>();
  }

  async updateAccountLastSync(id: string): Promise<void> {
    await this.db.prepare(`UPDATE cloudflare_accounts SET lastSync = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run();
  }

  async deleteAccount(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM cloudflare_accounts WHERE id = ?`).bind(id).run();
  }

  // Worker operations
  async createWorkers(workers: Array<{
    id: string;
    accountId: string;
    workerId: string;
    name: string;
    script: string | null;
  }>): Promise<void> {
    const statements = workers.map(w => 
      this.db.prepare(`
        INSERT OR REPLACE INTO workers (id, accountId, workerId, name, script)
        VALUES (?, ?, ?, ?, ?)
      `).bind(w.id, w.accountId, w.workerId, w.name, w.script)
    );
    if (statements.length > 0) {
      await this.db.batch(statements);
    }
  }

  async getWorkersByAccountId(accountId: string): Promise<Worker[]> {
    const result = await this.db.prepare(`
      SELECT * FROM workers WHERE accountId = ?
    `).bind(accountId).all<Worker>();
    return result.results;
  }

  async deleteWorkersByAccountId(accountId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM workers WHERE accountId = ?`).bind(accountId).run();
  }

  // D1 Database operations
  async createD1Databases(databases: Array<{
    id: string;
    accountId: string;
    databaseId: string;
    name: string;
    version: string | null;
  }>): Promise<void> {
    const statements = databases.map(d => 
      this.db.prepare(`
        INSERT OR REPLACE INTO d1_databases (id, accountId, databaseId, name, version)
        VALUES (?, ?, ?, ?, ?)
      `).bind(d.id, d.accountId, d.databaseId, d.name, d.version)
    );
    if (statements.length > 0) {
      await this.db.batch(statements);
    }
  }

  async deleteD1DatabasesByAccountId(accountId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM d1_databases WHERE accountId = ?`).bind(accountId).run();
  }

  // KV Namespace operations
  async createKVNamespaces(namespaces: Array<{
    id: string;
    accountId: string;
    namespaceId: string;
    title: string;
  }>): Promise<void> {
    const statements = namespaces.map(n => 
      this.db.prepare(`
        INSERT OR REPLACE INTO kv_namespaces (id, accountId, namespaceId, title)
        VALUES (?, ?, ?, ?)
      `).bind(n.id, n.accountId, n.namespaceId, n.title)
    );
    if (statements.length > 0) {
      await this.db.batch(statements);
    }
  }

  async deleteKVNamespacesByAccountId(accountId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM kv_namespaces WHERE accountId = ?`).bind(accountId).run();
  }

  // R2 Bucket operations
  async createR2Buckets(buckets: Array<{
    id: string;
    accountId: string;
    bucketName: string;
    creationDate: string | null;
  }>): Promise<void> {
    const statements = buckets.map(b => 
      this.db.prepare(`
        INSERT OR REPLACE INTO r2_buckets (id, accountId, bucketName, creationDate)
        VALUES (?, ?, ?, ?)
      `).bind(b.id, b.accountId, b.bucketName, b.creationDate)
    );
    if (statements.length > 0) {
      await this.db.batch(statements);
    }
  }

  async deleteR2BucketsByAccountId(accountId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM r2_buckets WHERE accountId = ?`).bind(accountId).run();
  }

  // Count operations for stats
  async countWorkersByAccountId(accountId: string): Promise<number> {
    const result = await this.db.prepare(`SELECT COUNT(*) as count FROM workers WHERE accountId = ?`).bind(accountId).first<{ count: number }>();
    return result?.count || 0;
  }

  async countD1DatabasesByAccountId(accountId: string): Promise<number> {
    const result = await this.db.prepare(`SELECT COUNT(*) as count FROM d1_databases WHERE accountId = ?`).bind(accountId).first<{ count: number }>();
    return result?.count || 0;
  }

  async countKVNamespacesByAccountId(accountId: string): Promise<number> {
    const result = await this.db.prepare(`SELECT COUNT(*) as count FROM kv_namespaces WHERE accountId = ?`).bind(accountId).first<{ count: number }>();
    return result?.count || 0;
  }

  async countR2BucketsByAccountId(accountId: string): Promise<number> {
    const result = await this.db.prepare(`SELECT COUNT(*) as count FROM r2_buckets WHERE accountId = ?`).bind(accountId).first<{ count: number }>();
    return result?.count || 0;
  }
}
