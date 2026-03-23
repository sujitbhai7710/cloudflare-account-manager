import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encrypt, decrypt } from '@/lib/encryption';
import { verifyAccount, listWorkers, listD1Databases, listKVNamespaces, listR2Buckets } from '@/lib/cloudflare-api';
import { z } from 'zod';

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

// GET - List all accounts for current user
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const accounts = await db.cloudflareAccount.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: {
            workers: true,
            databases: true,
            kvNamespaces: true,
            r2Buckets: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Don't return sensitive data
    const safeAccounts = accounts.map((account) => ({
      id: account.id,
      name: account.name,
      email: account.email,
      accountId: account.accountId,
      isActive: account.isActive,
      lastSync: account.lastSync,
      createdAt: account.createdAt,
      stats: {
        workers: account._count.workers,
        databases: account._count.databases,
        kvNamespaces: account._count.kvNamespaces,
        r2Buckets: account._count.r2Buckets,
      },
    }));

    return NextResponse.json({ success: true, accounts: safeAccounts });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}

// POST - Add new account
const addAccountSchema = z.object({
  name: z.string().min(1, 'Account name is required'),
  email: z.string().email().optional().or(z.literal('')),
  accountId: z.string().min(1, 'Account ID is required'),
  apiToken: z.string().min(1, 'API Token is required'),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, email, accountId, apiToken } = addAccountSchema.parse(body);

    // Verify API token works
    try {
      await verifyAccount({ accountId, apiToken });
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid API token or Account ID' },
        { status: 400 }
      );
    }

    // Encrypt API token
    const { encrypted: apiTokenEnc, iv: apiTokenIv } = encrypt(apiToken);

    // Create account
    const account = await db.cloudflareAccount.create({
      data: {
        userId: user.id,
        name,
        email: email || null,
        accountId,
        apiTokenEnc,
        apiTokenIv,
      },
    });

    // Sync resources in background
    const config = { accountId, apiToken };
    
    try {
      const [workers, databases, kvNamespaces, r2Buckets] = await Promise.all([
        listWorkers(config),
        listD1Databases(config),
        listKVNamespaces(config),
        listR2Buckets(config),
      ]);

      // Store workers
      for (const worker of workers) {
        await db.worker.upsert({
          where: {
            cfAccountId_workerId: {
              cfAccountId: account.id,
              workerId: worker.id,
            },
          },
          update: { name: worker.name },
          create: {
            cfAccountId: account.id,
            workerId: worker.id,
            name: worker.name,
            compatibilityDate: worker.compatibility_date,
          },
        });
      }

      // Store databases
      for (const dbase of databases) {
        await db.d1Database.upsert({
          where: {
            cfAccountId_databaseId: {
              cfAccountId: account.id,
              databaseId: dbase.uuid,
            },
          },
          update: { name: dbase.name, version: dbase.version },
          create: {
            cfAccountId: account.id,
            databaseId: dbase.uuid,
            name: dbase.name,
            version: dbase.version,
          },
        });
      }

      // Store KV namespaces
      for (const kv of kvNamespaces) {
        await db.kVNamespace.upsert({
          where: {
            cfAccountId_namespaceId: {
              cfAccountId: account.id,
              namespaceId: kv.id,
            },
          },
          update: { title: kv.title },
          create: {
            cfAccountId: account.id,
            namespaceId: kv.id,
            title: kv.title,
          },
        });
      }

      // Store R2 buckets
      for (const bucket of r2Buckets) {
        await db.r2Bucket.upsert({
          where: {
            cfAccountId_bucketName: {
              cfAccountId: account.id,
              bucketName: bucket.name,
            },
          },
          update: {
            creationDate: bucket.creation_date ? new Date(bucket.creation_date) : null,
          },
          create: {
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
    } catch (syncError) {
      console.error('Sync error:', syncError);
      // Continue even if sync fails
    }

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        name: account.name,
        email: account.email,
        accountId: account.accountId,
        isActive: account.isActive,
      },
    });
  } catch (error) {
    console.error('Error adding account:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to add account' },
      { status: 500 }
    );
  }
}
