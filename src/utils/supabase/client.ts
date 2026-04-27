import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    if (typeof window === 'undefined') {
      // Return a dummy client or handle it gracefully on the server during build
      console.warn('Supabase credentials missing during server-side execution')
    }
    // createBrowserClient will throw if these are missing, so we provide fallbacks
    // but the app might fail if it actually tries to use it.
    return createBrowserClient(url || '', key || '')
  }

  return createBrowserClient(url, key)
}
