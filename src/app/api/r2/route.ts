import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

// GET - List all R2 buckets from all accounts
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get all accounts for user
    const accounts = await db.cloudflareAccount.findMany({
      where: { userId: user.id, isActive: true },
      include: { r2Buckets: true },
    });

    // Build buckets list with account info
    const buckets = [];

    for (const account of accounts) {
      for (const bucket of account.r2Buckets) {
        buckets.push({
          id: bucket.id,
          bucketName: bucket.bucketName,
          creationDate: bucket.creationDate,
          createdAt: bucket.createdAt,
          account: {
            id: account.id,
            name: account.name,
          },
        });
      }
    }

    return NextResponse.json({ success: true, buckets });
  } catch (error) {
    console.error('Error fetching R2 buckets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch R2 buckets' },
      { status: 500 }
    );
  }
}
