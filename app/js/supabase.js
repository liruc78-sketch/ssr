// ============================================================================
// Crypto.ssr — Supabase client & backend config
// Same project as the current site (do not change without updating the backend).
// ============================================================================
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL  = 'https://wovplubneljhoaliqkmk.supabase.co';
export const SUPABASE_ANON  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvdnBsdWJuZWxqaG9hbGlxa21rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTI3OTksImV4cCI6MjA5MTI2ODc5OX0.aNdQ8xnAfzQqQ0hFgQfwvT5ywyN03mtdXoRPngdnuso';
export const EDGE_BASE     = `${SUPABASE_URL}/functions/v1`;
export const CG_KEY        = 'CG-rqTDnjCErgK6hEq9x6s8RKzD';   // CoinGecko demo key
export const STORAGE_KEY   = 'tw_user_session';               // shared with legacy site

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// Thin edge-function helper (mirrors the legacy app's call style).
export async function edge(path, { method = 'POST', body, headers } = {}) {
    const res = await fetch(`${EDGE_BASE}/${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, ...headers },
        body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON */ }
    if (!res.ok) throw Object.assign(new Error(data?.error || `HTTP ${res.status}`), { status: res.status, data });
    return data;
}
