import { createClient } from '@supabase/supabase-js';

// Get environment variables (from .env.local)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create and export Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
