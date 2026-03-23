import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { getCFConfig, listWorkers, listWorkerRoutes, getWorkerDetails } from '@/lib/cloudflare-api';

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

// GET - List all workers from all accounts
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
      include: { workers: true },
    });

    // Build workers list with account info
    const workers = [];

    for (const account of accounts) {
      for (const worker of account.workers) {
        workers.push({
          id: worker.id,
          workerId: worker.workerId,
          name: worker.name,
          compatibilityDate: worker.compatibilityDate,
          createdAt: worker.createdAt,
          account: {
            id: account.id,
            name: account.name,
          },
        });
      }
    }

    return NextResponse.json({ success: true, workers });
  } catch (error) {
    console.error('Error fetching workers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch workers' },
      { status: 500 }
    );
  }
}
