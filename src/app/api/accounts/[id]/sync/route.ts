import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { CloudflareAPI } from '@/lib/cloudflare-api';

// POST - Sync account resources
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Get account
    const account = await db.cloudflareAccount.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Decrypt API token
    const apiToken = decrypt({
      ciphertext: account.apiTokenEncrypted,
      iv: account.encryptionIv,
    });

    const api = new CloudflareAPI(apiToken, account.accountId);

    // Fetch all resources
    const [workers, databases, namespaces, buckets] = await Promise.all([
      api.getWorkers().catch(() => []),
      api.getD1Databases().catch(() => []),
      api.getKVNamespaces().catch(() => []),
      api.getR2Buckets().catch(() => []),
    ]);

    // Clear existing resources and insert new ones
    await db.$transaction([
      // Delete existing
      db.worker.deleteMany({ where: { accountId: account.id } }),
      db.d1Database.deleteMany({ where: { accountId: account.id } }),
      db.kVNamespace.deleteMany({ where: { accountId: account.id } }),
      db.r2Bucket.deleteMany({ where: { accountId: account.id } }),
    ]);

    // Insert workers
    if (workers.length > 0) {
      await db.worker.createMany({
        data: workers.map(w => ({
          accountId: account.id,
          workerId: w.id,
          name: w.id,
          script: w.script,
        })),
      });
    }

    // Insert D1 databases
    if (databases.length > 0) {
      await db.d1Database.createMany({
        data: databases.map(d => ({
          accountId: account.id,
          databaseId: d.uuid,
          name: d.name,
          version: d.version,
        })),
      });
    }

    // Insert KV namespaces
    if (namespaces.length > 0) {
      await db.kVNamespace.createMany({
        data: namespaces.map(n => ({
          accountId: account.id,
          namespaceId: n.id,
          title: n.title,
        })),
      });
    }

    // Insert R2 buckets
    if (buckets.length > 0) {
      await db.r2Bucket.createMany({
        data: buckets.map(b => ({
          accountId: account.id,
          bucketName: b.name,
          creationDate: new Date(b.creation_date),
        })),
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
        namespaces: namespaces.length,
        buckets: buckets.length,
      },
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync account' },
      { status: 500 }
    );
  }
}
