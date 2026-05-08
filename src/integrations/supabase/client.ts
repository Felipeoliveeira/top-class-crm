import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Read from environment variables (REQUIRED - no fallback to removed values)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Validate that required credentials are available
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Missing Supabase credentials. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set in your .env or .env.local file.'
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// Usando sessionStorage para que a sessão expire automaticamente ao fechar
// o navegador ou a aba — sem persistência entre sessões de navegação distintas.
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});