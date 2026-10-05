import { createClient } from '@supabase/supabase-js'

// Verejné hodnoty (publishable kľúč je určený pre prehliadač). Dajú sa prepísať cez .env.
const url = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://znsrokpaoczljisaoulu.supabase.co'
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || 'sb_publishable_9bRi6q6rnTTr5_Rszk5IiQ_MBBoti45'

if (!url || !key) {
  throw new Error('Chýba VITE_SUPABASE_URL alebo VITE_SUPABASE_PUBLISHABLE_KEY v .env')
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
})

export type Role = 'pending' | 'driver' | 'admin'
export type Profile = { user_id: string; email: string | null; name: string | null; role: Role; created_at: string }
