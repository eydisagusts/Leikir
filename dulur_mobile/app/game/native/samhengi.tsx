import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, DeviceEventEmitter, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Layout, FadeIn, FadeOut } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { MobileGameLayout } from '@/components/MobileGameLayout';
import { NativeGameEndModal } from '@/components/NativeGameEndModal';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';

interface Guess {
    word: string;
    rank: number;
}

export default function NativeSamhengi() {
    const [puzzleData, setPuzzleData] = useState<any>(null);
    const [guesses, setGuesses] = useState<Guess[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [gameState, setGameState] = useState<'playing' | 'won' | 'loading' | 'error'>('loading');
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
                const today = new Date().toISOString().split('T')[0];

                const sessionPromise = supabase.auth.getSession();
                const apiPromise = fetch(`${API_URL}/api/mobile/samhengi/init`).then(res => res.json());

                const { data: { session } } = await sessionPromise;
                const user = session?.user;

                const dbPromises = user ? Promise.all([
                    supabase.from('game_states').select('state_json, updated_at').eq('user_id', user.id).eq('game_type', 'samhengi').maybeSingle(),
                    supabase.from('game_results').select('won, metadata, score').eq('user_id', user.id).eq('game_type', 'samhengi').gte('played_at', `${today}T00:00:00Z`).order('played_at', { ascending: false }).limit(1).maybeSingle()
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

                if (resultRow) {
                    // Already played today
                    setGameState('won');
                    if (stateRow?.state_json?.guesses) {
                        setGuesses(stateRow.state_json.guesses);
                    } else {
                        setGuesses([{ word: data.target, rank: 1 }]);
                    }
                } else if (stateRow?.state_json) {
                    // Check if state is from today
                    const updatedDate = new Date(stateRow.updated_at).toISOString().split('T')[0];
                    if (updatedDate === today) {
                        setGuesses(stateRow.state_json.guesses || []);
                        setHintsUsed(stateRow.state_json.hintsUsed || 0);
                        setGameState('playing');
                    } else {
                        // Stale state
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
    }, []);

    // Save state debounced
    useEffect(() => {
        if (gameState !== 'playing' || !puzzleData) return;
        const timer = setTimeout(() => {
            saveStateToDb();
        }, 1000);
        return () => clearTimeout(timer);
    }, [guesses, hintsUsed]);

    const saveStateToDb = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        await supabase.from('game_states').upsert({
            user_id: session.user.id,
            game_type: 'samhengi',
            state_json: { guesses, hintsUsed, puzzleId: puzzleData.id },
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
            setGameState('won');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            const xp = Math.max(0, 100 - (hintsUsed * 10));
            setEarnedXp(xp);
            setIsFreshGameOver(true);
            saveStateToDb();

            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                try {
                    const res = await fetch(`${API_URL}/api/mobile/samhengi`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({
                            won: true,
                            guessesCount: newGuesses.length,
                            hintsUsed,
                            timeTakenSeconds: 60 // placeholder native time
                        })
                    });
                    const d = await res.json();
                    if (d.success && typeof d.xpEarned === 'number') {
                        setEarnedXp(d.xpEarned);
                    }
                } catch(e) {}
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

        for (const [word, rank] of Object.entries((puzzleData as any).ranks)) {
            if (typeof rank === 'number' && rank > 1 && !guesses.some(g => g.word === word)) {
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

    if (gameState === 'loading') {
        return (
            <SafeAreaView className="flex-1 bg-[#FAFAFA] justify-center items-center">
                <ActivityIndicator size="large" color="#1e1b4b" />
            </SafeAreaView>
        );
    }

    if (gameState === 'error' || !puzzleData) {
        return (
            <SafeAreaView className="flex-1 bg-[#FAFAFA] justify-center items-center">
                <Ionicons name="cloud-offline" size={64} color="#94a3b8" />
                <Text className="mt-4 text-slate-500 font-semibold text-lg">Gat ekki hlaðið leik</Text>
                <TouchableOpacity onPress={() => router.replace('/(tabs)')} className="mt-8 bg-[#1e1b4b] px-6 py-3 rounded-full">
                    <Text className="text-white font-bold">Aftur á forsíðu</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <MobileGameLayout 
            gameId="samhengi"
            gameTitle="Samhengi" 
            isGameOver={gameState !== 'playing'}
            onBack={() => router.replace('/(tabs)')}
        >
            <View className="flex-1 px-4 mt-2">
                <Text className="text-slate-500 text-center mb-6">Finndu leyniorðið. Orðin eru raðuð eftir því hversu oft þau koma fyrir í sama samhengi og leyniorðið.</Text>

                <View className="relative w-full mb-4">
                    <TextInput
                        value={currentInput}
                        onChangeText={setCurrentInput}
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
                                    style={{ width: getBarWidth(g.rank) }} 
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
                onClose={handleCloseModal}
                gameTitle="Samhengi"
                gameState={gameState as "won" | "lost"}
                xpEarned={earnedXp}
            />
        </MobileGameLayout>
    );
}
