import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Dimensions, Modal, ScrollView, Animated as NativeAnimated, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter, AppState, AppStateStatus } from 'react-native';
import { Animated } from 'react-native';

interface MobileGameLayoutProps {
    gameId: string;
    gameTitle: string;
    isGameOver?: boolean;
    scrollEnabled?: boolean;
    onBack: () => void;
    children: React.ReactNode;
}

export const MobileGameLayout: React.FC<MobileGameLayoutProps> = ({ gameId, gameTitle, isGameOver, scrollEnabled = true, onBack, children }) => {
    const [top3, setTop3] = useState<any[]>([]);
    const [stats, setStats] = useState<{ played: number; won: number; avgTime: number } | null>(null);
    const [showStats, setShowStats] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [timerActive, setTimerActive] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [timerKey, setTimerKey] = useState<string | null>(null);
    const [totalXp, setTotalXp] = useState<number>(0);
    const [xpBounce, setXpBounce] = useState(false);
    const { width } = useWindowDimensions();
    const isPad = width >= 768;

    const xpScale = React.useRef(new Animated.Value(1)).current;

    const xpStyle = {
        transform: [{ scale: xpScale }]
    };

    const fetchGameData = useCallback(async () => {
        try {
            let leaderboardType = gameId;
            if (gameId.startsWith('sudoku')) leaderboardType = 'sudoku';

            const { data: { user } } = await supabase.auth.getUser();

            const [leaderboardRes, profileRes, myResultsRes] = await Promise.all([
                supabase.rpc('get_monthly_game_leaderboard', { p_game_type: leaderboardType, p_limit: 3 }),
                user ? supabase.from('profiles').select('xp').eq('id', user.id).single() : Promise.resolve({ data: null }),
                user ? supabase.from('game_results').select('won, time_taken_seconds').eq('user_id', user.id).eq('game_type', gameId) : Promise.resolve({ data: null })
            ]);
            
            if (leaderboardRes.error) {
                console.log('Error fetching top3:', leaderboardRes.error);
            }
            
            if (leaderboardRes.data) setTop3(leaderboardRes.data);

            if (profileRes.data) setTotalXp(profileRes.data.xp || 0);

            const myResults = myResultsRes.data;
            if (myResults && myResults.length > 0) {
                const played = myResults.length;
                const won = myResults.filter(r => r.won).length;
                const totalTime = myResults.reduce((acc, curr) => acc + (curr.time_taken_seconds || 0), 0);
                const avgTime = Math.round(totalTime / played);
                setStats({ played, won, avgTime });
            }
        } catch (error) {
            console.error("Layout fetch failed:", error);
        }
    }, [gameId]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('xp-earned', (earned: number) => {
            setTotalXp(prev => prev + earned);
            setXpBounce(true);
            
            Animated.sequence([
                Animated.timing(xpScale, { toValue: 1.3, duration: 150, useNativeDriver: true }),
                Animated.timing(xpScale, { toValue: 1, duration: 250, useNativeDriver: true })
            ]).start();
            
            setTimeout(() => setXpBounce(false), 800);

            // Re-fetch leaderboard with slight delay to ensure DB triggers have finished
            setTimeout(() => fetchGameData(), 1000);
        });

        const sub2 = DeviceEventEmitter.addListener('refresh-stats', () => {
            fetchGameData();
        });

        return () => {
            sub.remove();
            sub2.remove();
        };
    }, [fetchGameData, xpScale]);

    useEffect(() => {
        fetchGameData();
    }, [fetchGameData]);

    // Timer Identity & Persistence
    useEffect(() => {
        let isMounted = true;
        async function initTimer() {
            if (isMounted) {
                setElapsedTime(0);
                setTimerActive(false);
            }

            const { data } = await supabase.auth.getUser();
            const uid = data?.user?.id || 'anon';
            const date = new Date().toLocaleDateString('en-CA');
            const key = `timer_${uid}_${gameId}_${date}`;
            
            if (isMounted) setTimerKey(key);

            const saved = await AsyncStorage.getItem(key);
            if (saved && parseInt(saved, 10) > 0) {
                if (isMounted) {
                    setElapsedTime(parseInt(saved, 10));
                    if (!isGameOver) {
                        setTimerActive(true);
                    }
                }
            } else {
                if (isMounted && !isGameOver) {
                    setTimerActive(true);
                }
            }
        }
        initTimer();
        return () => { isMounted = false; };
    }, [gameId]);

    // Timer Event Listener (Start/Stop)
    useEffect(() => {
        const handleStart = () => { if (!isGameOver) setTimerActive(true); };
        const handleStop = () => { setTimerActive(false); };
        const handleClear = () => { setElapsedTime(0); setTimerActive(false); if (timerKey) AsyncStorage.removeItem(timerKey); };

        const sub1 = DeviceEventEmitter.addListener('start-timer', handleStart);
        const sub2 = DeviceEventEmitter.addListener('stop-timer', handleStop);
        const sub3 = DeviceEventEmitter.addListener('clear-timer', handleClear);

        return () => {
            sub1.remove(); sub2.remove(); sub3.remove();
        };
    }, [isGameOver, timerKey]);

    // Timer Ticking & Saving
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (timerActive && !isGameOver && timerKey) {
            interval = setInterval(() => {
                setElapsedTime(prev => {
                    const next = prev + 1;
                    if (next % 5 === 0) {
                        AsyncStorage.setItem(timerKey, next.toString());
                    }
                    return next;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timerActive, isGameOver, timerKey]);

    // Save timer on App backgrounding
    useEffect(() => {
        const handleAppState = (nextState: AppStateStatus) => {
            if (nextState.match(/inactive|background/) && timerKey && elapsedTime > 0) {
                AsyncStorage.setItem(timerKey, elapsedTime.toString());
            }
        };
        const subscription = AppState.addEventListener('change', handleAppState);
        return () => subscription.remove();
    }, [timerKey, elapsedTime]);

    // Auto-pause or auto-start if GameOver changes
    useEffect(() => {
        if (isGameOver) {
            setTimerActive(false);
            if (timerKey && elapsedTime > 0) AsyncStorage.setItem(timerKey, elapsedTime.toString());
        } else if (timerKey) {
            setTimerActive(true);
        }
    }, [isGameOver, timerKey]);

    // Save timer exactly on unmount / switch
    useEffect(() => {
        return () => {
            if (timerKey && elapsedTime > 0) {
                AsyncStorage.setItem(timerKey, elapsedTime.toString());
            }
        };
    }, [timerKey, elapsedTime]);

    const formatTime = (seconds: number) => {
        if (!seconds) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#FAFAFA' }}>

            <ScrollView 
                contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={scrollEnabled}
            >
                {/* Header Backdrop Gradient */}
                <View className="absolute top-0 w-full h-[150px] opacity-40 mix-blend-multiply pointer-events-none">
                    <View className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-indigo-50/80 to-transparent" />
                </View>

                {/* Header */}
                <View className={`flex-row items-center justify-between px-4 pt-4 pb-2 w-full self-center max-w-[500px] z-10 ${isPad ? 'mt-16' : 'mt-6'}`}>
                    <View className="flex-1 items-start">
                        <TouchableOpacity onPress={onBack} activeOpacity={0.7} className="flex-row items-center bg-white border border-slate-200/60 px-3.5 py-2 rounded-[16px] shadow-sm">
                            <Ionicons name="chevron-back" size={18} color="#64748b" />
                            <Text className="text-[15px] font-bold text-slate-500 ml-1 tracking-wide">Leikir</Text>
                        </TouchableOpacity>
                    </View>
                    
                    <View className="flex-[2] items-center">
                        <Text 
                            className="text-4xl sm:text-5xl font-black font-serif uppercase tracking-widest text-indigo-950 text-center"
                            numberOfLines={1}
                            adjustsFontSizeToFit
                        >
                            {gameTitle}
                        </Text>
                    </View>
                    
                    <View className="flex-1 items-end justify-center">
                        {totalXp > 0 && (
                            <View pointerEvents="none">
                                <Animated.View style={[xpStyle]} className={`flex-row items-center gap-1.5 bg-[#EAB308] border ${xpBounce ? 'border-[#FDE047]' : 'border-[#CA8A04]'} px-3 py-1.5 rounded-[12px] shadow-sm`}>
                                    <Ionicons name="star" size={12} color="white" />
                                    <Text className="text-white font-black text-xs">{totalXp}</Text>
                                </Animated.View>
                            </View>
                        )}
                    </View>
                </View>

                {/* Mobile Timer Pill - Below Title (Matches Mobile Web Layout) */}
                <View className="w-full flex-row justify-center items-center gap-3 mt-16 mb-2 md:mb-4 md:mt-20">
                    <View className="flex-row items-center bg-[#EEF2FF] border border-[#E0E7FF] px-4 py-2 rounded-full gap-2 shadow-sm">
                        <Ionicons name="time-outline" size={18} color="#4338CA" />
                        <Text className="text-[#4338CA] font-mono text-base font-bold tracking-widest">{formatTime(elapsedTime)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowStats(true)} className="w-10 h-10 bg-white border border-gray-200 rounded-full items-center justify-center shadow-sm">
                        <Ionicons name="stats-chart" size={18} color="#64748b" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setShowHelp(true)} className="w-10 h-10 bg-white border border-gray-200 rounded-full items-center justify-center shadow-sm">
                        <Ionicons name="information" size={24} color="#64748b" />
                    </TouchableOpacity>
                </View>

                {/* Injected Game Child */}
                <View className="w-full flex-1 min-h-[400px]">
                    {children}
                </View>

            </ScrollView>

            {/* Statistics Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={showStats}
                onRequestClose={() => setShowStats(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/60 px-4">
                    <View className="bg-white rounded-3xl w-full max-w-[400px] p-6 shadow-xl border border-gray-100 mb-8 mt-8">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-2xl font-black font-serif text-[#1A1A1B]">Tölfræði</Text>
                            <TouchableOpacity onPress={() => setShowStats(false)} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                                <Ionicons name="close" size={20} color="#1A1A1B" />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView showsVerticalScrollIndicator={false} className="w-full">
                            {/* User Statistics */}
                            <View className="w-full pb-4">
                                <View className="flex-row items-center gap-2 border-b border-gray-200 pb-1.5 mb-3">
                                    <Ionicons name="analytics" size={16} color="#4f46e5" />
                                    <Text className="font-black text-sm uppercase tracking-wider text-slate-900">Tölfræði þín</Text>
                                </View>
                                <View className="flex-row items-center justify-between gap-2">
                                    <View className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-200 items-center shadow-sm">
                                        <Text className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-0.5">Spilaðir</Text>
                                        <Text className="text-xl font-black text-slate-900">{stats?.played || 0}</Text>
                                    </View>
                                    <View className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-200 items-center shadow-sm">
                                        <Text className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-0.5">Sigrar</Text>
                                        <Text className="text-xl font-black text-[#16a34a]">{stats?.won || 0}</Text>
                                    </View>
                                    <View className="flex-1 bg-gray-50 p-3 rounded-xl border border-gray-200 items-center shadow-sm">
                                        <Text className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-0.5">Meðaltími</Text>
                                        <Text className="text-xl font-black text-slate-900">{formatTime(stats?.avgTime || 0)}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Top 3 Leaderboard */}
                            {top3.length > 0 && (
                                <View className="w-full mt-2">
                                    <View className="flex-row items-center gap-2 border-b border-gray-200 pb-1.5 mb-3">
                                        <Ionicons name="trophy" size={16} color="#eab308" />
                                        <Text className="font-black text-sm uppercase tracking-wider text-slate-900">Mánaðar Topp 3</Text>
                                    </View>
                                    <View className="flex-col gap-2">
                                        {top3.map((res, idx) => {
                                            const colors = ['#eab308', '#94a3b8', '#b45309']; // Gold, Silver, Bronze
                                            return (
                                                <View key={idx} className="flex-row items-center justify-between bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                                                    <View className="flex-row items-center gap-2.5">
                                                        <View className="w-6 h-6 rounded-full bg-[#FAFAFA] border border-gray-200 items-center justify-center">
                                                            {idx < 3 ? <Ionicons name="medal" size={14} color={colors[idx]} /> : <Text className="font-black text-slate-500 text-[10px]">{idx + 1}</Text>}
                                                        </View>
                                                        <Text className="text-sm font-bold text-slate-900">
                                                            {/* @ts-ignore */}
                                                            {res.username?.split('_')[0] || 'Nafnlaus'}
                                                        </Text>
                                                    </View>
                                                    <View className="items-end gap-1">
                                                        <Text className="text-xs font-black text-slate-500">{res.score} XP</Text>
                                                        <View className="flex-row items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-full">
                                                            <Ionicons name="time" size={10} color="#4f46e5" />
                                                            <Text className="text-[10px] font-bold text-[#4f46e5]">{formatTime(res.time_taken_seconds)}</Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            )
                                        })}
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Help Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={showHelp}
                onRequestClose={() => setShowHelp(false)}
            >
                <View className="flex-1 justify-center items-center bg-black/60 px-4">
                    <View className="bg-white rounded-3xl w-full max-w-[400px] p-6 shadow-xl border border-gray-100">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-2xl font-black font-serif text-[#1A1A1B]">Leiðbeiningar</Text>
                            <TouchableOpacity onPress={() => setShowHelp(false)} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                                <Ionicons name="close" size={20} color="#1A1A1B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} className="max-h-[400px]">
                            {gameId.startsWith('krossreikningur') && (
                                <View className="pb-4">
                                    <Text className="text-gray-600 font-medium mb-4 text-base">Leystu dæmin með því að setja inn tölurnar sem vantar.</Text>
                                    <View className="space-y-3 mb-6">
                                        <Text className="text-gray-600 text-sm">• Dragðu eða smelltu á tölurnar að neðan til að fylla í auðu reitina.</Text>
                                        <Text className="text-gray-600 text-sm">• Dæmin verða að ganga upp bæði lárétt og lóðrétt.</Text>
                                        <Text className="text-gray-600 text-sm">• Dæmin eru reiknuð frá vinstri til hægri, og ofan frá og niður.</Text>
                                        <Text className="text-gray-600 text-sm">• <Text className="font-bold text-gray-800">Stig:</Text> Þú færð 100 stig (XP) fyrir að vinna leikinn, og meira fyrir stærri borð.</Text>
                                    </View>
                                </View>
                            )}
                            {gameId.startsWith('ordla') && (
                                <View className="pb-4">
                                    <Text className="text-gray-600 font-medium mb-4 text-base">Giskaðu á orðið í 6 tilraunum.</Text>
                                    <View className="space-y-3 mb-6">
                                        <Text className="text-gray-600 text-sm">• Einungis er hægt að giska á gilt íslenskt orð.</Text>
                                        <Text className="text-gray-600 text-sm">• <Text className="font-bold text-gray-800">Stig:</Text> Þú færð 100 stig (XP) fyrir að vinna leikinn. Þú færð fleiri stig fyrir 6 stafa og 7 stafa orð: 6 stafir gefa +20, 7 stafir gefa +40.</Text>
                                        <Text className="text-gray-600 text-sm">• <Text className="font-bold text-gray-800">Bónus stig:</Text> Ef þú klárar leikinn á undir 6 tilraunum færðu 15 stig fyrir hverja tilraun sem þú átt eftir.</Text>
                                        <Text className="text-gray-600 text-sm">• <Text className="font-bold text-gray-800">Stig þrátt fyrir tap:</Text> Það er hægt að fá stig, jafnvel þó að þú tapar. Þú færð <Text className="font-bold text-yellow-600">5 stig</Text><Text className="font-bold text-green-600"> eða meira </Text>fyrir hvern <Text className="font-bold text-yellow-600">gulan</Text><Text className="font-bold text-yellow-400"> eða grænan staf</Text> sem sárabætur!</Text>
                                    </View>
                                    <View className="space-y-4">
                                        <View>
                                            <View className="flex-row gap-1.5 mb-1.5">
                                                <View className="w-8 h-8 items-center justify-center bg-green-500 rounded flex-shrink-0"><Text className="text-white font-bold text-lg">G</Text></View>
                                                <View className="w-8 h-8 items-center justify-center border-2 border-gray-300 rounded flex-shrink-0"><Text className="text-gray-500 font-bold text-lg">A</Text></View>
                                                <View className="w-8 h-8 items-center justify-center border-2 border-gray-300 rounded flex-shrink-0"><Text className="text-gray-500 font-bold text-lg">M</Text></View>
                                            </View>
                                            <Text className="text-xs text-gray-500">Grænn stafur er á réttum stað í orðinu.</Text>
                                        </View>
                                        <View>
                                            <View className="flex-row gap-1.5 mb-1.5">
                                                <View className="w-8 h-8 items-center justify-center border-2 border-gray-300 rounded flex-shrink-0"><Text className="text-gray-500 font-bold text-lg">T</Text></View>
                                                <View className="w-8 h-8 items-center justify-center bg-yellow-500 rounded flex-shrink-0"><Text className="text-white font-bold text-lg">A</Text></View>
                                                <View className="w-8 h-8 items-center justify-center border-2 border-gray-300 rounded flex-shrink-0"><Text className="text-gray-500 font-bold text-lg">L</Text></View>
                                            </View>
                                            <Text className="text-xs text-gray-500">Gulur stafur er í orðinu en á vitlausum stað.</Text>
                                        </View>
                                        <View>
                                            <View className="flex-row gap-1.5 mb-1.5">
                                                <View className="w-8 h-8 items-center justify-center bg-gray-400 rounded flex-shrink-0"><Text className="text-white font-bold text-lg">B</Text></View>
                                                <View className="w-8 h-8 items-center justify-center border-2 border-gray-300 rounded flex-shrink-0"><Text className="text-gray-500 font-bold text-lg">I</Text></View>
                                                <View className="w-8 h-8 items-center justify-center border-2 border-gray-300 rounded flex-shrink-0"><Text className="text-gray-500 font-bold text-lg">L</Text></View>
                                            </View>
                                            <Text className="text-xs text-gray-500">Grár stafur er ekki í orðinu.</Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                            {gameId.startsWith('stafarugl') && (
                                <View className="pb-4">
                                    <View className="space-y-2 mb-6">
                                        <Text className="text-gray-600 text-sm">• Dragðu yfir stafina til að merkja orð.</Text>
                                        <Text className="text-gray-600 text-sm">• Orðin geta farið upp, niður, til hægri, til vinstri eða á ská.</Text>
                                        <Text className="text-gray-600 text-sm">• <Text className="font-bold text-gray-800">Stig:</Text> Þú færð 100 stig (XP) ef þú finnur öll orðin.</Text>
                                    </View>
                                </View>
                            )}
                            {gameId.startsWith('straumur') && (
                                <View className="pb-4">
                                    <View className="space-y-4 mb-6">
                                        <Text className="text-gray-600 text-sm">• Dragðu fingurinn yfir stafina til að finna orðin.</Text>
                                        <Text className="text-gray-600 text-sm">• Öll orðin tengjast þemanu. Eitt <Text className="font-bold">Straumorð</Text> snertir tvo ystu kanta rammans.</Text>
                                        <Text className="text-gray-600 text-sm">• Enginn stafur er notaður oftar en einu sinni.</Text>
                                        <View className="bg-muted p-4 rounded-lg mt-4 bg-gray-50 border border-gray-100">
                                            <Text className="font-bold mb-2 uppercase text-xs tracking-wider text-muted-foreground text-gray-400">Verðlaun:</Text>
                                            <Text className="text-sm font-medium text-gray-600">Þú færð <Text className="font-bold text-[#1A1A1B]">100 XP</Text> fyrir að leysa þrautina. Ef þú notar vísbendingu lækkar stigið um 10 XP í hvert skipti.</Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                            {gameId.startsWith('sudoku') && (
                                <View className="pb-4">
                                    <View className="space-y-4 mb-6">
                                        <Text className="text-gray-600 text-sm">Fylltu reitina þannig að hver röð, dálkur og 3x3 kassi innihaldi tölurnar 1-9 nákvæmlega einu sinni.</Text>
                                        <Text className="text-gray-600 text-sm">• Notaðu "Krot" tólið til að taka niður litlar tölur sem gætu verið réttar í ákveðnum reit</Text>
                                        <Text className="text-gray-600 text-sm">• Ef þú hefur slegið inn absolute tölu sem er rétt, verður sú tala sjálfkrafa tekin úr krotunum þínum í bæði dálkum, röðum og 3x3 kassanum</Text>
                                        <Text className="text-gray-600 text-sm">• Þú hefur einungis 3 Mistök. Um leið og þú gerir 3 mistök, taparðu leiknum</Text>
                                        <View className="bg-muted p-4 rounded-lg mt-4 bg-gray-50 border border-gray-100">
                                            <Text className="font-bold mb-2 uppercase text-xs tracking-wider text-muted-foreground text-gray-400">Verðlaun:</Text>
                                            <View className="flex-row justify-between">
                                                <Text className="text-sm font-medium">Létt:</Text>
                                                <Text className="text-green-600 font-bold">+100 XP</Text>
                                            </View>
                                            <View className="flex-row justify-between">
                                                <Text className="text-sm font-medium">Miðlungs:</Text>
                                                <Text className="text-yellow-600 font-bold">+200 XP</Text>
                                            </View>
                                            <View className="flex-row justify-between">
                                                <Text className="text-sm font-medium">Erfitt:</Text>
                                                <Text className="text-red-600 font-bold">+350 XP</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            )}
                            {gameId.startsWith('hengimadur') && (
                                <View className="pb-4">
                                    <Text className="text-gray-600 font-medium mb-4 text-base">Giskaðu á orðið staf fyrir staf.</Text>
                                    <View className="space-y-3 mb-6">
                                        <Text className="text-gray-600 text-sm">• Þú þarft að giska á alla réttu stafina í 6 tilraunum eða færri til að vinna.</Text>
                                        <Text className="text-gray-600 text-sm">• <Text className="font-bold text-gray-800">Stig:</Text> Þú færð 100 stig (XP) fyrir að vinna. Þú færð fleiri stig fyrir hærri erfiðleikastig: Miðlungs gefur +20, Erfitt gefur +40.</Text>
                                        <Text className="text-gray-600 text-sm">• <Text className="font-bold text-gray-800">Bónus stig:</Text> Ef þú vinnur leikinn í færri en 6 tilraunum færðu +10 stig fyrir hverja tilraun sem þú áttir eftir.</Text>
                                        <Text className="text-gray-600 text-sm">• <Text className="font-bold text-gray-800">Stig þrátt fyrir tap:</Text> Ef að þú tapar þá færðu samt +5 stig fyrir hvern staf sem þú náðir rétt.</Text>
                                    </View>
                                </View>
                            )}
                            {gameId.startsWith('krossgata') && (
                                <View className="pb-4">
                                    <View className="space-y-2 mb-6">
                                        <Text className="text-gray-600 text-sm">• Smelltu á reit til að sjá vísbendinguna sem á við hann.</Text>
                                        <Text className="text-gray-600 text-sm">• Skrifaðu svar við vísbendingunni lárétt eða lóðrétt.</Text>
                                        <Text className="text-gray-600 text-sm">• Litlu tölurnar í horninu hjálpa þér að staðsetja orð.</Text>
                                        <Text className="text-gray-600 text-sm">• Öll orð verða að vera rétt til að sigra gátuna!</Text>
                                        <Text className="text-gray-600 text-sm">• <Text className="font-bold text-gray-800">Verðlaun dagsins:</Text> Þú færð 100 XP fyrir að klára gátuna. Það er ekki hægt að tapa, svo taktu þér bara þann tíma sem þú þarft!</Text>
                                    </View>
                                </View>
                            )}
                            {gameId.startsWith('tengingar') && (
                                <View className="pb-4">
                                    <View className="space-y-2 mb-6">
                                        <Text className="text-gray-600 text-sm">• Finndu 4 hópa úr 4 orðum sem deila sameiginlegri tengingu.</Text>
                                        <Text className="text-gray-600 text-sm">• Veldu 4 orð sem þú telur að passa saman og smelltu á <Text className="font-bold text-gray-800">Giska</Text>.</Text>
                                        <Text className="text-gray-600 text-sm">• Þú hefur einungis 4 tilraunir til að finna allar tengingarnar. Ef þú giskar 4x vitlaust þá taparðu leiknum</Text>
                                        <Text className="text-gray-600 text-sm">• <Text className="font-bold text-gray-800">Stig:</Text> Þú færð 100 stig (XP) fyrir að sigra leikinn. Ef þú áttir einhverjar tilraunir eftir þá færðu auka 10 stig fyrir hverja tilraun sem var eftir. Ef þú tapar leiknum þá geturðu samt fengið 10 stig fyrir hverja tengingu sem þú fannst</Text>
                                    </View>
                                </View>
                            )}
                            {gameId.startsWith('sprengjuleit') && (
                                <View className="pb-4">
                                    <View className="space-y-4 mb-6">
                                        <Text className="text-gray-600 text-sm">• Markmiðið er að afhjúpa alla reitina á borðinu án þess að smella á sprengju.</Text>
                                        <Text className="text-gray-600 text-sm">• Ef reitur sýnir tölu (t.d. 2) þá þýðir það að nákvæmlega tvær sprengjur liggja í næstu 8 reitum í kringum hann.</Text>
                                        <Text className="text-gray-600 text-sm">• Haltu inni til að setja niður flagg á þá reiti sem þú ert viss um að feli sprengju. Tölurnar að ofan sýna hversu margar sprengjur þú átt eftir að finna.</Text>
                                        <View className="bg-muted p-4 rounded-lg mt-4 bg-gray-50 border border-gray-100">
                                            <Text className="font-bold mb-2 uppercase text-xs tracking-wider text-muted-foreground text-gray-400">Verðlaun:</Text>
                                            <Text className="text-sm font-medium text-gray-600">Þú færð meira XP eftir því sem þú leysir þrautina hraðar. Þú byrjar með möguleika á <Text className="font-bold text-[#1A1A1B]">200 XP</Text>, en missir 1 stig á hverjum þremur sekúndum sem líða! Lágmark 100 XP fyrir sigur eða 0 XP ef þú smellir á sprengju.</Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                            {gameId.startsWith('kviss') && (
                                <View className="pb-4">
                                    <View className="space-y-4 mb-6">
                                        <Text className="text-gray-600 text-sm">• Svaraðu 5 spurningum eins hratt og rétt og þú getur.</Text>
                                        <Text className="text-gray-600 text-sm">• Þú hefur <Text className="font-bold text-gray-800">10 sekúndur</Text> til að svara hverri spurningu. Ef tíminn rennur út telst svarið rangt.</Text>
                                        <View className="bg-muted p-4 rounded-lg mt-4 bg-gray-50 border border-gray-100">
                                            <Text className="font-bold mb-2 uppercase text-xs tracking-wider text-muted-foreground text-gray-400">Verðlaun:</Text>
                                            <Text className="text-sm font-medium text-gray-600">Þú færð <Text className="font-bold text-[#1A1A1B]">30 XP</Text> fyrir hvert rétt svar (að hámarki 150 XP).</Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                            {gameId.startsWith('minnisspil') && (
                                <View className="pb-4">
                                    <View className="space-y-4 mb-6">
                                        <Text className="text-gray-600 text-sm">• Markmiðið er að finna öll pörin í færstu mögulegu tilraunum.</Text>
                                        <Text className="text-gray-600 text-sm">• Smelltu á tvö spil til að snúa þeim við.</Text>
                                        <Text className="text-gray-600 text-sm">• Ef spilin sýna <Text className="font-bold text-[#1A1A1B]">sama táknið</Text> festast þau uppi sem par!</Text>
                                        <Text className="text-gray-600 text-sm">• Ef spilin eru ekki eins munu þau snúast aftur við. Mundu vel hvar táknin liggja til að reyna aftur seinna.</Text>
                                        <View className="bg-muted p-4 rounded-lg mt-4 bg-gray-50 border border-gray-100">
                                            <Text className="font-bold mb-2 uppercase text-xs tracking-wider text-muted-foreground text-gray-400">Verðlaun:</Text>
                                            <Text className="text-sm font-medium text-gray-600">Þú missir engin stig fyrir fyrstu 10 ágiskanirnar þínar (meðan þú ert að læra hvar spilin liggja). Hins vegar færðu <Text className="font-bold text-red-500">-10 XP í refsistig í hvert skipti sem þú snýrð við tveimur spilum sem pörast ekki</Text>. Hámark: 200 XP. Lágmark: 30 XP.</Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                            {gameId.startsWith('litakodi') && (
                                <View className="pb-4">
                                    <View className="space-y-4 mb-6">
                                        <Text className="text-gray-600 text-sm">• Markmiðið er að giska á rétta röð af 4 litum á 6 tilraunum eða færri.</Text>
                                        <Text className="text-gray-600 text-sm">• Litröðin er falin. Litir GETA verið endurteknir.</Text>
                                        <Text className="font-bold text-gray-800 mt-2">Vísbendingar (Götin til hægri):</Text>
                                        <View className="ml-2 space-y-2">
                                            <Text className="text-gray-600 text-sm">• <Text className="font-bold text-gray-800">Dökkur nagli:</Text> Réttur litur á réttum stað.</Text>
                                            <Text className="text-gray-600 text-sm">• <Text className="font-bold text-gray-800">Hvítur nagli:</Text> Réttur litur, en á vitlausum stað.</Text>
                                        </View>
                                        <Text className="text-xs italic text-gray-400">Ath: Vísbendingarnar segja þér ekki NÁKVÆMLEGA hvaða pinnar eru réttir, aðeins fjöldann.</Text>
                                        <View className="bg-muted p-4 rounded-lg mt-4 bg-gray-50 border border-gray-100 space-y-1">
                                            <Text className="font-bold mb-2 uppercase text-xs tracking-wider text-muted-foreground text-gray-400">Verðlaun:</Text>
                                            <Text className="text-sm font-medium text-gray-600">• Þú færð <Text className="font-bold text-[#1A1A1B]">0 XP</Text> ef þú tapar.</Text>
                                            <Text className="text-sm font-medium text-gray-600">• Þú færð <Text className="font-bold text-[#1A1A1B]">100 XP</Text> í grunninn fyrir að vinna leikinn.</Text>
                                            <Text className="text-sm font-medium text-gray-600">• <Text className="font-bold text-[#1A1A1B]">Bónus stig:</Text> Fyrir hverja ónotaða ágiskun færðu <Text className="font-bold text-[#1A1A1B]">+20 XP</Text> að auki. Ef þú giskar rétt í fyrstu tilraun færðu því heil 200 XP!</Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                            {/* Generic Fallback */}
                            {!['ordla','stafarugl','straumur','sudoku','hengimadur','krossgata','tengingar','sprengjuleit','kviss','litakodi','minnisspil'].some(id => gameId.startsWith(id)) && (
                                <Text className="text-gray-600 text-base leading-6">Leystu þrautina og fáðu sem bestan tíma eða flest stig! Gangi þér vel.</Text>
                            )}
                        </ScrollView>
                        <TouchableOpacity onPress={() => setShowHelp(false)} className="mt-6 bg-[#1A1A1B] w-full py-4 rounded-full items-center">
                            <Text className="text-white font-bold text-lg">Loka og Spila</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </View>
    );
};
