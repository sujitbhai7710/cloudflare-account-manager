import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { listWorkers, listD1Databases, listKVNamespaces, listR2Buckets } from '@/lib/cloudflare-api';

// Get current user from session
async function getCurrentUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session.user;
}

// POST - Sync account resources
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Get account with encrypted token
    const account = await db.cloudflareAccount.findFirst({
      where: { id, userId: user.id },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    // Decrypt API token
    const apiToken = decrypt(account.apiTokenEnc, account.apiTokenIv);
    const config = { accountId: account.accountId, apiToken };

    // Fetch all resources
    const [workers, databases, kvNamespaces, r2Buckets] = await Promise.all([
      listWorkers(config),
      listD1Databases(config),
      listKVNamespaces(config),
      listR2Buckets(config),
    ]);

    // Clear old data and insert new
    await db.$transaction([
      db.worker.deleteMany({ where: { cfAccountId: account.id } }),
      db.d1Database.deleteMany({ where: { cfAccountId: account.id } }),
      db.kVNamespace.deleteMany({ where: { cfAccountId: account.id } }),
      db.r2Bucket.deleteMany({ where: { cfAccountId: account.id } }),
    ]);

    // Store workers
    for (const worker of workers) {
      await db.worker.create({
        data: {
          cfAccountId: account.id,
          workerId: worker.id,
          name: worker.name,
          compatibilityDate: worker.compatibility_date,
        },
      });
    }

    // Store databases
    for (const dbase of databases) {
      await db.d1Database.create({
        data: {
          cfAccountId: account.id,
          databaseId: dbase.uuid,
          name: dbase.name,
          version: dbase.version,
        },
      });
    }

    // Store KV namespaces
    for (const kv of kvNamespaces) {
      await db.kVNamespace.create({
        data: {
          cfAccountId: account.id,
          namespaceId: kv.id,
          title: kv.title,
        },
      });
    }

    // Store R2 buckets
    for (const bucket of r2Buckets) {
      await db.r2Bucket.create({
        data: {
          cfAccountId: account.id,
          bucketName: bucket.name,
          creationDate: bucket.creation_date ? new Date(bucket.creation_date) : null,
        },
      });
    }

    // Update last sync
    await db.cloudflareAccount.update({
      where: { id: account.id },
      data: { lastSync: new Date() },
    });

    return NextResponse.json({
      success: true,
      stats: {
        workers: workers.length,
        databases: databases.length,
        kvNamespaces: kvNamespaces.length,
        r2Buckets: r2Buckets.length,
      },
    });
  } catch (error) {
    console.error('Error syncing account:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync account' },
      { status: 500 }
    );
  }
}
