import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://qdtdzkahltojqgjrqezc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1Uw8INt9gaMDpupVnw91Mg_kemNeWGc";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
