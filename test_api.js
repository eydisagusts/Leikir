const dotenv = require( 'dotenv');
dotenv.config({ path: '/Users/eydisla/Leikir/dulur_global/.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function test() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Create a mock user or use an existing one
    const { data: users } = await supabase.auth.admin.listUsers();
    if (users.users.length === 0) return console.log("No users");
    const user = users.users[0];

    // Try the exact insert
    const { data, error } = await supabase.from('game_results').insert({
        user_id: user.id,
        game_type: 'samhengi',
        won: true,
        score: 100,
        metadata: { guessesCount: 5, hintsUsed: 0 },
        time_taken_seconds: 60
    });
    console.log("Insert result:", { data, error });

    if (!error) {
        // Now test award_xp
        const { error: rpcError } = await supabase.rpc('award_xp', {
            amount: 100,
            reason: `Samhengi win`
        });
        console.log("RPC result:", rpcError);
        
        // Clean up
        await supabase.from('game_results').delete().eq('user_id', user.id).eq('game_type', 'samhengi');
    }
}
test();
