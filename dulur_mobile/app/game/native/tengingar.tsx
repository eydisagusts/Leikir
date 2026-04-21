import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withRepeat, Layout, FadeIn, FadeOut } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { MobileGameLayout } from '@/components/MobileGameLayout';
import { NativeGameEndModal } from '@/components/NativeGameEndModal';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';

interface Category {
    category: string;
    words: string[];
    difficulty: number;
}

export default function NativeTengingar() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [unsolvedWords, setUnsolvedWords] = useState<string[]>([]);
    const [solvedCategories, setSolvedCategories] = useState<Category[]>([]);
    const [selectedWords, setSelectedWords] = useState<string[]>([]);
    const [mistakes, setMistakes] = useState(0);
    const [gameState, setGameState] = useState<'playing' | 'won' | 'lost' | 'loading'>('loading');
    const [toast, setToast] = useState<string | null>(null);

    const MAX_MISTAKES = 4;
    const shakeOffset = useSharedValue(0);

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

    const handleShare = async () => {
        const header = `Dulur: Tengingar 🧩`;
        const xpText = earnedXp ? `\n⭐ XP: +${earnedXp}` : '';
        const mText = `Mistök: ${mistakes}/4`;
        const message = `${header}\n${mText}${xpText}\n\nÉg fann allar tengingarnar!\ndulur.is 🔥`;
        try {
            await Share.share({ message });
        } catch (error) {
            console.error('Error sharing', error);
        }
    };

    const xpFloatingStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: xpAnimY.value }],
            opacity: xpAnimOpacity.value
        };
    });

    const shakeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shakeOffset.value }]
    }));

    useEffect(() => {
        async function init() {
            try {
                const today = new Date().toISOString().split('T')[0];

                const sessionPromise = supabase.auth.getSession();
                const apiPromise = fetch(`${API_URL}/api/mobile/tengingar/init`).then(res => res.json());

                const { data: { session } } = await sessionPromise;
                const user = session?.user;

                const dbPromises = user ? Promise.all([
                    supabase.from('game_states').select('state_json, updated_at').eq('user_id', user.id).eq('game_type', 'tengingar').maybeSingle(),
                    supabase.from('game_results').select('won, metadata').eq('user_id', user.id).eq('game_type', 'tengingar').gte('played_at', `${today}T00:00:00Z`).order('played_at', { ascending: false }).limit(1).maybeSingle()
                ]) : Promise.resolve([{ data: null }, { data: null }]);

                const [data, [stateDataRes, resDataRes]] = await Promise.all([
                    apiPromise,
                    dbPromises
                ]);

                setCategories(data.categories);
                
                if (!user) {
                    setUnsolvedWords(data.startingBoard);
                    setGameState('playing'); 
                    return; 
                }

                const stateData = stateDataRes.data;
                const resData = resDataRes.data;

                let currentUnsolved = data.startingBoard;
                let currentSolved: Category[] = [];
                let currentMistakes = 0;

                if (stateData && stateData.updated_at.startsWith(today)) {
                    currentUnsolved = stateData.state_json.unsolvedWords || data.startingBoard;
                    currentSolved = stateData.state_json.solvedCategories || [];
                    currentMistakes = stateData.state_json.mistakes || 0;
                }
                if (resData) {
                    setGameState(resData.won ? 'won' : 'lost');
                    setSolvedCategories(data.categories);
                    setUnsolvedWords([]);
                    setMistakes(resData.metadata?.mistakes || 0);
                } else {
                    setGameState('playing');
                    setUnsolvedWords(currentUnsolved);
                    setSolvedCategories(currentSolved);
                    setMistakes(currentMistakes);
                }

                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (err) {
                setGameState('playing');
            }
        }
        init();
    }, []);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    };

    const triggerShake = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        shakeOffset.value = withSequence(
            withTiming(-10, { duration: 50 }),
            withRepeat(withTiming(10, { duration: 100 }), 3, true),
            withTiming(0, { duration: 50 })
        );
    };

    const toggleSelection = (word: string) => {
        if (gameState !== 'playing') return;
        DeviceEventEmitter.emit('start-timer');
        
        if (selectedWords.includes(word)) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSelectedWords(prev => prev.filter(w => w !== word));
        } else {
            if (selectedWords.length < 4) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setSelectedWords(prev => [...prev, word]);
            } else {
                triggerShake();
            }
        }
    };

    const handleShuffle = () => {
        if (gameState !== 'playing') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const shuffled = [...unsolvedWords];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        setUnsolvedWords(shuffled);
    };

    const handleDeselect = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedWords([]);
    };

    const handleSubmit = async () => {
        if (selectedWords.length !== 4) {
            triggerShake();
            return;
        }

        // Check if words match a category
        const matchCategory = categories.find(cat => {
            const catWords = cat.words.map(w => w.toLowerCase());
            const selWords = selectedWords.map(w => w.toLowerCase());
            return selWords.every(w => catWords.includes(w));
        });

        if (matchCategory) {
            // Success!
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const nextSolved = [...solvedCategories, matchCategory];
            const nextUnsolved = unsolvedWords.filter(w => !selectedWords.includes(w));
            
            setSolvedCategories(nextSolved);
            setUnsolvedWords(nextUnsolved);
            setSelectedWords([]);

            if (nextSolved.length === 4) {
                setGameState('won');
                await syncTrueResult(true, mistakes);
            } else {
                await syncGameState(nextUnsolved, nextSolved, mistakes);
            }
            return;
        }

        // Check one away
        const oneAway = categories.some(cat => {
            const catWords = cat.words.map(w => w.toLowerCase());
            const selWords = selectedWords.map(w => w.toLowerCase());
            let matches = 0;
            selWords.forEach(w => { if (catWords.includes(w)) matches++; });
            return matches === 3;
        });

        if (oneAway) {
            showToast('Einn frá!');
        }

        const nextMistakes = mistakes + 1;
        triggerShake();

        if (nextMistakes >= MAX_MISTAKES) {
            setGameState('lost');
            // Reveal everything
            setSolvedCategories([...categories]);
            setUnsolvedWords([]);
            setSelectedWords([]);
            await syncTrueResult(false, nextMistakes);
        } else {
            setMistakes(nextMistakes);
            await syncGameState(unsolvedWords, solvedCategories, nextMistakes);
        }
    };

    const syncGameState = async (unsolved: string[], solved: Category[], msts: number) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from('game_states').upsert({
            user_id: user.id,
            game_type: 'tengingar',
            state_json: { unsolvedWords: unsolved, solvedCategories: solved, mistakes: msts },
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, game_type' });
    };

    const syncTrueResult = async (won: boolean, numMistakes: number) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let xpReward = won ? 150 - (numMistakes * 10) : 50;

        await supabase.from('game_results').insert({
            time_taken_seconds: 60,
            user_id: user.id,
            game_type: 'tengingar',
            score: xpReward,
            won,
            metadata: { mistakes: numMistakes }
        });

        if (won) {
            setEarnedXp(xpReward);
            setTimeout(() => setIsFreshGameOver(true), 1000);
            await supabase.rpc('increment_xp', { user_id_param: user.id, xp_amount: xpReward, p_locale: 'is' });
            await supabase.rpc('process_daily_streak', { user_id_param: user.id });
        } else {
            setEarnedXp(0);
            setTimeout(() => setIsFreshGameOver(true), 1000);
        }
    };

    if (gameState === 'loading') {
        return (
            <SafeAreaView className="flex-1 bg-[#FAFAFA] items-center justify-center">
                <ActivityIndicator size="large" color="#1A1A1B" />
            </SafeAreaView>
        );
    }

    const getDifficultyColor = (diff: number) => {
        switch (diff) {
            case 1: return '#FDE047'; // yellow-300
            case 2: return '#86EFAC'; // green-300
            case 3: return '#93C5FD'; // blue-300
            case 4: return '#C4B5FD'; // purple-300
            default: return '#E5E7EB';
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
            
            <MobileGameLayout 
                onBack={() => router.back()} 
                gameId="tengingar" 
                gameTitle="Tengingar" 
                scrollEnabled={true} 
                isGameOver={gameState !== 'playing'}
            >
            
            {showFlyXp && (
                <Animated.View style={[xpFloatingStyle, { position: 'absolute', top: '40%', left: '35%', zIndex: 100 }]} className="items-center pointer-events-none">
                    <View className="bg-[#EAB308] flex-row items-center gap-1.5 px-4 py-2 rounded-full shadow-lg border border-[#FDE047]">
                        <Ionicons name="star" size={16} color="white" />
                        <Text className="text-white font-black text-xl tracking-widest">+{earnedXp}</Text>
                    </View>
                </Animated.View>
            )}

            <NativeGameEndModal
                gameTitle="Tengingar"
                visible={gameState !== 'playing' && isFreshGameOver}
                gameState={gameState}
                xpEarned={earnedXp}
                winTitle={gameState === 'won' ? 'Vel gert!' : 'Leik lokið'}
                winDesc={gameState === 'won' ? 'Þú fannst allar tengingarnar!' : 'Þú kláraðir allar tilraunir þínar.'}
                onContinue={handleCloseModal}
                primaryButtonText="Deila niðurstöðu"
                onPrimaryAction={handleShare}
            />

            {toast && (
                <View className="absolute top-4 self-center z-50 bg-[#1A1A1B] px-6 py-3 rounded-full shadow-lg">
                    <Text className="text-white font-bold text-base">{toast}</Text>
                </View>
            )}

            <View className="w-full self-center max-w-[500px] px-4" style={{ marginTop: 16 }}>
                
                {/* Solved Categories */}
                {solvedCategories.map(cat => (
                    <Animated.View 
                        key={cat.category} 
                        entering={FadeIn} 
                        layout={Layout.springify()} 
                        style={{ backgroundColor: getDifficultyColor(cat.difficulty) }}
                        className="w-full py-4 px-2 rounded-xl items-center justify-center mb-2 shadow-sm"
                    >
                        <Text className="font-bold text-[#1A1A1B] uppercase tracking-widest mb-1 text-center">{cat.category}</Text>
                        <Text className="text-[#1A1A1B] uppercase text-xs font-semibold text-center">{cat.words.join(', ')}</Text>
                    </Animated.View>
                ))}

                {/* Grid */}
                <Animated.View style={[(gameState === 'playing') ? shakeStyle : {}]} className="flex-row flex-wrap justify-between">
                    {unsolvedWords.map(word => {
                        const isSelected = selectedWords.includes(word);
                        return (
                            <Animated.View key={word} layout={Layout.springify()} entering={FadeIn} exiting={FadeOut} style={{ width: '23.5%', aspectRatio: 1, marginBottom: '2%' }}>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => toggleSelection(word)}
                                    style={{
                                        backgroundColor: isSelected ? '#3A3A3C' : '#EFEFEF',
                                        flex: 1,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: 8,
                                        padding: 4
                                    }}
                                >
                                    <Text 
                                        style={{ color: isSelected ? 'white' : '#1A1A1B', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase', textAlign: 'center' }}
                                        numberOfLines={3}
                                    >
                                        {word}
                                    </Text>
                                </TouchableOpacity>
                            </Animated.View>
                        );
                    })}
                </Animated.View>

            {/* Controls */}
            {gameState === 'playing' ? (
                <View className="w-full max-w-[500px] px-0 pb-6" style={{ marginTop: 16, gap: 12 }}>
                    <View className="flex-row justify-center items-center gap-2 mb-0">
                        <Text className="text-gray-600 font-bold">Mistök eftir:</Text>
                        <View className="flex-row gap-1">
                            {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
                                <View key={i} className={`w-3 h-3 rounded-full ${i < (MAX_MISTAKES - mistakes) ? 'bg-[#1A1A1B]' : 'bg-gray-300'}`} />
                            ))}
                        </View>
                    </View>

                    <View className="flex-row justify-center gap-3">
                        <TouchableOpacity onPress={handleShuffle} className="px-6 py-3.5 rounded-full border border-[#D3D6DA] bg-white">
                            <Text className="font-bold text-[#1A1A1B]">Stokka</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleDeselect} className="px-6 py-3.5 rounded-full border border-[#D3D6DA] bg-white" disabled={selectedWords.length===0} style={{ opacity: selectedWords.length ? 1 : 0.5 }}>
                            <Text className="font-bold text-[#1A1A1B]">Hreinsa</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSubmit} className="px-6 py-3.5 rounded-full border border-[#1A1A1B] min-w-[100px] items-center" style={{ backgroundColor: selectedWords.length === 4 ? '#1A1A1B' : '#EFEFEF', borderColor: selectedWords.length === 4 ? '#1A1A1B' : '#D3D6DA' }}>
                            <Text className={`font-bold ${selectedWords.length === 4 ? 'text-white' : 'text-gray-400'}`}>Giska</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : !isFreshGameOver ? (
                <View className="w-full max-w-[500px] px-4 pb-12 mt-4 items-center">
                     <Text className="text-xl font-bold font-serif mb-4 text-[#1A1A1B]">{gameState === 'won' ? 'Leik lokið!' : 'Næst gengur betur!'}</Text>
                     <TouchableOpacity onPress={() => router.back()} className="px-8 py-4 rounded-full bg-[#1A1A1B] w-full max-w-[250px] items-center">
                        <Text className="font-bold text-white text-lg">Til baka í leiki</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            </View>

            </MobileGameLayout>
        </SafeAreaView>
    );
}
