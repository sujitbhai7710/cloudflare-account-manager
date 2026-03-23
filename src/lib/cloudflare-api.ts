/**
 * Cloudflare API Client
 * Handles all interactions with Cloudflare API
 */

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

interface CloudflareResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
  result: T;
}

interface WorkerScript {
  id: string;
  script?: string;
  modified_on?: string;
  created_on?: string;
  etag?: string;
}

interface WorkerSettings {
  compatibility_date?: string;
  compatibility_flags?: string[];
  [key: string]: unknown;
}

interface D1Database {
  uuid: string;
  name: string;
  version: string;
  created_at: string;
}

interface KVNamespace {
  id: string;
  title: string;
  supports_url_encoding?: boolean;
}

interface R2Bucket {
  name: string;
  creation_date: string;
}

interface AccountInfo {
  id: string;
  name: string;
  type: string;
  settings?: Record<string, unknown>;
}

interface WorkerRoute {
  id: string;
  pattern: string;
  script: string;
}

export class CloudflareAPI {
  private apiToken: string;
  private accountId: string;

  constructor(apiToken: string, accountId: string) {
    this.apiToken = apiToken;
    this.accountId = accountId;
  }

  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${CLOUDFLARE_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json() as CloudflareResponse<T>;

    if (!data.success) {
      throw new Error(data.errors?.[0]?.message || 'Cloudflare API error');
    }

    return data.result;
  }

  /**
   * Verify the API token is valid and has required permissions
   */
  async verifyToken(): Promise<{ valid: boolean; accountId?: string; accountName?: string }> {
    try {
      // Try to verify token
      const response = await fetch(`${CLOUDFLARE_API_BASE}/user/tokens/verify`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
        },
      });
      
      const data = await response.json() as CloudflareResponse<{ id: string; status: string }>;
      
      if (!data.success) {
        return { valid: false };
      }

      // Try to get account info
      try {
        const account = await this.getAccount();
        return { valid: true, accountId: account.id, accountName: account.name };
      } catch {
        return { valid: true };
      }
    } catch {
      return { valid: false };
    }
  }

  /**
   * Get account information
   */
  async getAccount(): Promise<AccountInfo> {
    return this.fetch<AccountInfo>(`/accounts/${this.accountId}`);
  }

  /**
   * Get all workers scripts
   */
  async getWorkers(): Promise<WorkerScript[]> {
    return this.fetch<WorkerScript[]>(`/accounts/${this.accountId}/workers/scripts`);
  }

  /**
   * Get a specific worker script
   */
  async getWorker(scriptName: string): Promise<WorkerScript> {
    return this.fetch<WorkerScript>(`/accounts/${this.accountId}/workers/scripts/${scriptName}`);
  }

  /**
   * Get worker settings
   */
  async getWorkerSettings(scriptName: string): Promise<WorkerSettings> {
    return this.fetch<WorkerSettings>(`/accounts/${this.accountId}/workers/scripts/${scriptName}/settings`);
  }

  /**
   * Get worker routes
   */
  async getWorkerRoutes(): Promise<WorkerRoute[]> {
    // First get zones for the account
    const zones = await this.fetch<Array<{ id: string; name: string }>>(`/zones?account.id=${this.accountId}`);
    const routes: WorkerRoute[] = [];
    
    for (const zone of zones) {
      try {
        const zoneRoutes = await this.fetch<WorkerRoute[]>(`/zones/${zone.id}/workers/routes`);
        routes.push(...zoneRoutes);
      } catch {
        // Continue even if routes fail for a zone
      }
    }
    
    return routes;
  }

  /**
   * Get all D1 databases
   */
  async getD1Databases(): Promise<D1Database[]> {
    return this.fetch<D1Database[]>(`/accounts/${this.accountId}/d1/database`);
  }

  /**
   * Query a D1 database
   */
  async queryD1Database(databaseId: string, sql: string): Promise<{ results: Record<string, unknown>[] }> {
    return this.fetch<{ results: Record<string, unknown>[] }>(
      `/accounts/${this.accountId}/d1/database/${databaseId}/query`,
      {
        method: 'POST',
        body: JSON.stringify({ sql }),
      }
    );
  }

  /**
   * Get D1 database schema
   */
  async getD1Schema(databaseId: string): Promise<{ results: Array<{ name: string; sql: string }> }> {
    const sql = "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name";
    return this.queryD1Database(databaseId, sql) as Promise<{ results: Array<{ name: string; sql: string }> }>;
  }

  /**
   * Get all KV namespaces
   */
  async getKVNamespaces(): Promise<KVNamespace[]> {
    return this.fetch<KVNamespace[]>(`/accounts/${this.accountId}/storage/kv/namespaces`);
  }

  /**
   * Get KV keys in a namespace
   */
  async getKVKeys(namespaceId: string, prefix?: string): Promise<Array<{ name: string; expiration?: number }>> {
    let url = `/accounts/${this.accountId}/storage/kv/namespaces/${namespaceId}/keys`;
    if (prefix) {
      url += `?prefix=${encodeURIComponent(prefix)}`;
    }
    return this.fetch<Array<{ name: string; expiration?: number }>>(url);
  }

  /**
   * Get all R2 buckets
   */
  async getR2Buckets(): Promise<R2Bucket[]> {
    return this.fetch<R2Bucket[]>(`/accounts/${this.accountId}/r2/buckets`);
  }

  /**
   * Get objects in an R2 bucket
   */
  async getR2Objects(bucketName: string, prefix?: string): Promise<{
    objects: Array<{ key: string; size: number; uploaded: string }>;
    truncated: boolean;
    cursor?: string;
  }> {
    let url = `/accounts/${this.accountId}/r2/buckets/${bucketName}/objects`;
    if (prefix) {
      url += `?prefix=${encodeURIComponent(prefix)}`;
    }
    return this.fetch<{
      objects: Array<{ key: string; size: number; uploaded: string }>;
      truncated: boolean;
      cursor?: string;
    }>(url);
  }
}

/**
 * Sync all resources from a Cloudflare account
 */
export async function syncAccountResources(
  apiToken: string,
  accountId: string
): Promise<{
  workers: number;
  databases: number;
  namespaces: number;
  buckets: number;
}> {
  const api = new CloudflareAPI(apiToken, accountId);
  
  const results = {
    workers: 0,
    databases: 0,
    namespaces: 0,
    buckets: 0,
  };

  try {
    // Fetch all resources in parallel
    const [workers, databases, namespaces, buckets] = await Promise.all([
      api.getWorkers().catch(() => [] as WorkerScript[]),
      api.getD1Databases().catch(() => [] as D1Database[]),
      api.getKVNamespaces().catch(() => [] as KVNamespace[]),
      api.getR2Buckets().catch(() => [] as R2Bucket[]),
    ]);

    results.workers = workers.length;
    results.databases = databases.length;
    results.namespaces = namespaces.length;
    results.buckets = buckets.length;

    return results;
  } catch (error) {
    console.error('Error syncing account resources:', error);
    return results;
  }
}
