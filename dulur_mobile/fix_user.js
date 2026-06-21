require('dotenv').config({ path: '/Users/eydisla/Leikir/dulur_global/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fix() {
    const targetId = '8afd6c9d-78c6-4b31-926e-5059c11924aa'; // odda
    const sourceId = 'c55c8e3a-b76e-479d-8642-cc21110c0530'; // oddapodda

    // Update target (odda)
    const { data: updateTarget, error: targetError } = await supabase.from('profiles').update({
        is_subscribed: true,
        stripe_customer_id: '8935487',
        stripe_subscription_id: '2222542',
        lemon_customer_id: '8935487',
        lemon_subscription_id: '2222542',
        xp: 1540,
        xp_is: 1460,
        current_streak: 2,
        last_played_date: '2026-06-03'
    }).eq('id', targetId);
    
    console.log("Target Update Error:", targetError);

    // Wipe source (oddapodda)
    const { data: updateSource, error: sourceError } = await supabase.from('profiles').update({
        is_subscribed: false,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        lemon_customer_id: null,
        lemon_subscription_id: null,
        xp: 0,
        xp_is: 0,
        current_streak: 0
    }).eq('id', sourceId);
    
    console.log("Source Update Error:", sourceError);
    
    // Also move game results? They played yesterday and today on oddapodda. Let's move all game_results!
    const { data: updateResults, error: resError } = await supabase.from('game_results')
        .update({ user_id: targetId })
        .eq('user_id', sourceId);
    console.log("Results Update Error:", resError);

    // Also move game states
    const { data: updateStates, error: stateError } = await supabase.from('game_states')
        .update({ user_id: targetId })
        .eq('user_id', sourceId);
    console.log("States Update Error:", stateError);
    
    console.log("Done merging data to odda.");
}
fix();
