require('dotenv').config({ path: '/Users/eydisla/Leikir/dulur_global/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: profiles, error } = await supabase.from('profiles').select('*').in('username', ['odda', 'oddapodda']);
    console.log("Error:", error);
    console.log("Profiles:", profiles);
    
    if (profiles && profiles.length > 0) {
        const ids = profiles.map(p => p.id);
        const { data: subs, error: subError } = await supabase.from('subscriptions').select('*').in('user_id', ids);
        console.log("Sub Error:", subError);
        console.log("Subscriptions:", subs);
        
        // Also get their auth emails
        for (const p of profiles) {
            const { data: { user }, error: uError } = await supabase.auth.admin.getUserById(p.id);
            console.log("Auth user:", p.username, user?.email);
        }
    }
}
check();
