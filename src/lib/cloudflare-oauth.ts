/**
 * Cloudflare OAuth 2.0 Integration
 * This allows users to connect their Cloudflare account with one click
 * 
 * To set this up:
 * 1. Go to https://dash.cloudflare.com/profile/api-tokens/clients
 * 2. Create a new OAuth App
 * 3. Set redirect URI to: https://your-domain.com/api/auth/cloudflare/callback
 * 4. Copy Client ID and Client Secret
 */

// OAuth Configuration
// You need to create an OAuth app at: https://dash.cloudflare.com/profile/api-tokens/clients
export const CLOUDFLARE_OAUTH_CONFIG = {
  // Replace these with your OAuth app credentials
  clientId: process.env.NEXT_PUBLIC_CLOUDFLARE_CLIENT_ID || '',
  clientSecret: process.env.CLOUDFLARE_CLIENT_SECRET || '',
  
  // OAuth endpoints
  authorizationUrl: 'https://dash.cloudflare.com/oauth2/auth',
  tokenUrl: 'https://dash.cloudflare.com/oauth2/token',
  
  // Scopes needed - these are pre-defined when creating the OAuth app
  // Required scopes: account:read, workers:read, d1:read, kv:read, r2:read
  scopes: [
    'account:read',
    'workers:read',
    'd1:read',
    'kv:read', 
    'r2:read',
    'zone:read',
  ],
  
  // Redirect URI - update this to your domain
  redirectUri: typeof window !== 'undefined' 
    ? `${window.location.origin}/api/auth/cloudflare/callback`
    : '',
};

/**
 * Generate OAuth authorization URL
 * User is redirected to this URL to authorize the app
 */
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLOUDFLARE_OAUTH_CONFIG.clientId,
    redirect_uri: CLOUDFLARE_OAUTH_CONFIG.redirectUri,
    scope: CLOUDFLARE_OAUTH_CONFIG.scopes.join(' '),
    state: state, // CSRF protection
  });
  
  return `${CLOUDFLARE_OAUTH_CONFIG.authorizationUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}> {
  const response = await fetch(CLOUDFLARE_OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: CLOUDFLARE_OAUTH_CONFIG.clientId,
      client_secret: CLOUDFLARE_OAUTH_CONFIG.clientSecret,
      redirect_uri: CLOUDFLARE_OAUTH_CONFIG.redirectUri,
    }).toString(),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }
  
  return response.json();
}

/**
 * Get user's accounts using OAuth token
 */
export async function getUserAccountsWithOAuth(accessToken: string): Promise<Array<{
  account_id: string;
  account_name: string;
}>> {
  const response = await fetch('https://api.cloudflare.com/client/v4/accounts', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error('Failed to fetch accounts');
  }
  
  return data.result.map((acc: any) => ({
    account_id: acc.id,
    account_name: acc.name,
  }));
}
