import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, DeviceEventEmitter, ScrollView, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Layout, FadeIn, FadeOut } from 'react-native-reanimated';
import { supabase, getFreshSession } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MobileGameLayout } from '@/components/MobileGameLayout';
import { NativeGameEndModal } from '@/components/NativeGameEndModal';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';

interface Guess {
    word: string;
    rank: number;
}

export default function NativeSamhengi() {
    const { date, challengeId } = useLocalSearchParams<{ date: string, challengeId?: string }>();
    const [puzzleData, setPuzzleData] = useState<any>(null);
    const [guesses, setGuesses] = useState<Guess[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [gameState, setGameState] = useState<'playing' | 'won' | 'given_up' | 'loading' | 'error'>('loading');
    const [hintsUsed, setHintsUsed] = useState(0);
    const [toast, setToast] = useState<string | null>(null);

    const [earnedXp, setEarnedXp] = useState<number>(0);
    const [showFlyXp, setShowFlyXp] = useState(false);
    const [isFreshGameOver, setIsFreshGameOver] = useState(false);

    const xpAnimY = useSharedValue(0);
    const xpAnimOpacity = useSharedValue(0);

    const handleCloseModal = () => {
        setIsFreshGameOver(false);
        if (earnedXp && earnedXp > 0) {
            setShowFlyXp(true);
            xpAnimY.value = 0;
            xpAnimOpacity.value = 1;
            xpAnimY.value = withTiming(-350, { duration: 1200 });
            xpAnimOpacity.value = withTiming(0, { duration: 1200 });
            setTimeout(() => {
                setShowFlyXp(false);
                DeviceEventEmitter.emit('xp-earned', earnedXp);
            }, 1300);
        }
    };

    const xpFloatingStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: xpAnimY.value }],
            opacity: xpAnimOpacity.value
        };
    });

    useEffect(() => {
        async function init() {
            try {
                const todayStr = date || new Date().toISOString().split('T')[0];
                const isToday = todayStr === new Date().toISOString().split('T')[0];
                const gameTypeKey = isToday ? 'samhengi' : `samhengi_${todayStr}`;

                const session = await getFreshSession();
                const apiPromise = fetch(`${API_URL}/api/mobile/samhengi/init?date=${todayStr}${challengeId ? `&c=${challengeId}` : ''}`, {
                    headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : undefined
                }).then(async res => {
                    if (!res.ok) {
                        const errData = await res.json().catch(() => ({}));
                        throw new Error(errData.error || 'Failed to load game');
                    }
                    return res.json();
                });
                const user = session?.user;

                const dbPromises = user ? Promise.all([
                    supabase.from('game_states').select('state_json, updated_at').eq('user_id', user.id).eq('game_type', gameTypeKey).maybeSingle(),
                    supabase.from('game_results').select('won, metadata, score').eq('user_id', user.id).eq('game_type', 'samhengi').eq('metadata->>puzzleDate', todayStr).maybeSingle()
                ]) : Promise.resolve([{ data: null }, { data: null }]);

                const [data, [stateDataRes, resDataRes]] = await Promise.all([
                    apiPromise,
                    dbPromises
                ]);

                setPuzzleData(data);

                if (!user) {
                    setGameState('playing');
                    return;
                }

                const stateRow = stateDataRes?.data;
                const resultRow = resDataRes?.data;

                let loadedState = stateRow?.state_json;
                if (stateRow && !date) {
                    const updatedDate = new Date(stateRow.updated_at).toISOString().split('T')[0];
                    if (updatedDate !== todayStr) {
                        loadedState = null;
                        await supabase.from('game_states').delete().eq('user_id', user.id).eq('game_type', gameTypeKey);
                    }
                }

                if (resultRow) {
                    // Already played today
                    setGameState('won');
                    if (loadedState?.guesses) {
                        setGuesses(loadedState.guesses);
                    } else {
                        setGuesses([{ word: data.target, rank: 1 }]);
                    }
                } else if (loadedState) {
                    setGuesses(loadedState.guesses || []);
                    setHintsUsed(loadedState.hintsUsed || 0);
                    const hasWon = loadedState.guesses?.some((g: Guess) => g.rank === 1);
                    if (hasWon) {
                        if (loadedState.givenUp) {
                            setGameState('given_up');
                        } else {
                            setGameState('won');
                        }
                    } else {
                        setGameState('playing');
                    }
                } else {
                    setGameState('playing');
                }

            } catch (error) {
                console.error("Init Error", error);
                setGameState('error');
            }
        }
        init();
    }, [date]);

    useEffect(() => {
        if (gameState === 'playing') {
            setTimeout(() => DeviceEventEmitter.emit('start-timer'), 500);
        }
    }, [gameState]);

    // Save state debounced
    useEffect(() => {
        if (gameState !== 'playing' || !puzzleData) return;
        const timer = setTimeout(() => {
            saveStateToDb();
        }, 1000);
        return () => clearTimeout(timer);
    }, [guesses, hintsUsed]);

    const saveStateToDb = async (currentGuesses?: Guess[], givenUp: boolean = false) => {
        const session = await getFreshSession();
        if (!session?.user) return;
        const todayStr = date || new Date().toISOString().split('T')[0];
        const isToday = todayStr === new Date().toISOString().split('T')[0];
        const gameTypeKey = isToday ? 'samhengi' : `samhengi_${todayStr}`;
        await supabase.from('game_states').upsert({
            user_id: session.user.id,
            game_type: gameTypeKey,
            state_json: { guesses: currentGuesses || guesses, hintsUsed, puzzleId: puzzleData.id, givenUp },
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, game_type' });
    };

    const handleGuess = async () => {
        if (gameState !== 'playing' || !currentInput.trim() || !puzzleData) return;

        const guessWord = currentInput.trim().toUpperCase();
        setCurrentInput('');

        if (guesses.some(g => g.word === guessWord)) {
            setToast('Þú hefur þegar giskað á þetta orð.');
            setTimeout(() => setToast(null), 2000);
            return;
        }

        let rank = puzzleData.ranks[guessWord];
        if (rank === undefined) {
            rank = 10000;
        }

        const newGuesses = [...guesses, { word: guessWord, rank }];
        newGuesses.sort((a, b) => a.rank - b.rank);
        setGuesses(newGuesses);

        if (rank === 1) {
            DeviceEventEmitter.emit('stop-timer');
            setGameState('won');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            const xp = Math.max(0, 100 - (hintsUsed * 10));
            setEarnedXp(xp);
            setIsFreshGameOver(true);
            saveStateToDb(newGuesses);

            const session = await getFreshSession();
            if (session?.user) {
                try {
                    const todayStr = date || new Date().toISOString().split('T')[0];
                    const isToday = todayStr === new Date().toISOString().split('T')[0];

                    let elapsed = 60;
                    const savedTime = await AsyncStorage.getItem(`timer_${session.user.id}_samhengi_${todayStr}`);
                    if (savedTime) elapsed = parseInt(savedTime, 10) || 60;

                    const res = await fetch(`${API_URL}/api/mobile/samhengi`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({
                            action: 'save',
                            won: true,
                            guessesCount: newGuesses.length,
                            hintsUsed,
                            timeTakenSeconds: elapsed,
                            targetDate: todayStr
                        })
                    });
                    const d = await res.json();
                    if (d.success && typeof d.xpEarned === 'number') {
                        setEarnedXp(d.xpEarned);
                    }
                } catch (e) { }
            }
        }
    };

    const getBarColor = (rank: number) => {
        if (rank === 1) return 'bg-green-500';
        if (rank <= 100) return 'bg-green-400';
        if (rank <= 500) return 'bg-yellow-400';
        if (rank <= 1000) return 'bg-orange-400';
        return 'bg-red-500';
    };

    const getBarWidth = (rank: number) => {
        if (rank === 1) return '100%';
        const maxRank = 10000;
        const boundedRank = Math.min(rank, maxRank);
        const percent = Math.max(5, ((maxRank - boundedRank) / maxRank) * 100);
        return `${percent}%`;
    };

    const handleHint = () => {
        if (gameState !== 'playing' || !puzzleData) return;
        const hintRanks = [100, 50, 20, 10, 5, 2];
        if (hintsUsed >= hintRanks.length) return;

        let targetRank = hintRanks[hintsUsed];
        let bestWord = "";
        let bestRank = -1;
        let minDiff = Infinity;

        const isValidWord = (w: string) => {
            return !w.includes(' ') && !w.includes('-') && !w.includes('.') && !w.includes('\'') && !/\d/.test(w) && w.length > 2;
        };

        const ranksObj = (puzzleData as any).ranks;
        for (const word in ranksObj) {
            const rank = ranksObj[word];
            if (typeof rank === 'number' && rank > 1 && !guesses.some(g => g.word === word) && isValidWord(word)) {
                const diff = Math.abs(rank - targetRank);
                if (diff < minDiff) {
                    minDiff = diff;
                    bestWord = word;
                    bestRank = rank;
                }
            }
        }

        if (bestWord) {
            const newGuesses = [...guesses, { word: bestWord, rank: bestRank }];
            newGuesses.sort((a, b) => a.rank - b.rank);
            setGuesses(newGuesses);
            setHintsUsed(h => h + 1);
        }
    };

    const handleGiveUp = () => {
        if (gameState !== 'playing' || !puzzleData) return;
        Alert.alert(
            'Gefast upp?',
            'Ertu viss um að þú viljir gefast upp? Þú færð 0 stig fyrir leikinn.',
            [
                { text: 'Hætta við', style: 'cancel' },
                {
                    text: 'Gefast upp', style: 'destructive', onPress: async () => {
                        let targetWord = "";
                        for (const [word, rank] of Object.entries(puzzleData.ranks)) {
                            if (rank === 1) {
                                targetWord = word;
                                break;
                            }
                        }
                        if (targetWord) {
                            const newGuesses = [...guesses, { word: targetWord, rank: 1 }];
                            newGuesses.sort((a, b) => a.rank - b.rank);
                            setGuesses(newGuesses);
                            setGameState('given_up');
                            setEarnedXp(0);
                            DeviceEventEmitter.emit('stop-timer');
                            saveStateToDb(newGuesses, true);

                            const session = await getFreshSession();
                            if (session?.user) {
                                try {
                                    const todayStr = date || new Date().toISOString().split('T')[0];

                                    let elapsed = 60;
                                    const savedTime = await AsyncStorage.getItem(`timer_${session.user.id}_samhengi_${todayStr}`);
                                    if (savedTime) elapsed = parseInt(savedTime, 10) || 60;

                                    await fetch(`${API_URL}/api/mobile/samhengi`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${session.access_token}`
                                        },
                                        body: JSON.stringify({
                                            action: 'save',
                                            won: false,
                                            guessesCount: newGuesses.length,
                                            hintsUsed,
                                            timeTakenSeconds: elapsed,
                                            targetDate: todayStr
                                        })
                                    });
                                } catch (e) { }
                            }
                        }
                    }
                }
            ]
        );
    };

    if (gameState === 'loading') {
        return (
            <SafeAreaView className="flex-1 bg-[#FAFAFA] justify-center items-center">
                <ActivityIndicator size="large" color="#1e1b4b" />
            </SafeAreaView>
        );
    }

    if (gameState === 'error' || !puzzleData) {
        return (
            <SafeAreaView className="flex-1 bg-[#FAFAFA] justify-center items-center p-6">
                <View className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 items-center w-full max-w-sm">
                    <Ionicons name="lock-closed" size={48} color="#eb3b5a" style={{ marginBottom: 16 }} />
                    <Text className="text-2xl font-black font-serif text-[#1A1A1B] mb-2 text-center">Aðgangur Lokaður</Text>
                    <Text className="text-sm font-medium text-slate-500 mb-2 text-center leading-6">Þessi leikur krefst Dulur+ áskriftar eða netþjónn niðri.</Text>
                    <TouchableOpacity onPress={() => router.back()} className="bg-[#1A1A1B] w-full py-4 rounded-full shadow-md items-center mt-6">
                        <Text className="text-white font-bold text-lg">Til baka í Leiki</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
            <MobileGameLayout
                gameId="samhengi"
                gameTitle="Samhengi"
                isGameOver={gameState !== 'playing'}
                onBack={() => router.replace('/(tabs)')}
            >
                <View className="flex-1 px-4 mt-2">
                    <Text className="text-slate-500 text-center mb-6">Giskaðu á leyniorð dagsins. Orðin eru flokkuð eftir því hversu lík þau eru að merkingu.</Text>

                    <View className="relative w-full mb-4">
                        <TextInput
                            value={currentInput}
                            onChangeText={(text) => {
                                DeviceEventEmitter.emit('start-timer');
                                setCurrentInput(text);
                            }}
                            onSubmitEditing={handleGuess}
                            placeholder="Skrifaðu orð..."
                            placeholderTextColor="#94a3b8"
                            editable={gameState === 'playing'}
                            className="w-full h-14 pl-12 pr-4 rounded-xl border-2 border-slate-200 focus:border-slate-400 focus:outline-none bg-white text-xl font-bold uppercase"
                            style={{ paddingVertical: 0 }}
                            autoCapitalize="characters"
                            autoCorrect={false}
                        />
                        <Ionicons name="search" size={24} color="#94a3b8" style={{ position: 'absolute', left: 16, top: 16 }} />
                    </View>

                    <View className="flex-row justify-between items-center mb-4 px-1">
                        <Text className="text-sm font-bold text-slate-500">{guesses.length} ágiskanir</Text>
                        {gameState === 'playing' && (
                            <View className="flex-row items-center gap-2">
                                <TouchableOpacity
                                    onPress={handleGiveUp}
                                    className="px-3 py-1.5 rounded-full flex-row items-center bg-red-50 border border-red-200"
                                >
                                    <Text className="font-bold text-xs text-red-500">Gefast upp</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleHint}
                                    disabled={hintsUsed >= 6}
                                    className={`px-3 py-1.5 rounded-full flex-row items-center ${hintsUsed > 0 ? 'bg-amber-100 border border-amber-300' : 'bg-slate-100'}`}
                                >
                                    <Ionicons name="bulb" size={16} color={hintsUsed > 0 ? '#d97706' : '#64748b'} />
                                    <Text className={`font-bold ml-1 text-xs ${hintsUsed > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                                        Vísbending {hintsUsed > 0 && `(-${hintsUsed * 10} XP)`}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {toast && (
                        <Animated.View entering={FadeIn} exiting={FadeOut} className="bg-red-500 py-2 px-4 rounded-lg self-center mb-4">
                            <Text className="text-white font-bold">{toast}</Text>
                        </Animated.View>
                    )}

                    <ScrollView className="flex-1 w-full" showsVerticalScrollIndicator={false}>
                        <View className="flex-col gap-3 pb-8">
                            {guesses.map((g, i) => (
                                <Animated.View key={`${g.word}-${i}`} entering={FadeIn.duration(400)} className="w-full h-12 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex-row items-center px-4 relative">
                                    <View
                                        className={`absolute left-0 top-0 bottom-0 ${getBarColor(g.rank)} opacity-30`}
                                        style={{ width: getBarWidth(g.rank) as any }}
                                    />
                                    <View className="flex-1 flex-row justify-between items-center z-10">
                                        <Text className="font-bold uppercase text-lg text-slate-800">{g.word}</Text>
                                        <Text className="font-mono font-bold text-slate-500">{g.rank === 10000 ? '>10.000' : g.rank}</Text>
                                    </View>
                                </Animated.View>
                            ))}
                            {guesses.length === 0 && (
                                <Text className="text-center text-slate-400 py-8">Engar ágiskanir ennþá</Text>
                            )}
                        </View>
                    </ScrollView>
                </View>

                {showFlyXp && (
                    <Animated.View style={[{ position: 'absolute', top: Dimensions.get('window').height * 0.6, left: 0, right: 0, alignItems: 'center', zIndex: 100 }, xpFloatingStyle]} pointerEvents="none">
                        <View className="bg-[#EAB308] border-2 border-[#CA8A04] px-4 py-2 rounded-xl flex-row items-center gap-2 shadow-lg">
                            <Ionicons name="star" size={24} color="white" />
                            <Text className="text-white font-black text-2xl">+{earnedXp}</Text>
                        </View>
                    </Animated.View>
                )}

                <NativeGameEndModal
                    visible={isFreshGameOver}
                    onContinue={handleCloseModal}
                    gameTitle="Samhengi"
                    gameState={gameState as "won" | "lost"}
                    xpEarned={earnedXp}
                />
            </MobileGameLayout>
        </SafeAreaView>
    );
}
