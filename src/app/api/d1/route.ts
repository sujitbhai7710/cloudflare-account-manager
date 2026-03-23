import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';

// GET - Get all D1 databases from all accounts
export async function GET() {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all D1 databases with account info
    const accounts = await db.cloudflareAccount.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      include: {
        d1Databases: true,
      },
    });

    // Flatten databases with account name
    const databases = accounts.flatMap(account =>
      account.d1Databases.map(db => ({
        id: db.id,
        databaseId: db.databaseId,
        name: db.name,
        version: db.version,
        accountId: account.id,
        accountName: account.name,
        createdAt: db.createdAt,
        updatedAt: db.updatedAt,
      }))
    );

    return NextResponse.json({ databases });
  } catch (error) {
    console.error('Get D1 databases error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
