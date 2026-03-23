import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';

// GET - Get all KV namespaces from all accounts
export async function GET() {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all KV namespaces with account info
    const accounts = await db.cloudflareAccount.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      include: {
        kvNamespaces: true,
      },
    });

    // Flatten namespaces with account name
    const namespaces = accounts.flatMap(account =>
      account.kvNamespaces.map(ns => ({
        id: ns.id,
        namespaceId: ns.namespaceId,
        title: ns.title,
        accountId: account.id,
        accountName: account.name,
        createdAt: ns.createdAt,
        updatedAt: ns.updatedAt,
      }))
    );

    return NextResponse.json({ namespaces });
  } catch (error) {
    console.error('Get KV namespaces error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
