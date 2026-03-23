import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';

// GET - Get single account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const account = await db.cloudflareAccount.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        workers: true,
        d1Databases: true,
        kvNamespaces: true,
        r2Buckets: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      account: {
        id: account.id,
        name: account.name,
        email: account.email,
        accountId: account.accountId,
        isActive: account.isActive,
        lastSync: account.lastSync,
        workers: account.workers,
        d1Databases: account.d1Databases,
        kvNamespaces: account.kvNamespaces,
        r2Buckets: account.r2Buckets,
      },
    });
  } catch (error) {
    console.error('Get account error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete an account
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify ownership
    const account = await db.cloudflareAccount.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Delete account (cascade will delete all related resources)
    await db.cloudflareAccount.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update an account
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { name, isActive } = body;

    // Verify ownership
    const account = await db.cloudflareAccount.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Update account
    const updated = await db.cloudflareAccount.update({
      where: { id },
      data: {
        name: name || account.name,
        isActive: isActive !== undefined ? isActive : account.isActive,
      },
    });

    return NextResponse.json({
      success: true,
      account: {
        id: updated.id,
        name: updated.name,
        isActive: updated.isActive,
      },
    });
  } catch (error) {
    console.error('Update account error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
