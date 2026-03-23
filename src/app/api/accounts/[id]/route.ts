import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { verifyAccount, listWorkers, listD1Databases, listKVNamespaces, listR2Buckets } from '@/lib/cloudflare-api';

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

// GET - Get single account with details
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

    const account = await db.cloudflareAccount.findFirst({
      where: { id, userId: user.id },
      include: {
        workers: true,
        databases: true,
        kvNamespaces: true,
        r2Buckets: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        name: account.name,
        email: account.email,
        accountId: account.accountId,
        isActive: account.isActive,
        lastSync: account.lastSync,
        createdAt: account.createdAt,
        workers: account.workers,
        databases: account.databases,
        kvNamespaces: account.kvNamespaces,
        r2Buckets: account.r2Buckets,
      },
    });
  } catch (error) {
    console.error('Error fetching account:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch account' },
      { status: 500 }
    );
  }
}

// DELETE - Delete account
export async function DELETE(
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

    // Verify ownership
    const account = await db.cloudflareAccount.findFirst({
      where: { id, userId: user.id },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    // Delete account (cascades to related data)
    await db.cloudflareAccount.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}

// PUT - Update account
export async function PUT(
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
    const { name, email, isActive } = body;

    // Verify ownership
    const account = await db.cloudflareAccount.findFirst({
      where: { id, userId: user.id },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    const updated = await db.cloudflareAccount.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email !== undefined && { email }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ success: true, account: updated });
  } catch (error) {
    console.error('Error updating account:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update account' },
      { status: 500 }
    );
  }
}
