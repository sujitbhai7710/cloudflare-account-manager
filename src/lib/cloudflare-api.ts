// Cloudflare API client

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

interface CFConfig {
  accountId: string;
  apiToken: string;
}

interface CFResponse<T> {
  success: boolean;
  result: T;
  errors: string[];
  messages: string[];
}

async function cfFetch<T>(
  endpoint: string,
  config: CFConfig,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${CF_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = (await response.json()) as CFResponse<T>;

  if (!data.success) {
    throw new Error(data.errors?.join(', ') || 'Cloudflare API error');
  }

  return data.result;
}

// Verify account credentials
export async function verifyAccount(config: CFConfig): Promise<{ id: string; name: string }> {
  return cfFetch<{ id: string; name: string }>(`/accounts/${config.accountId}`, config);
}

// Workers
export async function listWorkers(config: CFConfig): Promise<{
  id: string;
  name: string;
  created_on?: string;
  modified_on?: string;
  compatibility_date?: string;
}[]> {
  try {
    const result = await cfFetch<{
      scripts: {
        id: string;
        name: string;
        created_on?: string;
        modified_on?: string;
        compatibility_date?: string;
      }[];
    }>(`/accounts/${config.accountId}/workers/scripts`, config);
    return result.scripts || [];
  } catch {
    return [];
  }
}

export async function getWorkerDetails(
  config: CFConfig,
  workerName: string
): Promise<{
  id: string;
  name: string;
  script?: string;
  compatibility_date?: string;
}> {
  return cfFetch(`/accounts/${config.accountId}/workers/scripts/${workerName}`, config);
}

export async function listWorkerRoutes(config: CFConfig): Promise<{
  id: string;
  pattern: string;
  script: string;
}[]> {
  try {
    const result = await cfFetch<{
      routes: { id: string; pattern: string; script: string }[];
    }>(`/accounts/${config.accountId}/workers/routes`, config);
    return result.routes || [];
  } catch {
    return [];
  }
}

// D1 Databases
export async function listD1Databases(config: CFConfig): Promise<{
  uuid: string;
  name: string;
  version?: string;
  created_at?: string;
}[]> {
  try {
    const result = await cfFetch<{
      databases: {
        uuid: string;
        name: string;
        version?: string;
        created_at?: string;
      }[];
    }>(`/accounts/${config.accountId}/d1/database`, config);
    return result.databases || [];
  } catch {
    return [];
  }
}

export async function queryD1Database(
  config: CFConfig,
  databaseUuid: string,
  sql: string
): Promise<{
  results: Record<string, unknown>[];
  meta: { changed_db: boolean; changes: number; duration: number };
}> {
  const result = await cfFetch<{
    results: Record<string, unknown>[];
    meta: { changed_db: boolean; changes: number; duration: number };
  }[]>(
    `/accounts/${config.accountId}/d1/database/${databaseUuid}/query`,
    config,
    {
      method: 'POST',
      body: JSON.stringify({ sql }),
    }
  );
  return result[0] || { results: [], meta: { changed_db: false, changes: 0, duration: 0 } };
}

export async function getD1DatabaseSchema(
  config: CFConfig,
  databaseUuid: string
): Promise<{ name: string; type: string; columns: { name: string; type: string }[] }[]> {
  try {
    // Get tables
    const tablesResult = await queryD1Database(
      config,
      databaseUuid,
      "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );

    const tables = tablesResult.results as { name: string; type: string }[];
    const schema: { name: string; type: string; columns: { name: string; type: string }[] }[] = [];

    for (const table of tables) {
      try {
        const columnsResult = await queryD1Database(
          config,
          databaseUuid,
          `PRAGMA table_info(${table.name})`
        );

        schema.push({
          name: table.name,
          type: table.type,
          columns: (columnsResult.results as { name: string; type: string }[]).map((col) => ({
            name: col.name,
            type: col.type,
          })),
        });
      } catch {
        // Skip if can't get columns
      }
    }

    return schema;
  } catch {
    return [];
  }
}

// KV Namespaces
export async function listKVNamespaces(config: CFConfig): Promise<{
  id: string;
  title: string;
  supports_url_encoding?: boolean;
}[]> {
  try {
    const result = await cfFetch<{
      namespaces: { id: string; title: string; supports_url_encoding?: boolean }[];
    }>(`/accounts/${config.accountId}/storage/kv/namespaces`, config);
    return result.namespaces || [];
  } catch {
    return [];
  }
}

export async function listKVKeys(
  config: CFConfig,
  namespaceId: string
): Promise<{ name: string; expiration?: number }[]> {
  try {
    const result = await cfFetch<{ keys: { name: string; expiration?: number }[] }>(
      `/accounts/${config.accountId}/storage/kv/namespaces/${namespaceId}/keys`,
      config
    );
    return result.keys || [];
  } catch {
    return [];
  }
}

// R2 Buckets
export async function listR2Buckets(config: CFConfig): Promise<{
  name: string;
  creation_date?: string;
}[]> {
  try {
    const result = await cfFetch<{
      buckets: { name: string; creation_date?: string }[];
    }>(`/accounts/${config.accountId}/r2/buckets`, config);
    return result.buckets || [];
  } catch {
    return [];
  }
}

export async function listR2Objects(
  config: CFConfig,
  bucketName: string
): Promise<{ key: string; size?: number; lastModified?: string }[]> {
  try {
    const result = await cfFetch<{
      objects: { key: string; size?: number; lastModified?: string }[];
    }>(
      `/accounts/${config.accountId}/r2/buckets/${bucketName}/objects`,
      config
    );
    return result.objects || [];
  } catch {
    return [];
  }
}

// Get config from encrypted account
export function getCFConfig(
  account: { accountId: string; apiTokenEnc: string; apiTokenIv: string },
  decryptFn: (encrypted: string, iv: string) => string
): CFConfig {
  return {
    accountId: account.accountId,
    apiToken: decryptFn(account.apiTokenEnc, account.apiTokenIv),
  };
}
