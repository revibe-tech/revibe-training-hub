import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Service-role client: bypasses RLS, so it must only ever run on the server.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const adminDb = url && serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

// PostgREST / Postgres codes for a table or function that doesn't exist yet
// (the migration hasn't been run).
const MISSING_CODES = new Set(['PGRST202', 'PGRST205', '42P01', '42883']);
export const isMissingSetup = (error) => MISSING_CODES.has(error?.code);
