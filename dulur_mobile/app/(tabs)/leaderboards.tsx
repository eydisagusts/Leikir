import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

type LeaderboardPlayer = {
    id: string;
    username: string;
    xp: number;
};

export default function LeaderboardsScreen() {
    const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
    const [monthlyPlayers, setMonthlyPlayers] = useState<LeaderboardPlayer[]>([]);
    const [friends, setFriends] = useState<LeaderboardPlayer[]>([]);
    const [viewMode, setViewMode] = useState<'global' | 'monthly' | 'friends'>('global');
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentUserStats, setCurrentUserStats] = useState<{ xp: number, rank: number, username: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchLeaderboard() {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                let userId = user?.id || null;
                setCurrentUserId(userId);

                // Fetch Global Top 50
                const { data: globalData, error: globalErr } = await supabase
                    .from('profiles')
                    .select('id, username, xp')
                    .order('xp', { ascending: false })
                    .limit(50);

                if (globalErr) throw globalErr;
                setPlayers(globalData || []);

                // Fetch Monthly Top 50
                const { data: monthlyData } = await supabase.rpc('get_monthly_global_leaderboard', { p_limit: 50 });
                if (monthlyData) {
                    setMonthlyPlayers(monthlyData.map((r: any) => ({
                        id: r.id || r.user_id,
                        username: r.username,
                        xp: r.xp || r.total_score || r.total_xp || 0
                    })));
                }

                if (userId) {
                    const { data: userData } = await supabase.from('profiles').select('username, xp').eq('id', userId).single();
                    if (userData) {
                        const userXp = userData.xp || 0;
                        const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).gt('xp', userXp);
                        setCurrentUserStats({
                            xp: userXp,
                            username: userData.username,
                            rank: count !== null ? count + 1 : 0
                        });

                        const { data: friendRows } = await supabase
                            .from('friends')
                            .select('user_id1, user_id2')
                            .eq('status', 'accepted')
                            .or(`user_id1.eq.${userId},user_id2.eq.${userId}`);

                        let fIds = friendRows ? friendRows.map((r: any) => r.user_id1 === userId ? r.user_id2 : r.user_id1) : [];
                        fIds.push(userId);

                        const { data: fData } = await supabase
                            .from('profiles')
                            .select('id, username, xp')
                            .in('id', fIds)
                            .order('xp', { ascending: false });

                        setFriends(fData || []);
                    }
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        
        fetchLeaderboard();
        const profileSub = DeviceEventEmitter.addListener('profile-updated', fetchLeaderboard);
        return () => profileSub.remove();
    }, []);

    const currentList = viewMode === 'global' ? players : viewMode === 'monthly' ? monthlyPlayers : friends;
    const isUserInList = currentList.some(p => p.id === currentUserId);
    const showStickyFooter = currentUserId && currentUserStats && !isUserInList && (viewMode === 'global' || viewMode === 'monthly');

    const renderPlayerRow = (player: LeaderboardPlayer, idx: number, isSelf: boolean, forceRank?: number) => {
        const rankToDisplay = forceRank !== undefined ? forceRank : (idx + 1);
        const nameToDisplay = player.username?.split('_')[0] || 'Nafnlaus';
        const isTop3 = rankToDisplay <= 3;

        let bgClass = isSelf ? 'bg-indigo-50/80' : 'bg-white';
        let borderClass = isSelf ? 'border-indigo-200' : 'border-black/5';
        let crownColor = '#64748b';
        let shadowColor = '#000';

        if (rankToDisplay === 1) { bgClass = 'bg-[#FAF7E8]'; borderClass = 'border-[#E5D7A1]'; crownColor = '#D4AF37'; shadowColor = '#D4AF37'; }
        if (rankToDisplay === 2) { bgClass = 'bg-[#F2F3F5]'; borderClass = 'border-[#D1D2D5]'; crownColor = '#9BA1A6'; shadowColor = '#9BA1A6'; }
        if (rankToDisplay === 3) { bgClass = 'bg-[#FAF0E6]'; borderClass = 'border-[#E6C6AE]'; crownColor = '#CD7F32'; shadowColor = '#CD7F32'; }

        return (
            <View
                key={player.id}
                className={`w-full rounded-[24px] p-5 flex-row items-center border ${bgClass} ${borderClass} mb-3.5 relative overflow-hidden`}
                style={isTop3 ? {
                    elevation: 4, shadowColor, shadowOpacity: 0.15, shadowOffset: { width: 0, height: 6 }, shadowRadius: 10
                } : {
                    elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 4 }, shadowRadius: 6
                }}
            >
                {isTop3 && (
                    <View className="absolute -top-4 -right-4 opacity-[0.06] rotate-12">
                        <Ionicons name="trophy" size={100} color={crownColor} />
                    </View>
                )}

                <View className="w-12 h-12 bg-white rounded-full items-center justify-center mr-4 border border-black/5 shadow-sm" style={{ elevation: 1 }}>
                    <Text className={`font-black font-serif text-[22px] ${isTop3 ? '' : 'text-slate-400'}`} style={isTop3 ? { color: crownColor } : {}}>
                        {rankToDisplay}
                    </Text>
                </View>

                <View className="flex-1 flex-row items-center z-10">
                    <Text className={`text-[19px] font-black tracking-tight ${isSelf ? 'text-indigo-900' : 'text-[#1e1b4b]'}`} numberOfLines={1} style={{ flexShrink: 1 }}>
                        {nameToDisplay}
                    </Text>
                    {isSelf && (
                        <View className="ml-2 px-1.5 py-0.5 rounded flex-shrink-0 bg-indigo-200/50 border border-indigo-300">
                            <Text className="text-[10px] font-black tracking-widest text-indigo-700 uppercase">Þú</Text>
                        </View>
                    )}
                </View>

                <View className="items-end justify-center z-10 ml-2">
                    <Text className={`text-[20px] font-black font-serif tracking-tighter ${isSelf || isTop3 ? 'text-[#1e1b4b]' : 'text-slate-700'}`}>
                        {player.xp?.toLocaleString('is-IS') || 0}
                    </Text>
                    <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        XP
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top']}>
            <View className="flex-1 w-full max-w-[600px] self-center">
            <View className="px-6 pt-12 pb-6 items-center justify-center">
                <Text
                    className="text-[44px] leading-[1.1] font-black font-serif tracking-tighter text-[#1e1b4b] text-center mb-1"
                >
                    Stigatafla.
                </Text>
                <Text className="text-[18px] font-medium font-serif italic text-slate-500 tracking-wide text-center">
                    {viewMode === 'global' ? 'Topp 50 spilarar' : viewMode === 'monthly' ? 'Stig þennan mánuðinn' : 'Stig meðal vina.'}
                </Text>
            </View>

            {currentUserId && (
                <View className="flex-row mx-6 mb-6 bg-slate-200/50 rounded-2xl p-1.5 shadow-sm">
                    <TouchableOpacity
                        activeOpacity={0.8}
                        className="flex-1 items-center py-3 rounded-xl"
                        style={viewMode === 'global' ? { backgroundColor: 'white', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 } : {}}
                        onPress={() => setViewMode('global')}
                    >
                        <Text className={`font-black text-xs uppercase tracking-wider ${viewMode === 'global' ? 'text-[#1e1b4b]' : 'text-slate-500'}`}>
                            Allir
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        className="flex-1 items-center py-3 rounded-xl"
                        style={viewMode === 'monthly' ? { backgroundColor: 'white', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 } : {}}
                        onPress={() => setViewMode('monthly')}
                    >
                        <Text className={`font-black text-xs uppercase tracking-wider ${viewMode === 'monthly' ? 'text-[#1e1b4b]' : 'text-slate-500'}`}>
                            Mánuður
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        className="flex-1 items-center py-3 rounded-xl"
                        style={viewMode === 'friends' ? { backgroundColor: 'white', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 } : {}}
                        onPress={() => setViewMode('friends')}
                    >
                        <Text className={`font-black text-xs uppercase tracking-wider ${viewMode === 'friends' ? 'text-[#1e1b4b]' : 'text-slate-500'}`}>
                            Vinir
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: showStickyFooter ? 160 : 120 }} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <View className="flex-1 items-center justify-center pt-20">
                        <ActivityIndicator size="large" color="#1e1b4b" />
                    </View>
                ) : error ? (
                    <View className="flex-1 items-center justify-center pt-20 px-6">
                        <Text className="text-red-500 font-medium text-center">{error}</Text>
                    </View>
                ) : (
                    <View className="px-5 w-full self-center max-w-[600px]">
                        {currentList.map((player, idx) => renderPlayerRow(player, idx, player.id === currentUserId))}
                    </View>
                )}
            </ScrollView>

            {showStickyFooter && currentUserStats && (
                <View className="absolute bottom-4 left-5 right-5 z-50">
                    <View className="w-full h-[88px] absolute inset-0 bg-indigo-50/95 blur-xl rounded-[24px]" />
                    {renderPlayerRow({ id: currentUserId, username: currentUserStats.username, xp: currentUserStats.xp }, 0, true, currentUserStats.rank)}
                </View>
            )}
            </View>
        </SafeAreaView>
    );
}
