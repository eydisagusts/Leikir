import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Share, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { SlideInRight, SlideOutLeft, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { MobileGameLayout } from '@/components/MobileGameLayout';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';
const { width } = Dimensions.get('window');

type TriviaQuestion = {
    question: string;
    options: [string, string, string, string];
    correctIndex: 0 | 1 | 2 | 3;
};

type KvissGameData = {
    id: number;
    title: string;
    questions: [TriviaQuestion, TriviaQuestion, TriviaQuestion, TriviaQuestion, TriviaQuestion];
};

export default function NativeKviss() {
    const [game, setGame] = useState<KvissGameData | null>(null);
    const [gameState, setGameState] = useState<'playing' | 'won' | 'loading'>('loading');
    
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);
    
    // Timer States
    const [timeLeft, setTimeLeft] = useState(10);
    const [questionStartedAt, setQuestionStartedAt] = useState<number>(0);
    
    // Modal Modifiers
    const [earnedXp, setEarnedXp] = useState<number | null>(null);
    const [showFlyXp, setShowFlyXp] = useState(false);
    const [isFreshGameOver, setIsFreshGameOver] = useState(false);
    const [finalTime, setFinalTime] = useState(0);

    const xpAnimY = useSharedValue(0);
    const xpAnimOpacity = useSharedValue(1);

    const flyStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: xpAnimY.value }],
            opacity: xpAnimOpacity.value,
        };
    });

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
        if (!game) return;
        const resultEmoji = gameState === 'won' ? '🟩' : '🟥';
        const header = `Dulur: Kviss ${resultEmoji}`;
        let timeStr = "";
        if (finalTime > 0) {
            const m = Math.floor(finalTime / 60);
            const s = finalTime % 60;
            timeStr = `⏱️ Tími: ${m}:${s < 10 ? '0' : ''}${s}`;
        }
        const xpText = earnedXp ? `\n⭐ XP: +${earnedXp}` : '';
        const message = `${header}\n${timeStr}${xpText}\n\nÉg svaraði rétt á ${score}/5 í kvissinu í dag!\ndulur.is 🔥`;

        try {
            await Share.share({ message });
        } catch (error) {
            console.error('Error sharing', error);
        }
    };

    useEffect(() => {
        async function init() {
            try {
                const res = await fetch(`${API_URL}/api/mobile/kviss/init`);
                if (!res.ok) throw new Error('API down');
                const data: KvissGameData = await res.json();
                setGame(data);
                
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setGameState('playing');
                    return;
                }

                const today = new Date().toISOString().split('T')[0];
                const { data: resData } = await supabase.from('game_results')
                    .select('score')
                    .eq('user_id', user.id)
                    .eq('game_type', 'kviss')
                    .gte('played_at', `${today}T00:00:00Z`).single();
                
                if (resData) {
                    setGameState('won');
                    setScore(resData.score);
                } else {
                    const { data: stateData } = await supabase.from('game_states').select('state_json').eq('user_id', user.id).eq('game_type', `kviss_${today}`).single();
                    if (stateData && stateData.state_json) {
                        const cur = stateData.state_json.currentIndex || 0;
                        setCurrentIndex(cur);
                        setScore(stateData.state_json.score || 0);

                        // If uncompleted question exists, check timer
                        if (cur < 5 && stateData.state_json.questionStartedAt) {
                            const qAt = stateData.state_json.questionStartedAt;
                            const elapsedSec = Math.floor((Date.now() - qAt) / 1000);
                            const remaining = Math.max(0, 10 - elapsedSec);
                            setTimeLeft(remaining);
                            setQuestionStartedAt(qAt);
                        } else {
                            const now = Date.now();
                            setQuestionStartedAt(now);
                            setTimeLeft(10);
                        }
                    } else {
                        const now = Date.now();
                        setQuestionStartedAt(now);
                        setTimeLeft(10);
                    }
                    setGameState('playing');
                }
            } catch (err) {
                setGameState('playing');
            }
        }
        init();
    }, []);

    useEffect(() => {
        if (gameState !== 'playing' || isTransitioning || selectedIdx !== null || !game) return;
        
        DeviceEventEmitter.emit('start-timer');

        const interval = setInterval(() => {
            const currentElapsed = Math.floor((Date.now() - questionStartedAt) / 1000);
            const remaining = Math.max(0, 10 - currentElapsed);
            
            if (remaining <= 0) {
                clearInterval(interval);
                setTimeLeft(0);
                handleSelectOption(-1, true); // Timeout
            } else {
                setTimeLeft(remaining);
            }
        }, 500); // Trigger frequently enough

        return () => clearInterval(interval);
    }, [gameState, isTransitioning, selectedIdx, questionStartedAt, game]);

    const handleSelectOption = (idx: number, isTimeout = false) => {
        if (isTransitioning || selectedIdx !== null || !game) return;
        
        setSelectedIdx(idx);
        setIsTransitioning(true);

        const currentQ = game.questions[currentIndex];
        const isCorrect = idx === currentQ.correctIndex;

        if (isCorrect && !isTimeout) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setScore(prev => prev + 1);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        const newScore = (isCorrect && !isTimeout) ? score + 1 : score;

        // Save current index with time to prevent cheating until we transition
        const now = Date.now();
        syncState(currentIndex, newScore, now); 

        // Fast delay: 0.8s if correct (feels snappy), 2.5s if wrong/timeout (to read the correct answer)
        const delay = (isCorrect && !isTimeout) ? 800 : 2500;

        setTimeout(() => {
            if (currentIndex < 4) {
                const nextNow = Date.now();
                setCurrentIndex(prev => prev + 1);
                setSelectedIdx(null);
                setQuestionStartedAt(nextNow);
                setTimeLeft(10);
                setIsTransitioning(false);
                syncState(currentIndex + 1, newScore, nextNow);
            } else {
                completeGame(newScore);
            }
        }, delay);
    };

    const syncState = async (nextIndex: number, currentScore: number, qStartedAt: number) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const today = new Date().toISOString().split('T')[0];
        supabase.from('game_states').upsert({
            user_id: user.id,
            game_type: `kviss_${today}`,
            state_json: { currentIndex: nextIndex, score: currentScore, questionStartedAt: qStartedAt },
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, game_type' }).then();
    };

    const completeGame = async (finalScore: number) => {
        DeviceEventEmitter.emit('stop-timer');
        setGameState('won');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let elapsed = 0;
        const date = new Date().toLocaleDateString('en-CA');
        const key = `timer_${user.id}_kviss_${date}`;
        const savedTime = await AsyncStorage.getItem(key);
        if (savedTime) elapsed = parseInt(savedTime, 10);
        
        setFinalTime(elapsed);

        await supabase.from('game_results').insert({
            time_taken_seconds: elapsed,
            user_id: user.id,
            game_type: 'kviss',
            score: finalScore,
            won: finalScore === 5
        });

        // XP Reward: 30xp per correct answer
        const xpReward = finalScore * 30;
        if (xpReward > 0) {
            await supabase.rpc('increment_xp', { user_id_param: user.id, xp_amount: xpReward, p_locale: 'is' });
            setEarnedXp(xpReward);
        }
        setIsFreshGameOver(true);
    };

    if (gameState === 'loading' || !game) {
        return (
            <SafeAreaView className="flex-1 bg-[#FAFAFA] items-center justify-center">
                <ActivityIndicator size="large" color="#1A1A1B" />
            </SafeAreaView>
        );
    }

    const currentQ = game.questions[currentIndex] || game.questions[4];

    return (
        <>
            <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
            <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top', 'bottom']}>
                <MobileGameLayout onBack={() => router.back()} gameId="kviss" gameTitle="Kviss" isGameOver={gameState !== 'playing'}>
                    
                    {gameState === 'won' && isFreshGameOver && (
                        <View className="absolute top-1/4 self-center bg-white px-6 py-8 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] items-center z-40 w-[85%] max-w-[340px] border border-gray-200">
                            <TouchableOpacity 
                                onPress={handleCloseModal}
                                className="absolute top-4 right-4 p-2 z-50 bg-gray-100 rounded-full"
                            >
                                <Ionicons name="close" size={24} color="#64748B" />
                            </TouchableOpacity>

                            <View className={`w-20 h-20 rounded-full items-center justify-center mb-4 bg-green-100 border-4 border-green-200`}>
                                <Text className="text-4xl text-green-600 font-bold">{score}/5</Text>
                            </View>

                            <Text className="text-3xl font-black font-serif text-[#1A1A1B] mb-2">{score === 5 ? 'Meistaralegt!' : score >= 3 ? 'Vel gert!' : 'Gengur betur næst'}</Text>
                            <Text className="text-base font-medium text-gray-500 mb-6 text-center">Þú svaraðir {score} spurningum réttum!</Text>

                            {earnedXp !== null && earnedXp > 0 && (
                                <View className="flex-row items-center justify-center bg-yellow-500/10 border-2 border-yellow-500 px-6 py-3 rounded-2xl mb-6">
                                    <Ionicons name="star" size={20} color="#EAB308" style={{ marginRight: 6 }} />
                                    <Text className="text-xl font-bold text-yellow-600">+{earnedXp} XP</Text>
                                </View>
                            )}

                            <View className="w-full space-y-3">
                                <TouchableOpacity 
                                    onPress={handleShare} 
                                    className="w-full flex-row items-center justify-center bg-[#4F46E5] rounded-xl py-4 shadow-sm mb-3"
                                >
                                    <Ionicons name="share-outline" size={20} color="white" style={{ marginRight: 8 }} />
                                    <Text className="text-white font-bold text-lg">Deila Niðurstöðu</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={handleCloseModal}
                                    className="w-full flex-row items-center justify-center bg-gray-100 rounded-xl py-4"
                                >
                                    <Text className="text-gray-600 font-bold text-lg">Áfram</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {showFlyXp && earnedXp !== null && earnedXp > 0 && (
                        <Animated.View style={[{ position: 'absolute', top: '40%', alignSelf: 'center', zIndex: 60, pointerEvents: 'none' }, flyStyle]}>
                            <View className="bg-yellow-500 flex-row items-center px-6 py-3 rounded-full shadow-lg border-2 border-white">
                                <Ionicons name="star" size={24} color="white" style={{ marginRight: 8 }} />
                                <Text className="text-white font-black text-2xl">+{earnedXp} XP</Text>
                            </View>
                        </Animated.View>
                    )}

                    {!isFreshGameOver && gameState === 'won' && (
                        <View className="flex-1 items-center justify-center w-full px-6">
                            <Text className="text-7xl mb-4">{score === 5 ? '🔥' : score >= 3 ? '👏' : '😬'}</Text>
                            <Text className="text-[#1A1A1B] text-3xl font-black uppercase tracking-widest text-center">{score === 5 ? 'Fullkomið!' : score >= 3 ? 'Vel gert!' : 'Gengur betur næst..'}</Text>
                            <View className="flex-row items-center mt-12 bg-white px-10 py-6 rounded-3xl shadow-sm border border-[#D3D6DA]">
                                <Text className="text-[#1A1A1B] font-black text-6xl tracking-tighter">{score}</Text>
                                <Text className="text-gray-400 font-black text-4xl mt-3 mx-2">/</Text>
                                <Text className="text-gray-400 font-black text-6xl tracking-tighter mt-1">5</Text>
                            </View>
                        </View>
                    )}

                    {gameState === 'playing' && (
                        <>
                            {/* Question Pagination Meta */}
                            <View className="w-full px-6 pt-2 pb-4 items-center">
                                <View className="bg-[#E5E7EB] px-6 py-1.5 rounded-full">
                                    <Text className="text-[#1A1A1B] font-bold text-xs uppercase tracking-widest">Spurning {currentIndex + 1} af 5</Text>
                                </View>
                            </View>

                            {/* Standard Web Parity 10-second Timer Bar */}
                            <View className="w-full px-6 mb-4 relative z-0">
                                <View className="flex-row justify-between items-end mb-2">
                                    <Text className="text-sm font-bold text-gray-500 uppercase tracking-widest">Tími</Text>
                                    <Text className={`text-2xl font-black font-mono ${timeLeft > 5 ? 'text-[#3b82f6]' : timeLeft > 2 ? 'text-yellow-500' : 'text-red-500'}`}>
                                        {timeLeft}s
                                    </Text>
                                </View>
                                <View className="h-3 w-full bg-gray-200 rounded-full overflow-hidden border border-gray-300">
                                    <View 
                                        className={`absolute top-0 left-0 h-full rounded-full transition-all duration-300 ${timeLeft > 5 ? 'bg-[#3b82f6]' : timeLeft > 2 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                        style={{ width: `${(timeLeft / 10) * 100}%` }}
                                    />
                                </View>

                                {selectedIdx === -1 && isTransitioning && (
                                    <View className="absolute -top-10 left-[40%] bg-red-500 px-4 py-1 rounded-full shadow-lg">
                                        <Text className="text-white font-bold text-sm">Tíminn runninn út!</Text>
                                    </View>
                                )}
                            </View>

                            <View className="flex-1 overflow-visible relative">
                                <Animated.View 
                                    key={currentIndex} 
                                    entering={SlideInRight.duration(300).springify().damping(18)} 
                                    exiting={SlideOutLeft.duration(200)}
                                    style={{ flex: 1, paddingHorizontal: 24, paddingVertical: 12 }}
                                >
                                    <Text className="text-[#1A1A1B] font-black text-2xl sm:text-3xl leading-snug font-serif mb-8 text-center">
                                        {currentQ.question}
                                    </Text>

                                    <View className="mt-auto mb-10 gap-y-3">
                                        {currentQ.options.map((opt, idx) => {
                                            let bgColor = '#ffffff'; 
                                            let textColor = '#1A1A1B';

                                            if (isTransitioning) {
                                                if (idx === currentQ.correctIndex) {
                                                    bgColor = '#10b981'; // Green Correct
                                                    textColor = '#ffffff';
                                                } else if (idx === selectedIdx) {
                                                    bgColor = '#ef4444'; // Red Wrong User
                                                    textColor = '#ffffff';
                                                } else {
                                                    bgColor = '#FAFAFA'; // Unselected other wrong
                                                    textColor = '#9CA3AF';
                                                }
                                            }

                                            return (
                                                <TouchableOpacity 
                                                    key={idx}
                                                    activeOpacity={0.7}
                                                    onPress={() => handleSelectOption(idx)}
                                                    disabled={isTransitioning}
                                                    style={{
                                                        backgroundColor: bgColor,
                                                        width: '100%',
                                                        paddingVertical: 18,
                                                        paddingHorizontal: 24,
                                                        borderRadius: 20,
                                                        borderWidth: 2,
                                                        borderColor: !isTransitioning ? '#E5E7EB' : 'transparent',
                                                        flexDirection: 'row',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    <Text style={{ color: textColor, fontWeight: '700', fontSize: 18, flex: 1 }}>
                                                        {opt}
                                                    </Text>
                                                    
                                                    {isTransitioning && idx === currentQ.correctIndex && (
                                                        <Ionicons name="checkmark-circle" size={24} color="#ffffff" style={{ marginLeft: 8 }} />
                                                    )}
                                                    {isTransitioning && selectedIdx === idx && idx !== currentQ.correctIndex && (
                                                        <Ionicons name="close-circle" size={24} color="#ffffff" style={{ marginLeft: 8 }} />
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </Animated.View>
                            </View>
                        </>
                    )}

                </MobileGameLayout>
            </SafeAreaView>
        </>
    );
}
