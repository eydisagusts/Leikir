const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'dulur_global/.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
    const { data, error } = await supabase.from('game_results').select('*').limit(5);
    console.log(data);
    const { count } = await supabase.from('game_results').select('*', { count: 'exact', head: true }).gte('created_at', '2026-01-01');
    console.log("Count in 2026:", count);
}
test();
