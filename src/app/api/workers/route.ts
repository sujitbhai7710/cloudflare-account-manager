import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';

// GET - Get all workers from all accounts
export async function GET() {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all workers with account info
    const accounts = await db.cloudflareAccount.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      include: {
        workers: true,
      },
    });

    // Flatten workers with account name
    const workers = accounts.flatMap(account =>
      account.workers.map(worker => ({
        id: worker.id,
        workerId: worker.workerId,
        name: worker.name,
        script: worker.script,
        compatibilityDate: worker.compatibilityDate,
        accountId: account.id,
        accountName: account.name,
        createdAt: worker.createdAt,
        updatedAt: worker.updatedAt,
      }))
    );

    return NextResponse.json({ workers });
  } catch (error) {
    console.error('Get workers error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
