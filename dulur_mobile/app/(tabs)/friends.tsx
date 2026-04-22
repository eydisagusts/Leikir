import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Modal, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { 
    getFriends, 
    getChallenges, 
    searchUsers, 
    sendFriendRequest, 
    acceptFriendRequest, 
    removeFriend, 
    createChallenge, 
    acceptChallenge, 
    declineChallenge 
} from '@/lib/social';

const TABS = [
    { id: 'vinir', label: 'Vinir', icon: 'people' },
    { id: 'leita', label: 'Leita', icon: 'search' },
    { id: 'askoranir', label: 'Áskoranir', icon: 'flash' }
];

const GAMES = [
    { id: 'ordla', name: 'Orðla' },
    { id: 'hengimadur', name: 'Hengimaður' },
    { id: 'krossgata', name: 'Krossgáta' },
    { id: 'kviss', name: 'Kviss' },
    { id: 'litakodi', name: 'Litakóði' },
    { id: 'minnisspil', name: 'Minnisspil' },
    { id: 'sprengjuleit', name: 'Sprengjuleit' },
    { id: 'stafarugl', name: 'Stafarugl' },
    { id: 'stafasveimur', name: 'Stafasveimur' },
    { id: 'straumur', name: 'Straumur' },
    { id: 'sudoku', name: 'Sudoku' },
    { id: 'tengingar', name: 'Tengingar' },
];

export default function FriendsScreen() {
    const [activeTab, setActiveTab] = useState('vinir');
    const [isLoading, setIsLoading] = useState(true);
    const [friends, setFriends] = useState<any[]>([]);
    const [challenges, setChallenges] = useState<any[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [currentUserSubscribed, setCurrentUserSubscribed] = useState(false);

    // Search Mode
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Modals
    const [challengeModalOpen, setChallengeModalOpen] = useState(false);
    const [selectedFriend, setSelectedFriend] = useState<any>(null);
    const [isIssuingChallenge, setIsIssuingChallenge] = useState<string | null>(null);

    const [resultModalOpen, setResultModalOpen] = useState(false);
    const [selectedResult, setSelectedResult] = useState<any>(null);

    const fetchData = useCallback(async (isInitial = true) => {
        if (isInitial) setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setCurrentUserId(user.id);
            const { data: profile } = await supabase.from('profiles').select('is_subscribed').eq('id', user.id).single();
            setCurrentUserSubscribed(profile?.is_subscribed || false);

            const friendsRes = await getFriends();
            const challengesRes = await getChallenges();

            if (friendsRes.success) setFriends(friendsRes.friends || []);
            if (challengesRes.success) setChallenges(challengesRes.challenges || []);
        }
        if (isInitial) setIsLoading(false);
    }, []);

    useEffect(() => {
        fetchData(true);
        const interval = setInterval(() => fetchData(false), 10000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const acceptedFriends = friends.filter((f) => f.status === 'accepted');
    const incomingRequests = friends.filter((f) => f.status === 'pending' && f.user_id2 === currentUserId);
    const outgoingRequests = friends.filter((f) => f.status === 'pending' && f.user_id1 === currentUserId);

    const pendingChallenges = challenges.filter((c) => c.status === 'pending' && c.challenged_id === currentUserId);
    const outgoingChallenges = challenges.filter((c) => c.status === 'pending' && c.challenger_id === currentUserId);
    const activeChallenges = challenges.filter((c) => c.status === 'accepted');
    const completedChallenges = challenges.filter((c) => c.status === 'completed' || c.status === 'declined');

    const handleSearch = async () => {
        setIsSearching(true);
        const res = await searchUsers(searchQuery);
        if (res.success) setSearchResults(res.users || []);
        setIsSearching(false);
    };

    const handleSendRequest = async (id: string) => {
        await sendFriendRequest(id);
        Alert.alert("Sent", "Vinabeiðni var send!");
        setSearchQuery('');
        setSearchResults([]);
        fetchData(false);
    };

    const handleCreateChallenge = async (gameId: string) => {
        if (!selectedFriend) return;
        setIsIssuingChallenge(gameId);
        const res = await createChallenge(selectedFriend.id, gameId);
        if (res.success) {
            setChallengeModalOpen(false);
            setActiveTab('askoranir');
            fetchData(false);
        } else {
            Alert.alert("Villa", res.error || "Ekki tókst að búa til áskorun.");
        }
        setIsIssuingChallenge(null);
    };

    const handleShare = async () => {
        const inviteUrl = `https://dulur.is/vinir?invite=${currentUserId}`;
        try {
            await Share.share({
                message: `Skráðu þig inn á Dulur og skoraðu á mig í skemmtilegum íslenskum þrautum! ${inviteUrl}`,
            });
        } catch (error) {
            console.error('Error sharing', error);
        }
    };

    const confirmUnfriendAction = (friendshipId: string, name: string) => {
        Alert.alert(
            "Fjarlægja vin",
            `Ertu viss um að þú viljir fjarlægja ${name} af vinalistanum?`,
            [
                { text: "Hætta við", style: "cancel" },
                { text: "Fjarlægja", style: "destructive", onPress: async () => {
                    await removeFriend(friendshipId);
                    fetchData(false);
                }}
            ]
        );
    };

    const renderTabsNav = () => (
        <View className="flex-row mx-4 my-2 bg-slate-100 rounded-xl p-1">
            {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                let badgeCount = 0;
                if (tab.id === 'leita') badgeCount = incomingRequests.length;
                if (tab.id === 'askoranir') badgeCount = pendingChallenges.length;

                return (
                    <TouchableOpacity
                        key={tab.id}
                        activeOpacity={0.8}
                        onPress={() => setActiveTab(tab.id)}
                        className="flex-1 flex-row items-center justify-center p-3 rounded-lg"
                        style={isActive ? {
                            backgroundColor: 'white',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.05,
                            shadowRadius: 2,
                            elevation: 1
                        } : {}}
                    >
                        <Ionicons name={isActive ? tab.icon : `${tab.icon}-outline` as any} size={18} color={isActive ? '#1e1b4b' : '#64748b'} />
                        <Text 
                            className="ml-2 font-bold text-sm"
                            style={{ color: isActive ? '#1e1b4b' : '#64748b' }}
                        >
                            {tab.label}
                        </Text>
                        {badgeCount > 0 && (
                            <View className="ml-1.5 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
                                <Text className="text-white text-[10px] font-bold">{badgeCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    const renderVinir = () => {
        if (acceptedFriends.length === 0 && outgoingRequests.length === 0) {
            return (
                <View className="items-center justify-center py-20 px-4">
                    <Ionicons name="people-outline" size={64} color="#CBD5E1" />
                    <Text className="text-slate-500 font-bold text-lg mt-4 text-center">Engir vinir ennþá, bættu við vinum til að skora á þá!</Text>
                </View>
            );
        }

        return (
            <View className="px-4 pb-32">
                {[...acceptedFriends, ...outgoingRequests].map((f: any) => {
                    const friendProfile = f.user_id1 === currentUserId ? f.profile2 : f.profile1;
                    const isPending = f.status === 'pending';

                    return (
                        <View key={f.id} className="flex-row items-center justify-between p-4 mb-3 bg-white border border-slate-100 rounded-[20px] shadow-sm">
                            <View className="flex-row items-center">
                                <View className="w-12 h-12 bg-indigo-50 rounded-full items-center justify-center mr-3">
                                    <Text className="text-indigo-900 font-black text-lg">
                                        {friendProfile?.username?.charAt(0).toUpperCase() || '?'}
                                    </Text>
                                </View>
                                <View>
                                    <View className="flex-row items-center">
                                        <Text className="font-black text-lg text-[#1e1b4b]">{friendProfile?.username}</Text>
                                        {isPending && <View className="bg-slate-100 px-2 mt-0.5 rounded-full ml-2 py-0.5"><Text className="text-[9px] font-bold text-slate-500 tracking-wider">Bíður</Text></View>}
                                    </View>
                                </View>
                            </View>
                            
                            <View className="flex-row space-x-2 gap-2">
                                {!isPending && (
                                    <TouchableOpacity activeOpacity={0.7} 
                                        className="bg-indigo-50 px-3 py-2 rounded-xl flex-row items-center"
                                        onPress={() => {
                                            setSelectedFriend(friendProfile);
                                            setChallengeModalOpen(true);
                                        }}
                                    >
                                        <Ionicons name="flash" size={16} color="#4338ca" />
                                        <Text className="text-indigo-700 font-bold ml-1 text-sm text-center">Skora</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity activeOpacity={0.7} 
                                    className="p-2 justify-center items-center rounded-xl bg-slate-50"
                                    onPress={() => confirmUnfriendAction(f.id, friendProfile?.username)}
                                >
                                    <Ionicons name="close" size={18} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                })}
            </View>
        );
    };

    const renderLeita = () => (
        <View className="px-4 pb-32 space-y-6">
            
            {/* Incoming Requests */}
            {incomingRequests.length > 0 && (
                <View className="mb-6">
                    <Text className="text-xl font-black text-[#1e1b4b] mb-4">Vinabeiðnir ({incomingRequests.length})</Text>
                    {incomingRequests.map((f: any) => (
                        <View key={f.id} className="p-4 mb-3 bg-indigo-50 border border-indigo-100 rounded-[20px]">
                            <View className="flex-row items-center mb-3">
                                <View className="w-10 h-10 bg-white rounded-full items-center justify-center mr-3 shadow-sm">
                                    <Text className="text-indigo-900 font-black text-lg">{f.profile1?.username?.charAt(0)?.toUpperCase() || '?'}</Text>
                                </View>
                                <Text className="font-black text-lg text-indigo-950">{f.profile1?.username || 'Óþekktur spilari'}</Text>
                            </View>
                            <View className="flex-row gap-3">
                                <TouchableOpacity activeOpacity={0.7} 
                                    className="flex-1 bg-indigo-600 p-3 rounded-xl items-center flex-row justify-center"
                                    onPress={async () => { await acceptFriendRequest(f.id); fetchData(false); }}
                                >
                                    <Ionicons name="checkmark" size={18} color="white" />
                                    <Text className="text-white font-bold ml-1">Samþykkja</Text>
                                </TouchableOpacity>
                                <TouchableOpacity activeOpacity={0.7} 
                                    className="flex-1 bg-white border border-slate-200 p-3 rounded-xl flex-row justify-center items-center"
                                    onPress={async () => { await removeFriend(f.id); fetchData(false); }}
                                >
                                    <Ionicons name="close" size={18} color="#64748b" />
                                    <Text className="text-slate-500 font-bold ml-1">Hafna</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Sub-Header */}
            <View>
                <Text className="text-xl font-black text-[#1e1b4b] mb-4">Leita að spilara</Text>
                <View className="flex-row gap-3">
                    <View className="flex-1 bg-white border border-slate-300 rounded-2xl flex-row items-center px-4 h-14 shadow-sm">
                        <Ionicons name="search" size={20} color="#64748b" />
                        <TextInput 
                            className="flex-1 ml-3 font-semibold text-[#1e1b4b] text-base h-full"
                            style={{ paddingVertical: 0, margin: 0, includeFontPadding: false }}
                            placeholder="Leita að notendanafni..."
                            placeholderTextColor="#94a3b8"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSearch}
                            autoCapitalize="none"
                        />
                    </View>
                    <TouchableOpacity activeOpacity={0.7} 
                        className="bg-[#1e1b4b] w-14 h-14 rounded-xl items-center justify-center"
                        onPress={handleSearch}
                    >
                        {isSearching ? <ActivityIndicator color="white" /> : <Ionicons name="arrow-forward" size={24} color="white" />}
                    </TouchableOpacity>
                </View>
            </View>

            {searchResults.length > 0 && (
                <View className="mt-4 space-y-3">
                    {searchResults.map((u: any) => {
                        const isFriend = acceptedFriends.some((f: any) => f.user_id1 === u.id || f.user_id2 === u.id);
                        const isPendingOut = outgoingRequests.some((f: any) => f.user_id2 === u.id);
                        return (
                            <View key={u.id} className="flex-row items-center justify-between bg-white p-4 rounded-[20px] shadow-sm border border-slate-100 mb-2">
                                <Text className="font-bold text-lg text-[#1e1b4b]">{u.username || 'Óþekktur spilari'}</Text>
                                {isFriend ? (
                                    <Text className="text-sm font-bold text-slate-500">Vinir</Text>
                                ) : isPendingOut ? (
                                    <Text className="text-sm font-bold text-slate-500">Sent</Text>
                                ) : (
                                    <TouchableOpacity activeOpacity={0.7} 
                                        className="bg-indigo-50 px-4 py-2 rounded-xl flex-row items-center"
                                        onPress={() => handleSendRequest(u.id)}
                                    >
                                        <Ionicons name="person-add" size={16} color="#4338ca" />
                                        <Text className="text-indigo-700 font-bold ml-1 text-sm">Bæta við</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        );
                    })}
                </View>
            )}

            <View className="flex-1 justify-end h-auto mt-10">
                <View className="bg-slate-50 p-6 rounded-[24px] items-center text-center w-full">
                    <Ionicons name="paper-plane" size={32} color="#1e1b4b" />
                    <Text className="text-[#1e1b4b] font-black text-xl mt-3 mb-6 text-center">Bjóða vinum</Text>
                    <TouchableOpacity activeOpacity={0.7} 
                        className="bg-[#1e1b4b] w-full h-14 rounded-xl items-center justify-center flex-row"
                        onPress={handleShare}
                    >
                        <Ionicons name="share-social" size={20} color="white" />
                        <Text className="text-white font-bold text-lg ml-2">Deila Link</Text>
                    </TouchableOpacity>
                </View>
            </View>

        </View>
    );

    const renderAskoranir = () => (
        <View className="px-4 pb-32">
            
            {/* Incoming */}
            {pendingChallenges.length > 0 && (
                <View className="mb-6">
                    <Text className="text-xl font-black text-indigo-600 mb-4">Nýjar Áskoranir!</Text>
                    {pendingChallenges.map((c: any) => (
                        <View key={c.id} className="p-4 mb-3 bg-white border-2 border-indigo-100 rounded-[20px] shadow-sm">
                            <View className="flex-row items-center mb-4">
                                <View className="w-12 h-12 bg-indigo-50 rounded-full items-center justify-center mr-3">
                                    <Ionicons name="flash" size={24} color="#4338ca" />
                                </View>
                                <View className="flex-1">
                                    <Text className="font-bold text-[#1e1b4b] text-base"><Text className="font-black">{c.challenger?.username}</Text> hefur skorað á þig í {GAMES.find(g => g.id === c.game_type)?.name || c.game_type}!</Text>
                                    <Text className="text-sm text-indigo-600 font-bold mt-0.5">Þorirðu?</Text>
                                </View>
                            </View>
                            <View className="flex-row gap-3">
                                <TouchableOpacity activeOpacity={0.7} 
                                    className="flex-1 bg-[#1e1b4b] p-3 rounded-xl items-center flex-row justify-center"
                                    onPress={async () => { 
                                        const r = await acceptChallenge(c.id);
                                        if (r.success) {
                                            router.push(`/askorun/${c.id}`);
                                        }
                                    }}
                                >
                                    <Ionicons name="play" size={16} color="white" />
                                    <Text className="text-white font-bold ml-1.5">Spila</Text>
                                </TouchableOpacity>
                                <TouchableOpacity activeOpacity={0.7} 
                                    className="flex-1 bg-slate-100 p-3 rounded-xl items-center flex-row justify-center"
                                    onPress={async () => { await declineChallenge(c.id); fetchData(false); }}
                                >
                                    <Ionicons name="close" size={16} color="#64748b" />
                                    <Text className="text-slate-600 font-bold ml-1.5">Hafna</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Outgoing & Active */}
            <Text className="text-xl font-black text-[#1e1b4b] mt-4 mb-4">Áskoranir</Text>
            {activeChallenges.length === 0 && outgoingChallenges.length === 0 ? (
                <Text className="text-slate-400 font-bold text-center italic mb-8 mt-2">Engar virkar áskoranir.</Text>
            ) : (
                <View className="mb-8">
                    {outgoingChallenges.map((c: any) => (
                         <View key={c.id} className="flex-row items-center justify-between bg-white p-4 rounded-[20px] border border-slate-100 shadow-sm mb-3 opacity-90">
                            <View className="flex-1 flex-row pr-2">
                                <Ionicons name="timer-outline" size={20} color="#94a3b8" />
                                <Text className="ml-2 font-medium text-[#1e1b4b] flex-1">
                                    Skorað á <Text className="font-bold">{c.challenged?.username}</Text> í {GAMES.find(g => g.id === c.game_type)?.name || c.game_type}
                                </Text>
                            </View>
                            <Text className="text-xs uppercase tracking-widest font-bold text-slate-400">Bíður</Text>
                         </View>
                    ))}
                    {activeChallenges.map((c: any) => {
                        const isChallenger = c.challenger_id === currentUserId;
                        const opponentName = isChallenger ? c.challenged?.username : c.challenger?.username;
                        const myScore = isChallenger ? c.challenger_score : c.challenged_score;
                        return (
                            <View key={c.id} className="flex-row items-center justify-between bg-blue-50 p-4 rounded-[20px] border border-blue-100 shadow-sm mb-3">
                                <View className="flex-1 pr-2">
                                    <Text className="font-black text-blue-900 text-lg">{GAMES.find(g => g.id === c.game_type)?.name || c.game_type}</Text>
                                    <Text className="text-blue-800/80 font-bold text-sm">gegn {opponentName}</Text>
                                </View>
                                {myScore === null ? (
                                    <TouchableOpacity activeOpacity={0.7} 
                                       className="bg-blue-600 px-4 py-2.5 rounded-xl shadow-sm"
                                       onPress={() => router.push(`/askorun/${c.id}`)}
                                    >
                                        <Text className="text-white font-bold">Spila</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <Text className="text-blue-600/70 font-bold text-sm">Í vinnslu...</Text>
                                )}
                            </View>
                        );
                    })}
                </View>
            )}

            {/* Completed */}
            {completedChallenges.length > 0 && (
                <View>
                    <Text className="text-xl font-black text-[#1e1b4b] mt-2 mb-4">Saga</Text>
                    {completedChallenges.map((c: any) => {
                         if (c.status === 'declined') {
                            const isChallenger = c.challenger_id === currentUserId;
                            const opp = isChallenger ? c.challenged?.username : c.challenger?.username;
                            return (
                                <View key={c.id} className="flex-row items-center p-4 bg-slate-50 border border-slate-100 rounded-[20px] mb-3 opacity-60">
                                   <Ionicons name="close-circle" size={24} color="#94a3b8" />
                                   <View className="ml-3">
                                        <Text className="font-bold text-slate-500 line-through">{GAMES.find(g => g.id === c.game_type)?.name} gegn {opp}</Text>
                                        <Text className="text-xs text-slate-400 font-bold">Hafnað</Text>
                                   </View>
                                </View>
                            );
                         }

                         const isWinner = c.winner_id === currentUserId;
                         const isTie = !c.winner_id;
                         const isChallenger = c.challenger_id === currentUserId;
                         const oppName = isChallenger ? c.challenged?.username : c.challenger?.username;

                         const myScore = isChallenger ? c.challenger_score : c.challenged_score;
                         const oppScore = isChallenger ? c.challenged_score : c.challenger_score;

                         let cardBg = isWinner ? 'bg-green-50 border-green-100' : isTie ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-100';
                         let iconClass = isWinner ? 'trophy' : isTie ? 'remove' : 'close';
                         let iconColor = isWinner ? '#22c55e' : isTie ? '#64748b' : '#ef4444';

                         return (
                            <TouchableOpacity activeOpacity={0.7} 
                                key={c.id} 
                                className={`flex-row items-center justify-between p-4 border rounded-[20px] mb-3 ${cardBg}`}
                                onPress={() => { setSelectedResult(c); setResultModalOpen(true); }}
                            >
                                <View className="flex-row items-center flex-1">
                                    <View className="w-12 h-12 bg-white rounded-xl items-center justify-center mr-3 shadow-sm border border-slate-100/50">
                                         <Ionicons name={iconClass as any} size={24} color={iconColor} />
                                    </View>
                                    <View>
                                        <Text className="font-black text-[#1e1b4b] text-lg leading-tight">{GAMES.find(g => g.id === c.game_type)?.name}</Text>
                                        <Text className="font-bold text-slate-600/80 text-sm">gegn {oppName}</Text>
                                    </View>
                                </View>
                                <View className="bg-white px-3 py-1.5 rounded-lg ml-2 shadow-sm border border-slate-100">
                                     <Text className="font-black text-[#1e1b4b]">Úrslit</Text>
                                </View>
                            </TouchableOpacity>
                         );
                    })}
                </View>
            )}

        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top']}>
            <View className="flex-1 bg-[#FAFAFA]">
                {/* Header */}
                <View className="pt-6 pb-4 bg-[#FAFAFA] border-b border-slate-100 z-10 items-center justify-center flex-row">
                    <Text className="text-[32px] md:text-[36px] font-black font-serif tracking-tight text-[#1e1b4b] text-center">Vinir</Text>
                </View>

            <View className="flex-1 w-full max-w-[600px] self-center">
                {renderTabsNav()}

                <ScrollView className="flex-1 mt-2" showsVerticalScrollIndicator={false}>
                    {isLoading && !searchQuery ? (
                        <View className="mt-20"><ActivityIndicator size="large" color="#1e1b4b" /></View>
                    ) : (
                        <View>
                            {activeTab === 'vinir' && renderVinir()}
                            {activeTab === 'leita' && renderLeita()}
                            {activeTab === 'askoranir' && renderAskoranir()}
                        </View>
                    )}
                </ScrollView>
            </View>

            {/* Challenge Modal */}
            {challengeModalOpen && (
                <View className="absolute inset-0 z-50 bg-black/60 justify-end" style={{ elevation: 100 }}>
                    <View className="bg-[#FAFAFA] rounded-t-[32px] p-6 h-[80%] pb-12">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-2xl font-black font-serif text-[#1e1b4b]">
                                Skora á {selectedFriend?.username}
                            </Text>
                            <TouchableOpacity activeOpacity={0.7} onPress={() => setChallengeModalOpen(false)} className="bg-slate-200 p-2 rounded-full">
                                <Ionicons name="close" size={24} color="#1e1b4b" />
                            </TouchableOpacity>
                        </View>
                        {(!currentUserSubscribed || !selectedFriend?.is_subscribed) ? (
                            <Text className="text-slate-500 text-sm mb-6 leading-5">
                                Aðeins áskrifendur geta skorað og tekið við áskorun í öðrum leikjum en ókeypis leikjunum. Ef það er lás á áskriftarleikjum þá vantar þig eða vini þínum áskrift til að spila. Endilega hafðu samband ef báðir aðilar eru með áskrift en þið sjáið samt lás.
                            </Text>
                        ) : (
                            <Text className="text-slate-500 text-sm mb-6 leading-5">
                                Valið er þitt! Þið getið bæði spilað alla leikina.
                            </Text>
                        )}
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View className="flex-row flex-wrap justify-between gap-3 pb-8">
                                {GAMES.map(g => {
                                    const isFreeGame = ['ordla', 'hengimadur', 'sudoku'].includes(g.id);
                                    const canPlay = isFreeGame || (currentUserSubscribed && selectedFriend?.is_subscribed);

                                    return (
                                        <TouchableOpacity activeOpacity={0.7} 
                                            key={g.id} 
                                            className={`w-[48%] p-4 rounded-2xl items-center border mb-3 ${!canPlay ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 shadow-sm'}`}
                                            onPress={() => handleCreateChallenge(g.id)}
                                            disabled={isIssuingChallenge === g.id || !canPlay}
                                        >
                                            <View className="flex-row items-center justify-center">
                                                <Text className="font-bold text-lg text-[#1e1b4b] mb-1">{g.name}</Text>
                                                {!canPlay && <Ionicons name="lock-closed" size={14} color="#94a3b8" style={{ marginLeft: 4, marginBottom: 4 }} /> }
                                            </View>
                                            {!canPlay && <Text className="text-[10px] uppercase font-bold text-slate-400">Krefst Áskriftar</Text>}
                                            {isIssuingChallenge === g.id && <ActivityIndicator size="small" color="#1e1b4b" className="mt-2" />}
                                        </TouchableOpacity>
                                    )
                                })}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            )}

            {/* Result Modal */}
            {selectedResult && resultModalOpen && (
                <View className="absolute inset-0 z-50 bg-black/80 items-center justify-center p-6 pb-24" style={{ elevation: 100 }}>
                    <View className="bg-white w-full rounded-[32px] p-8 items-center border-4 border-slate-100 shadow-xl">
                        {(() => {
                            const isWinner = selectedResult.winner_id === currentUserId;
                            const isTie = !selectedResult.winner_id;
                            const isChallenger = selectedResult.challenger_id === currentUserId;
                            const myScore = isChallenger ? selectedResult.challenger_score : selectedResult.challenged_score;
                            const oppScore = isChallenger ? selectedResult.challenged_score : selectedResult.challenger_score;
                            const oppName = isChallenger ? selectedResult.challenged?.username : selectedResult.challenger?.username;
                            
                            return (
                                <>
                                    <Text className="text-4xl font-black font-serif text-center mb-2 text-[#1e1b4b]">
                                        {isTie ? 'Jafntefli!' : isWinner ? 'Þú vannst!!' : 'Þú tapaðir'}
                                    </Text>
                                    <Text className="text-slate-500 font-bold mb-8 text-lg text-center">
                                        {GAMES.find(g => g.id === selectedResult.game_type)?.name}
                                    </Text>

                                    <View className="flex-row items-center w-full justify-between bg-slate-50 p-6 rounded-[24px] border border-slate-100 mb-8">
                                        <View className="items-center">
                                            <Text className="text-sm font-bold uppercase text-slate-400 mb-1">Þú</Text>
                                            <Text className={`text-5xl font-black ${isWinner ? 'text-green-500' : isTie ? 'text-slate-400' : 'text-red-500'}`}>{myScore}</Text>
                                        </View>
                                        <View className="h-10 w-px bg-slate-300 mx-4" />
                                        <View className="items-center">
                                            <Text className="text-sm font-bold uppercase text-slate-400 mb-1">{oppName?.substring(0,6)}</Text>
                                            <Text className={`text-5xl font-black ${!isWinner && !isTie ? 'text-green-500' : isTie ? 'text-slate-400' : 'text-red-500'}`}>{oppScore}</Text>
                                        </View>
                                    </View>

                                    <TouchableOpacity activeOpacity={0.7} 
                                        className="bg-[#1e1b4b] w-full p-4 rounded-xl items-center"
                                        onPress={() => {
                                            setResultModalOpen(false);
                                            setSelectedResult(null);
                                        }}
                                    >
                                        <Text className="text-white font-bold text-lg">Loka</Text>
                                    </TouchableOpacity>
                                </>
                            )
                        })()}
                    </View>
                </View>
            )}
        </View>
        </SafeAreaView>
    );
}

