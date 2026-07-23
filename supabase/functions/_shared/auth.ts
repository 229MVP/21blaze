import { errorResponse } from './cors.ts';
import { createServiceClient } from './supabaseAdmin.ts';

export type AuthedContext = {
  admin: ReturnType<typeof createServiceClient>;
  userId: string;
  displayName: string;
};

export async function requireAuthedUser(
  request: Request,
): Promise<AuthedContext | Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return errorResponse('Authentication required.', 401);
  }

  const admin = createServiceClient();
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(jwt);

  if (userError || !user) {
    return errorResponse('Invalid session.', 401);
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return errorResponse('Profile unavailable.', 403);
  }

  return {
    admin,
    userId: user.id,
    displayName: String(profile.display_name),
  };
}

export async function parseJsonBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return null;
    }
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}
