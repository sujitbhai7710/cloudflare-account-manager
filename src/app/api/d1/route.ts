import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { getCFConfig, queryD1Database, getD1DatabaseSchema } from '@/lib/cloudflare-api';
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

// GET - List all D1 databases from all accounts
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
      include: { databases: true },
    });

    // Build databases list with account info
    const databases = [];

    for (const account of accounts) {
      for (const dbase of account.databases) {
        databases.push({
          id: dbase.id,
          databaseId: dbase.databaseId,
          name: dbase.name,
          version: dbase.version,
          createdAt: dbase.createdAt,
          account: {
            id: account.id,
            name: account.name,
          },
        });
      }
    }

    return NextResponse.json({ success: true, databases });
  } catch (error) {
    console.error('Error fetching databases:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch databases' },
      { status: 500 }
    );
  }
}
