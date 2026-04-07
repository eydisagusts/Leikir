import React, { useEffect, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, TextInput, Alert, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
    const [profile, setProfile] = useState<any>(null);
    const [username, setUsername] = useState('');
    const [pushDailyGames, setPushDailyGames] = useState(false);
    const [pushFriendRequests, setPushFriendRequests] = useState(false);
    const [pushFriendChallenges, setPushFriendChallenges] = useState(false);
    const [pushChallengeResults, setPushChallengeResults] = useState(false);
    const [pushMonthlyEvents, setPushMonthlyEvents] = useState(false);
    const [pushLeaderboardPass, setPushLeaderboardPass] = useState(false);
    const [pushLeaderboardTop3, setPushLeaderboardTop3] = useState(false);
    
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const router = useRouter();

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
            if (data) {
                setProfile(data);
                setUsername(data.username || '');
                const ns = data.notification_settings || {};
                
                setPushDailyGames(ns.push_daily_games ?? false);
                setPushFriendRequests(ns.push_friend_requests ?? false);
                setPushFriendChallenges(ns.push_friend_challenges ?? false);
                setPushChallengeResults(ns.push_challenge_results ?? false);
                setPushMonthlyEvents(ns.push_monthly_events ?? false);
                setPushLeaderboardPass(ns.push_leaderboard_pass ?? false);
                setPushLeaderboardTop3(ns.push_leaderboard_top3 ?? false);
            }
        }
    };

    const handleSaveUsername = async () => {
        if (!username || username.length < 3 || username.length > 20 || username.includes(' ')) {
            Alert.alert('Villa', 'Lágmark 3 og hámark 20 stafir. Engin bil.');
            return;
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        
        await supabase.from('profiles').update({ username }).eq('id', session.user.id);
        Alert.alert('Vistað', 'Notandanafn hefur verið uppfært.');
    };

    const handleSaveNotifications = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        await supabase.from('profiles').update({ 
            notification_settings: { 
                push_daily_games: pushDailyGames,
                push_friend_requests: pushFriendRequests,
                push_friend_challenges: pushFriendChallenges,
                push_challenge_results: pushChallengeResults,
                push_monthly_events: pushMonthlyEvents,
                push_leaderboard_pass: pushLeaderboardPass,
                push_leaderboard_top3: pushLeaderboardTop3
            }
        }).eq('id', session.user.id);
        Alert.alert('Vistað', 'Tilkynningar hafa verið uppfærðar.');
    };

    const handleSavePassword = async () => {
        if (!currentPassword) {
            Alert.alert('Villa', 'Vinsamlegast sláðu inn núverandi lykilorð.');
            return;
        }
        if (!newPassword || newPassword !== confirmPassword || newPassword.length < 6) {
            Alert.alert('Villa', 'Lykilorð stemma ekki eða eru of stutt (Að minnsta kosti 6 stafir).');
            return;
        }
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.email) return;

        // Verify current password via standard signInWithPassword
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: session.user.email,
            password: currentPassword
        });

        if (signInError) {
            Alert.alert('Villa', 'Núverandi lykilorð er rangt.');
            return;
        }

        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
            Alert.alert('Villa', 'Gat ekki breytt lykilorði.');
            return;
        }
        setNewPassword('');
        setConfirmPassword('');
        setCurrentPassword('');
        Alert.alert('Vistað', 'Lykilorði hefur verið breytt.');
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Eyða aðgangi',
            'Ertu viss um að þú viljir eyða aðganginum þínum varanlega? Þetta er ekki hægt að afturkalla.',
            [
                { text: 'Hætta við', style: 'cancel' },
                { text: 'Eyða', style: 'destructive', onPress: async () => {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user) {
                        try {
                            await supabase.rpc('delete_user', { payload_user_id: session.user.id });
                        } catch (e) {
                            // Silently fail to ensure local signout completes
                        }
                    }
                    await supabase.auth.signOut();
                    router.replace('/login');
                }}
            ]
        );
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.replace('/login');
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
            <View className="px-6 pt-2 pb-6 flex-row justify-between items-center">
                <Text className="font-serif text-[32px] font-black tracking-tight text-[#1c1917]">Prófíll</Text>
                <TouchableOpacity onPress={handleLogout} className="bg-red-50 p-2 px-4 rounded-full">
                    <Text className="text-red-500 font-bold font-sans">Skrá út</Text>
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 150 }}>
                <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                    <Text className="font-serif font-black text-2xl mb-1 text-[#1c1917]">Aðgangsupplýsingar</Text>
                    <Text className="font-bold text-slate-800 mb-4 text-base">Breyta Notendanafni</Text>
                    
                    <TextInput 
                        value={username}
                        onChangeText={setUsername}
                        placeholderTextColor="#94a3b8"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl h-14 px-4 font-sans text-lg font-semibold text-[#1c1917] shadow-sm mb-2"
                        placeholder={profile?.username || 'Veldu notandanafn'}
                        autoCapitalize="none"
                        style={{ paddingVertical: 0, margin: 0, includeFontPadding: false }}
                    />
                    <Text className="text-slate-500 text-sm mb-5">Lágmark 3 og hámark 20 stafir. Engin bil.</Text>

                    <TouchableOpacity onPress={handleSaveUsername} className="w-full bg-[#1c1917] py-3.5 rounded-2xl items-center shadow-md">
                        <Text className="text-white font-bold text-base">Vista</Text>
                    </TouchableOpacity>
                </View>

                <View className="bg-white rounded-3xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
                    <View className="p-5 border-b border-gray-50 bg-[#fafaf9]">
                        <Text className="font-serif font-bold text-xl text-[#1c1917]">Tilkynningar</Text>
                        <Text className="text-slate-500 font-sans text-sm mt-1">Hvaða tilkynningar viltu fá í símann?</Text>
                    </View>
                    
                    <View className="p-2">
                        {/* Daglegir */}
                        <View className="p-3 border-b border-slate-50 flex-row justify-between items-center">
                            <View className="flex-1 pr-4">
                                <Text className="font-bold text-slate-800 mb-1">Daglegir leikir</Text>
                                <Text className="text-slate-500 text-xs leading-5">Fáðu áminningu á morgnana þegar nýir daglegir leikir eru mættir.</Text>
                            </View>
                            <Switch value={pushDailyGames} onValueChange={setPushDailyGames} />
                        </View>
                        
                        {/* Vinabeiðnir */}
                        <View className="p-3 border-b border-slate-50 flex-row justify-between items-center">
                            <View className="flex-1 pr-4">
                                <Text className="font-bold text-slate-800 mb-1">Vinabeiðnir</Text>
                                <Text className="text-slate-500 text-xs leading-5">Fáðu tilkynningu þegar einhver sendir þér vinabeiðni.</Text>
                            </View>
                            <Switch value={pushFriendRequests} onValueChange={setPushFriendRequests} />
                        </View>
                        
                        {/* Nýjar Áskoranir */}
                        <View className="p-3 border-b border-slate-50 flex-row justify-between items-center">
                            <View className="flex-1 pr-4">
                                <Text className="font-bold text-slate-800 mb-1">Nýjar áskoranir</Text>
                                <Text className="text-slate-500 text-xs leading-5">Fáðu tilkynningu þegar vinur skorar á þig í leik.</Text>
                            </View>
                            <Switch value={pushFriendChallenges} onValueChange={setPushFriendChallenges} />
                        </View>
                        
                        {/* Niðurstöður áskorana */}
                        <View className="p-3 border-b border-slate-50 flex-row justify-between items-center">
                            <View className="flex-1 pr-4">
                                <Text className="font-bold text-slate-800 mb-1">Niðurstöður úr áskorunum</Text>
                                <Text className="text-slate-500 text-xs leading-5">Fáðu tilkynningu þegar áskorun lýkur og sigurvegari hefur verið krýndur.</Text>
                            </View>
                            <Switch value={pushChallengeResults} onValueChange={setPushChallengeResults} />
                        </View>
                        
                        {/* Viðburðir */}
                        <View className="p-3 border-b border-slate-50 flex-row justify-between items-center">
                            <View className="flex-1 pr-4">
                                <Text className="font-bold text-slate-800 mb-1">Mánaðarlegir viðburðir</Text>
                                <Text className="text-slate-500 text-xs leading-5">Fáðu tilkynningu þegar nýr sérstakur viðburður hefst á Dulur.</Text>
                            </View>
                            <Switch value={pushMonthlyEvents} onValueChange={setPushMonthlyEvents} />
                        </View>
                        
                        {/* Framúrakstur */}
                        <View className="p-3 border-b border-slate-50 flex-row justify-between items-center">
                            <View className="flex-1 pr-4">
                                <Text className="font-bold text-slate-800 mb-1">Stigatafla - Misstiru sæti?</Text>
                                <Text className="text-slate-500 text-xs leading-5">Fáðu tilkynningu þegar vinur tekur fram úr þér á stigatöflunni.</Text>
                            </View>
                            <Switch value={pushLeaderboardPass} onValueChange={setPushLeaderboardPass} />
                        </View>
                        
                        {/* Topp 3 */}
                        <View className="p-3 flex-row justify-between items-center mb-3">
                            <View className="flex-1 pr-4">
                                <Text className="font-bold text-slate-800 mb-1">Stigatafla - Topp 3 Í hættu</Text>
                                <Text className="text-slate-500 text-xs leading-5">Fáðu tilkynningu ef þú ert í topp 3 og einhver tekur sætið þitt.</Text>
                            </View>
                            <Switch value={pushLeaderboardTop3} onValueChange={setPushLeaderboardTop3} />
                        </View>
                        
                        <View className="px-3 pb-3">
                            <TouchableOpacity onPress={handleSaveNotifications} className="w-full bg-indigo-50 border border-indigo-100 py-3 rounded-xl items-center shadow-sm">
                                <Text className="text-indigo-600 font-bold text-sm">Vista stillingar tilkynninga</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Change Password */}
                <View className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                    <Text className="font-serif font-black text-2xl mb-6 text-[#1c1917]">Öryggi & lykilorð</Text>
                    
                    <TextInput 
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        secureTextEntry
                        placeholderTextColor="#94a3b8"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl h-14 px-4 font-sans text-base font-semibold text-[#1c1917] shadow-sm mb-4"
                        style={{ paddingVertical: 0, margin: 0, includeFontPadding: false }}
                        placeholder="Núverandi lykilorð"
                    />
                    
                    <TextInput 
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry
                        placeholderTextColor="#94a3b8"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl h-14 px-4 font-sans text-base font-semibold text-[#1c1917] shadow-sm mb-3"
                        style={{ paddingVertical: 0, margin: 0, includeFontPadding: false }}
                        placeholder="Nýtt lykilorð"
                    />
                    <TextInput 
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                        placeholderTextColor="#94a3b8"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl h-14 px-4 font-sans text-base font-semibold text-[#1c1917] shadow-sm mb-2"
                        style={{ paddingVertical: 0, margin: 0, includeFontPadding: false }}
                        placeholder="Staðfesta nýtt lykilorð"
                    />
                    <Text className="text-slate-500 text-sm mb-5">Að minnsta kosti 6 stafir.</Text>

                    <TouchableOpacity onPress={handleSavePassword} className="w-full bg-[#1c1917] py-3.5 rounded-2xl items-center shadow-md">
                        <Text className="text-white font-bold text-base">Vista lykilorð</Text>
                    </TouchableOpacity>
                </View>

                {/* Subscriptions */}
                <View className={`${profile?.is_subscribed ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-200'} p-6 rounded-3xl shadow-sm border mb-6 relative overflow-hidden`}>
                    <View className="flex-row items-center mb-2">
                        <Ionicons name={profile?.is_subscribed ? "diamond" : "lock-closed"} size={24} color={profile?.is_subscribed ? "#4f46e5" : "#64748b"} />
                        <Text className={`font-serif font-black text-2xl ml-3 ${profile?.is_subscribed ? 'text-indigo-900' : 'text-slate-700'}`}>Þín áskrift</Text>
                    </View>
                    
                    <Text className="text-slate-600 font-sans text-sm mb-4">Hér sérðu hvaða pakka þú ert með.</Text>
                    
                    <View className="mb-6 px-4 py-3 bg-white rounded-xl border border-black/5 flex-row items-center justify-between">
                        <Text className="font-bold text-slate-800 text-lg">
                            {profile?.is_subscribed ? 'Þú ert í áskrift' : 'Engin áskrift virk'}
                        </Text>
                        <Ionicons name={profile?.is_subscribed ? "checkmark-circle" : "close-circle"} size={22} color={profile?.is_subscribed ? "#10b981" : "#ef4444"} />
                    </View>
                    
                    <Text className="text-slate-500 font-sans text-sm italic leading-5 mb-4">Eina leiðin til að stýra og kaupa áskrift að safninu er í gegnum vefsíðu okkar. Vinsamlegast farðu á dulur.is í vafra til að breyta áskriftinni þinni.</Text>

                    <TouchableOpacity 
                        onPress={() => Linking.openURL('https://dulur.is')}
                        className={`w-full ${profile?.is_subscribed ? 'bg-indigo-600' : 'bg-slate-800'} py-3.5 rounded-xl items-center shadow-sm flex-row justify-center`}
                    >
                        <Ionicons name="open-outline" size={18} color="white" />
                        <Text className="text-white font-bold text-sm ml-2">Stjórna áskrift á dulur.is</Text>
                    </TouchableOpacity>
                </View>

                {/* Account Deletion */}
                <TouchableOpacity 
                   className="w-full bg-red-50 border border-red-200 p-4 rounded-3xl items-center shadow-sm mb-6 flex-row justify-center"
                   onPress={handleDeleteAccount}
                >
                   <Ionicons name="trash-outline" size={20} color="#ef4444" />
                   <Text className="text-red-500 font-bold text-base font-sans ml-2">Eyða aðgangi</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}
