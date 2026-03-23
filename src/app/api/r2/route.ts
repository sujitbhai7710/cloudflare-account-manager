import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';

// GET - Get all R2 buckets from all accounts
export async function GET() {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all R2 buckets with account info
    const accounts = await db.cloudflareAccount.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      include: {
        r2Buckets: true,
      },
    });

    // Flatten buckets with account name
    const buckets = accounts.flatMap(account =>
      account.r2Buckets.map(bucket => ({
        id: bucket.id,
        bucketName: bucket.bucketName,
        creationDate: bucket.creationDate,
        accountId: account.id,
        accountName: account.name,
        createdAt: bucket.createdAt,
        updatedAt: bucket.updatedAt,
      }))
    );

    return NextResponse.json({ buckets });
  } catch (error) {
    console.error('Get R2 buckets error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
