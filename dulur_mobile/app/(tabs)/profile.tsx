import React, { useEffect, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, TextInput, Alert, ScrollView, Linking, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfileScreen() {
    const [profile, setProfile] = useState<any>(null);
    const [username, setUsername] = useState('');
    const [timerDisabled, setTimerDisabled] = useState(false);
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
        let dbTimerDisabled = null;
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

                if (typeof ns.timer_disabled === 'boolean') {
                    dbTimerDisabled = ns.timer_disabled;
                }
            }
        }
        const savedTimer = await AsyncStorage.getItem('dulur_timer_disabled');
        const finalTimerDisabled = dbTimerDisabled !== null ? dbTimerDisabled : (savedTimer === 'true');
        setTimerDisabled(finalTimerDisabled);
        await AsyncStorage.setItem('dulur_timer_disabled', finalTimerDisabled ? 'true' : 'false');
        DeviceEventEmitter.emit('timer-preference-changed');
    };

    const handleToggleTimer = async (val: boolean) => {
        setTimerDisabled(val);
        await AsyncStorage.setItem('dulur_timer_disabled', val ? 'true' : 'false');
        DeviceEventEmitter.emit('timer-preference-changed');

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            const { data: profileData } = await supabase.from('profiles').select('notification_settings').eq('id', session.user.id).single();
            const currentNS = (profileData?.notification_settings || {}) as Record<string, any>;
            currentNS.timer_disabled = val;
            await supabase.from('profiles').update({ notification_settings: currentNS }).eq('id', session.user.id);
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
        DeviceEventEmitter.emit('profile-updated');
        Alert.alert('Vistað', 'Notandanafn hefur verið uppfært.');
    };

    const handleSaveNotifications = async (key: string, value: boolean) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        let expoPushToken = null;
        const willHaveAnyActive = value === true ||
            (key !== 'push_daily_games' && pushDailyGames) ||
            (key !== 'push_friend_requests' && pushFriendRequests) ||
            (key !== 'push_friend_challenges' && pushFriendChallenges) ||
            (key !== 'push_challenge_results' && pushChallengeResults) ||
            (key !== 'push_monthly_events' && pushMonthlyEvents) ||
            (key !== 'push_leaderboard_pass' && pushLeaderboardPass) ||
            (key !== 'push_leaderboard_top3' && pushLeaderboardTop3);

        if (willHaveAnyActive) {
            expoPushToken = await registerForPushNotificationsAsync();
        }

        const currentSettings = {
            push_daily_games: pushDailyGames,
            push_friend_requests: pushFriendRequests,
            push_friend_challenges: pushFriendChallenges,
            push_challenge_results: pushChallengeResults,
            push_monthly_events: pushMonthlyEvents,
            push_leaderboard_pass: pushLeaderboardPass,
            push_leaderboard_top3: pushLeaderboardTop3
        };

        const updateData: any = {
            notification_settings: {
                ...currentSettings,
                [key]: value
            }
        };

        if (expoPushToken) updateData.expo_push_token = expoPushToken;

        const { error } = await supabase.from('profiles').update(updateData).eq('id', session.user.id);

        if (error) {
            console.error('Error updating notification settings:', error);
            Alert.alert('Villa', 'Gat ekki vistað stillingar vegna ytri kerfisvillu. Endilega reyndu aftur.');
        }
    };


    async function registerForPushNotificationsAsync() {
        let token;

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                Alert.alert('Villa', 'Þú verður að leyfa tilkynningar í stillingum símans til að þetta virki!');
                return undefined;
            }

            const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

            try {
                token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
            } catch (e) {
                console.error(e);
            }
        } else {
            console.log('Must use physical device for Push Notifications');
        }

        return token;
    }

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
                {
                    text: 'Eyða', style: 'destructive', onPress: async () => {
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
                    }
                }
            ]
        );
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.replace('/login');
    };

    return (
        <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top']}>
            <View className="pt-6 pb-4 bg-[#FAFAFA] border-b border-slate-100 px-6 flex-row items-baseline justify-between z-10">
                <View style={{ flex: 1 }} />
                <Text 
                    className="text-[32px] md:text-[36px] font-black font-serif tracking-tight text-[#1e1b4b] text-center mb-1"
                >
                    Stillingar
                </Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <TouchableOpacity onPress={handleLogout}>
                        <Text className="text-red-500 font-bold text-[15px]">Skrá út</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView className="flex-1 px-4 mt-6" contentContainerStyle={{ paddingBottom: 150, alignSelf: 'center', width: '100%', maxWidth: 600 }}>
                {/* Statistics Button */}
                <TouchableOpacity 
                    className="bg-indigo-600 rounded-2xl p-4 items-center flex-row justify-center shadow-md mb-8 shadow-indigo-600/20 active:bg-indigo-700 transition-colors"
                    onPress={() => router.push('/stats')}
                >
                    <Ionicons name="bar-chart" size={20} color="#ffffff" />
                    <Text className="text-white font-black text-[18px] ml-2 tracking-wide">Skoða Tölfræði</Text>
                </TouchableOpacity>

                {/* Account Details */}
                <Text className="ml-4 mb-2 text-[13px] font-bold text-slate-500 uppercase tracking-widest">Aðgangur</Text>
                <View className="bg-white rounded-2xl border border-slate-100 mb-8 overflow-hidden shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8 }}>
                    <View className="p-4 border-b border-gray-50 flex-col gap-3">
                        <Text className="font-semibold text-[16px] text-slate-800">Notandanafn</Text>
                        <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                            <Ionicons name="pencil" size={16} color="#64748b" />
                            <TextInput
                                value={username}
                                onChangeText={setUsername}
                                placeholderTextColor="#94a3b8"
                                className="flex-1 ml-3 font-semibold text-[#1c1917] text-[16px]"
                                placeholder={profile?.username || 'Nýtt notandanafn...'}
                                autoCapitalize="none"
                                style={{ paddingVertical: 0, margin: 0 }}
                            />
                        </View>
                    </View>
                    <TouchableOpacity onPress={handleSaveUsername} className="p-4 flex-row justify-center items-center gap-2 bg-indigo-50/30 active:bg-indigo-50">
                        <Ionicons name="checkmark-circle" size={18} color="#4f46e5" />
                        <Text className="text-indigo-600 font-bold text-[15px]">Vista Breytingar</Text>
                    </TouchableOpacity>
                </View>

                {/* Leikjastillingar */}
                <Text className="ml-4 mb-2 text-[13px] font-bold text-slate-500 uppercase tracking-widest">Leikjastillingar</Text>
                <View className="bg-white rounded-2xl border border-slate-100 mb-8 overflow-hidden shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8 }}>
                    <View className="p-4 flex-row justify-between items-center bg-white">
                        <View className="flex-1 pr-4">
                            <Text className="font-semibold text-slate-800 text-[16px]">Slökkva á klukku</Text>
                            <Text className="text-[12px] text-slate-400 mt-1">Felur leikjaklukkuna í öllum leikjum svo að þú getur spilað í rólegheitum og á þínum eigin hraða.</Text>
                        </View>
                        <Switch value={timerDisabled} onValueChange={handleToggleTimer} trackColor={{ true: '#4f46e5' }} />
                    </View>
                </View>

                {/* Notifications Group */}
                <Text className="ml-4 mb-2 text-[13px] font-bold text-slate-500 uppercase tracking-widest">Tilkynningar í síma</Text>
                <View className="bg-white rounded-2xl border border-slate-100 mb-8 overflow-hidden shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8 }}>

                    <View className="p-4 border-b border-gray-50 flex-row justify-between items-center bg-white">
                        <View className="flex-1 pr-4">
                            <Text className="font-semibold text-slate-800 text-[16px]">Daglegir leikir</Text>
                        </View>
                        <Switch value={pushDailyGames} onValueChange={(val) => { setPushDailyGames(val); handleSaveNotifications('push_daily_games', val); }} trackColor={{ true: '#4f46e5' }} />
                    </View>

                    <View className="p-4 border-b border-gray-50 flex-row justify-between items-center bg-white">
                        <View className="flex-1 pr-4">
                            <Text className="font-semibold text-slate-800 text-[16px]">Vinabeiðnir</Text>
                        </View>
                        <Switch value={pushFriendRequests} onValueChange={(val) => { setPushFriendRequests(val); handleSaveNotifications('push_friend_requests', val); }} trackColor={{ true: '#4f46e5' }} />
                    </View>

                    <View className="p-4 border-b border-gray-50 flex-row justify-between items-center bg-white">
                        <View className="flex-1 pr-4">
                            <Text className="font-semibold text-slate-800 text-[16px]">Nýjar áskoranir</Text>
                        </View>
                        <Switch value={pushFriendChallenges} onValueChange={(val) => { setPushFriendChallenges(val); handleSaveNotifications('push_friend_challenges', val); }} trackColor={{ true: '#4f46e5' }} />
                    </View>

                    <View className="p-4 border-b border-gray-50 flex-row justify-between items-center bg-white">
                        <View className="flex-1 pr-4">
                            <Text className="font-semibold text-slate-800 text-[16px]">Úrslit áskorana</Text>
                        </View>
                        <Switch value={pushChallengeResults} onValueChange={(val) => { setPushChallengeResults(val); handleSaveNotifications('push_challenge_results', val); }} trackColor={{ true: '#4f46e5' }} />
                    </View>

                    <View className="p-4 border-b border-gray-50 flex-row justify-between items-center bg-white">
                        <View className="flex-1 pr-4">
                            <Text className="font-semibold text-slate-800 text-[16px]">Nýir viðburðir</Text>
                        </View>
                        <Switch value={pushMonthlyEvents} onValueChange={(val) => { setPushMonthlyEvents(val); handleSaveNotifications('push_monthly_events', val); }} trackColor={{ true: '#4f46e5' }} />
                    </View>

                    <View className="p-4 border-b border-gray-50 flex-row justify-between items-center bg-white">
                        <View className="flex-1 pr-4">
                            <Text className="font-semibold text-slate-800 text-[16px]">Misstir sæti á töflu</Text>
                        </View>
                        <Switch value={pushLeaderboardPass} onValueChange={(val) => { setPushLeaderboardPass(val); handleSaveNotifications('push_leaderboard_pass', val); }} trackColor={{ true: '#4f46e5' }} />
                    </View>
                </View>

                {/* Change Password */}
                <Text className="ml-4 mb-2 text-[13px] font-bold text-slate-500 uppercase tracking-widest">Öryggi</Text>
                <View className="bg-white rounded-2xl border border-slate-100 mb-8 overflow-hidden shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8 }}>
                    <View className="p-4 border-b border-gray-50 flex-col">
                        <TextInput
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                            secureTextEntry
                            placeholderTextColor="#94a3b8"
                            className="font-semibold text-[#1c1917] text-[16px] h-10 border-b border-slate-100 mb-2"
                            placeholder="Núverandi lykilorð"
                        />
                        <TextInput
                            value={newPassword}
                            onChangeText={setNewPassword}
                            secureTextEntry
                            placeholderTextColor="#94a3b8"
                            className="font-semibold text-[#1c1917] text-[16px] h-10 border-b border-slate-100 mb-2"
                            placeholder="Nýtt lykilorð"
                        />
                        <TextInput
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                            placeholderTextColor="#94a3b8"
                            className="font-semibold text-[#1c1917] text-[16px] h-10"
                            placeholder="Staðfesta nýtt lykilorð"
                        />
                    </View>
                    <TouchableOpacity onPress={handleSavePassword} className="p-4 flex-row justify-center bg-slate-50/50">
                        <Text className="text-indigo-600 font-bold text-[15px]">Uppfæra Lykilorð</Text>
                    </TouchableOpacity>
                </View>

                {/* Subscriptions */}
                <Text className="ml-4 mb-2 text-[13px] font-bold text-slate-500 uppercase tracking-widest">Áskrift</Text>
                <View className="bg-white rounded-2xl border border-slate-100 mb-8 overflow-hidden shadow-sm" style={{ shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8 }}>
                    <View className="p-4 flex-row items-center justify-between border-b border-gray-50 bg-white">
                        <View className="flex-row items-center">
                            <Ionicons name={profile?.is_subscribed ? "diamond" : "lock-closed"} size={20} color={profile?.is_subscribed ? "#4f46e5" : "#64748b"} />
                            <Text className={`font-semibold text-[16px] ml-3 ${profile?.is_subscribed ? 'text-indigo-900' : 'text-slate-700'}`}>Staða Áskriftar</Text>
                        </View>
                        <Text className="font-bold text-slate-800 text-[15px]">
                            {profile?.is_subscribed ? 'Virk áskrift' : 'Engin'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => Linking.openURL('https://dulur.is')}
                        className="p-4 flex-row justify-center items-center bg-slate-50/50"
                    >
                        <Ionicons name="open-outline" size={16} color="#4f46e5" />
                        <Text className="text-indigo-600 font-bold text-[15px] ml-2">Stjórna á dulur.is</Text>
                    </TouchableOpacity>
                </View>

                {/* Account Deletion */}
                <TouchableOpacity
                    className="bg-white rounded-2xl border border-red-100 p-4 items-center shadow-sm mb-6 flex-row justify-center"
                    onPress={handleDeleteAccount}
                >
                    <Text className="text-red-500 font-bold text-[16px]">Eyða aðgangi</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}
