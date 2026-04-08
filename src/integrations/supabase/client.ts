import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://***REMOVED***.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjc2tyYXd4ZXBjdmtnYmVncnBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NjkwMDYsImV4cCI6MjA5MDE0NTAwNn0.***REMOVED***";

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