import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { queryD1Database, getD1DatabaseSchema } from '@/lib/cloudflare-api';
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

// GET - Get database schema
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Get database with account
    const database = await db.d1Database.findFirst({
      where: { id },
      include: {
        cfAccount: true,
      },
    });

    if (!database || !database.cfAccount) {
      return NextResponse.json(
        { success: false, error: 'Database not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (database.cfAccount.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get schema from Cloudflare
    const apiToken = decrypt(
      database.cfAccount.apiTokenEnc,
      database.cfAccount.apiTokenIv
    );

    const config = {
      accountId: database.cfAccount.accountId,
      apiToken,
    };

    const schema = await getD1DatabaseSchema(config, database.databaseId);

    return NextResponse.json({
      success: true,
      database: {
        id: database.id,
        name: database.name,
        databaseId: database.databaseId,
        account: {
          id: database.cfAccount.id,
          name: database.cfAccount.name,
        },
      },
      schema,
    });
  } catch (error) {
    console.error('Error fetching database schema:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch schema' },
      { status: 500 }
    );
  }
}

// POST - Execute SQL query
const querySchema = z.object({
  sql: z.string().min(1, 'SQL query is required'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { sql } = querySchema.parse(body);

    // Get database with account
    const database = await db.d1Database.findFirst({
      where: { id },
      include: { cfAccount: true },
    });

    if (!database || !database.cfAccount) {
      return NextResponse.json(
        { success: false, error: 'Database not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (database.cfAccount.userId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Execute query
    const apiToken = decrypt(
      database.cfAccount.apiTokenEnc,
      database.cfAccount.apiTokenIv
    );

    const config = {
      accountId: database.cfAccount.accountId,
      apiToken,
    };

    const result = await queryD1Database(config, database.databaseId, sql);

    return NextResponse.json({
      success: true,
      results: result.results,
      meta: result.meta,
    });
  } catch (error) {
    console.error('Error executing query:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.errors[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to execute query' },
      { status: 500 }
    );
  }
}
