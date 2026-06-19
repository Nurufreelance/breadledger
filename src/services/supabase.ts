import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bbqwqwlsjyyvxzytzuii.supabase.co'
const supabaseAnonKey = 'sb_publishable_jMsF3PtVG_H52maIec05_g_NwYZhD8k'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)