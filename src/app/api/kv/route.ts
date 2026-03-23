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

// GET - List all KV namespaces from all accounts
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
      include: { kvNamespaces: true },
    });

    // Build namespaces list with account info
    const namespaces = [];

    for (const account of accounts) {
      for (const ns of account.kvNamespaces) {
        namespaces.push({
          id: ns.id,
          namespaceId: ns.namespaceId,
          title: ns.title,
          createdAt: ns.createdAt,
          account: {
            id: account.id,
            name: account.name,
          },
        });
      }
    }

    return NextResponse.json({ success: true, namespaces });
  } catch (error) {
    console.error('Error fetching KV namespaces:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch KV namespaces' },
      { status: 500 }
    );
  }
}
