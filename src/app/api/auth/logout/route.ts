import { NextResponse } from 'next/server';
import { getSessionUser, clearSessionCookie, deleteSession } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const user = await getSessionUser();
    
    if (user) {
      const cookieStore = await cookies();
      const token = cookieStore.get('session_token')?.value;
      if (token) {
        await deleteSession(token);
      }
    }
    
    await clearSessionCookie();
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
