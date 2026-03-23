import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt, hashPassword } from '@/lib/encryption';
import { CloudflareAPI } from '@/lib/cloudflare-api';

// GET - List all accounts
export async function GET() {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const accounts = await db.cloudflareAccount.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: {
            workers: true,
            d1Databases: true,
            kvNamespaces: true,
            r2Buckets: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      accounts: accounts.map(account => ({
        id: account.id,
        name: account.name,
        email: account.email,
        accountId: account.accountId,
        isActive: account.isActive,
        lastSync: account.lastSync,
        stats: account._count,
        createdAt: account.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Add a new account
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, email, accountId, apiToken } = body;

    // Validation
    if (!name || !accountId || !apiToken) {
      return NextResponse.json(
        { error: 'Name, Account ID, and API Token are required' },
        { status: 400 }
      );
    }

    // Check if account already exists for this user
    const existing = await db.cloudflareAccount.findFirst({
      where: {
        userId: user.id,
        accountId,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'This Cloudflare account is already added' },
        { status: 400 }
      );
    }

    // Verify API token
    const api = new CloudflareAPI(apiToken, accountId);
    const verification = await api.verifyToken();

    if (!verification.valid) {
      return NextResponse.json(
        { error: 'Invalid API token or insufficient permissions' },
        { status: 400 }
      );
    }

    // Encrypt the API token
    const encrypted = encrypt(apiToken);

    // Create account
    const account = await db.cloudflareAccount.create({
      data: {
        userId: user.id,
        name,
        email: email || null,
        accountId,
        apiTokenEncrypted: encrypted.ciphertext,
        encryptionIv: encrypted.iv,
      },
    });

    // Initial sync - fetch all resources
    try {
      const [workers, databases, namespaces, buckets] = await Promise.all([
        api.getWorkers().catch(() => []),
        api.getD1Databases().catch(() => []),
        api.getKVNamespaces().catch(() => []),
        api.getR2Buckets().catch(() => []),
      ]);

      // Store workers
      if (workers.length > 0) {
        await db.worker.createMany({
          data: workers.map(w => ({
            accountId: account.id,
            workerId: w.id,
            name: w.id,
            script: w.script,
          })),
          skipDuplicates: true,
        });
      }

      // Store D1 databases
      if (databases.length > 0) {
        await db.d1Database.createMany({
          data: databases.map(d => ({
            accountId: account.id,
            databaseId: d.uuid,
            name: d.name,
            version: d.version,
          })),
          skipDuplicates: true,
        });
      }

      // Store KV namespaces
      if (namespaces.length > 0) {
        await db.kVNamespace.createMany({
          data: namespaces.map(n => ({
            accountId: account.id,
            namespaceId: n.id,
            title: n.title,
          })),
          skipDuplicates: true,
        });
      }

      // Store R2 buckets
      if (buckets.length > 0) {
        await db.r2Bucket.createMany({
          data: buckets.map(b => ({
            accountId: account.id,
            bucketName: b.name,
            creationDate: new Date(b.creation_date),
          })),
          skipDuplicates: true,
        });
      }

      // Update last sync
      await db.cloudflareAccount.update({
        where: { id: account.id },
        data: { lastSync: new Date() },
      });
    } catch (syncError) {
      console.error('Initial sync error:', syncError);
      // Continue even if sync fails
    }

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        name: account.name,
        accountId: account.accountId,
      },
    });
  } catch (error) {
    console.error('Add account error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
