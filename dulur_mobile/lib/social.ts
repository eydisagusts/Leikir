import { supabase } from './supabase';

// Search users by username (minimum 2 chars)
export async function searchUsers(query: string) {
    if (!query || query.length < 2) return { success: true, users: [] };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', `%${query}%`)
        .neq('id', user.id)
        .limit(10);

    if (error) {
        console.error('Error searching users:', error);
        return { success: false, error: 'Failed to search users' };
    }

    return { success: true, users: data };
}

// Send Friend Request
export async function sendFriendRequest(targetUserId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    if (user.id === targetUserId) return { success: false, error: 'Cannot add yourself' };

    const { error } = await supabase
        .from('friends')
        .insert({
            user_id1: user.id,
            user_id2: targetUserId,
            status: 'pending'
        });

    if (error) {
        if (error.code === '23505') {
            return { success: false, error: 'Friend request already sent or you are already friends.' };
        }
        console.error('Error sending friend request:', error);
        return { success: false, error: 'Failed to send friend request' };
    }

    return { success: true };
}

// Accept Friend Request
export async function acceptFriendRequest(friendshipId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
        .from('friends')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', friendshipId)
        .eq('user_id2', user.id)
        .eq('status', 'pending');

    if (error) {
        console.error('Error accepting friend request:', error);
        return { success: false, error: 'Failed to accept friend request' };
    }

    return { success: true };
}

// Remove Friend
export async function removeFriend(friendshipId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', friendshipId)
        .or(`user_id1.eq.${user.id},user_id2.eq.${user.id}`);

    if (error) {
        console.error('Error removing friend:', error);
        return { success: false, error: 'Failed to remove friend' };
    }

    return { success: true };
}

// Get Friends
export async function getFriends() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase
        .from('friends')
        .select(`
            id,
            status,
            user_id1,
            user_id2,
            profile1:profiles!user_id1(id, username, is_subscribed),
            profile2:profiles!user_id2(id, username, is_subscribed)
        `)
        .or(`user_id1.eq.${user.id},user_id2.eq.${user.id}`);

    if (error) {
        console.error('Error getting friends:', error);
        return { success: false, error: 'Failed to get friends' };
    }

    return { success: true, friends: data, currentUser: user.id };
}

// Get Challenges
export async function getChallenges() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data, error } = await supabase
        .from('challenges')
        .select(`
            *,
            challenger:profiles!challenger_id(id, username, is_subscribed),
            challenged:profiles!challenged_id(id, username, is_subscribed),
            winner:profiles!winner_id(id, username)
        `)
        .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error getting challenges:', error);
        return { success: false, error: 'Failed to get challenges' };
    }

    return { success: true, challenges: data, currentUser: user.id };
}

// Create Challenge
export async function createChallenge(challengedId: string, gameType: string, locale: string = 'is') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const isFreeGame = ['ordla', 'hengimadur', 'sudoku'].includes(gameType);

    // Premium Check 
    if (!isFreeGame) {
        const [{ data: challengerProfile }, { data: challengedProfile }] = await Promise.all([
            supabase.from('profiles').select('is_subscribed').eq('id', user.id).single(),
            supabase.from('profiles').select('is_subscribed').eq('id', challengedId).single()
        ]);

        if (!challengerProfile?.is_subscribed) {
            return { success: false, error: 'Þú verður að vera áskrifandi til að skora í þessum leik.', needsPremium: true };
        }
        if (!challengedProfile?.is_subscribed) {
            return { success: false, error: 'Andstæðingurinn verður að vera áskrifandi til að spila þennan leik.', needsPremium: true };
        }
    }

    const { error } = await supabase
        .from('challenges')
        .insert({
            challenger_id: user.id,
            challenged_id: challengedId,
            game_type: gameType,
            status: 'pending',
            challenger_score: null,
            challenger_time_seconds: null,
            locale: locale
        });

    if (error) {
        console.error('Error creating challenge:', error);
        return { success: false, error: 'Failed to create challenge' };
    }

    return { success: true };
}

// Accept Challenge
export async function acceptChallenge(challengeId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { data: challenge } = await supabase
        .from('challenges')
        .select('game_type')
        .eq('id', challengeId)
        .single();

    if (!challenge) return { success: false, error: 'Challenge not found' };

    const isFreeGame = ['ordla', 'hengimadur', 'sudoku'].includes(challenge.game_type);

    if (!isFreeGame) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_subscribed')
            .eq('id', user.id)
            .single();

        if (!profile?.is_subscribed) {
            return { success: false, error: 'Aðeins áskrifendur geta samþykkt áskorun í þessum leik.', needsPremium: true };
        }
    }

    const { error } = await supabase
        .from('challenges')
        .update({
            status: 'accepted',
            updated_at: new Date().toISOString()
        })
        .eq('id', challengeId)
        .eq('challenged_id', user.id)
        .eq('status', 'pending');

    if (error) {
        console.error('Error accepting challenge:', error);
        return { success: false, error: 'Failed to accept challenge' };
    }

    return { success: true, challengeId };
}

// Decline Challenge
export async function declineChallenge(challengeId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
        .from('challenges')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', challengeId)
        .eq('challenged_id', user.id)
        .eq('status', 'pending');

    if (error) {
        console.error('Error declining challenge:', error);
        return { success: false, error: 'Failed to decline challenge' };
    }

    return { success: true };
}
