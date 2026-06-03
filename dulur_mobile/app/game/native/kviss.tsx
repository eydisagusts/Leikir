import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Share, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated } from 'react-native';
import { MobileGameLayout } from '@/components/MobileGameLayout';
import { NativeGameEndModal } from '@/components/NativeGameEndModal';
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
    const { date } = useLocalSearchParams<{ date: string }>();
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

    const xpAnimY = React.useRef(new Animated.Value(0)).current;
    const xpAnimOpacity = React.useRef(new Animated.Value(1)).current;

    const flyStyle = {
        transform: [{ translateY: xpAnimY }],
        opacity: xpAnimOpacity,
    };

    const handleCloseModal = () => {
        setIsFreshGameOver(false);
        if (earnedXp && earnedXp > 0) {
            setShowFlyXp(true);
            xpAnimY.setValue(0);
            xpAnimOpacity.setValue(1);
            Animated.parallel([
                Animated.timing(xpAnimY, { toValue: -350, duration: 1200, useNativeDriver: true }),
                Animated.timing(xpAnimOpacity, { toValue: 0, duration: 1200, useNativeDriver: true })
            ]).start();
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
                const todayStr = date || new Date().toISOString().split('T')[0];
                const isToday = todayStr === new Date().toISOString().split('T')[0];
                const gameTypeKey = isToday ? `kviss_${todayStr}` : `kviss_${todayStr}`;
                
                const sessionPromise = supabase.auth.getSession();
                const apiPromise = fetch(`${API_URL}/api/mobile/kviss/init?date=${todayStr}`).then(res => res.json());

                const { data: { session } } = await sessionPromise;
                const user = session?.user;

                const dbPromises = user ? Promise.all([
                    supabase.from('game_results')
                        .select('score')
                        .eq('user_id', user.id)
                        .eq('game_type', 'kviss')
                        .eq('metadata->>puzzleDate', todayStr).maybeSingle(),
                    supabase.from('game_states').select('state_json').eq('user_id', user.id).eq('game_type', gameTypeKey).maybeSingle()
                ]) : Promise.resolve([{ data: null }, { data: null }]);

                const [data, [resDataRes, stateDataRes]] = await Promise.all([
                    apiPromise,
                    dbPromises
                ]);

                setGame(data as KvissGameData);
                
                if (!user) {
                    setGameState('playing');
                    return;
                }

                const resData = resDataRes.data;
                const stateData = stateDataRes.data;

                if (stateData && stateData.state_json) {
                    const cur = stateData.state_json.currentIndex || 0;
                    setCurrentIndex(cur);
                    setScore(stateData.state_json.score || 0);

                    // If uncompleted question exists, check timer
                    if (cur < 5 && stateData.state_json.questionStartedAt && !resData) {
                        const qAt = stateData.state_json.questionStartedAt;
                        const elapsedSec = Math.floor((Date.now() - qAt) / 1000);
                        const remaining = Math.max(0, 10 - elapsedSec);
                        setTimeLeft(remaining);
                        setQuestionStartedAt(qAt);
                    } else if (!resData) {
                        const now = Date.now();
                        setQuestionStartedAt(now);
                        setTimeLeft(10);
                    }
                } else if (!resData) {
                    const now = Date.now();
                    setQuestionStartedAt(now);
                    setTimeLeft(10);
                }

                if (resData) {
                    setGameState('won');
                } else {
                    setGameState('playing');
                }
            } catch (err) {
                setGameState('playing');
            }
        }
        init();
    }, [date]);

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
        if (gameState !== 'playing' || isTransitioning || selectedIdx !== null || !game) return;
        
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
        const todayStr = date || new Date().toISOString().split('T')[0];
        const isToday = todayStr === new Date().toISOString().split('T')[0];
        const gameTypeKey = isToday ? `kviss_${todayStr}` : `kviss_${todayStr}`;
        supabase.from('game_states').upsert({
            user_id: user.id,
            game_type: gameTypeKey,
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
        const todayStr = date || new Date().toISOString().split('T')[0];
        const isToday = todayStr === new Date().toISOString().split('T')[0];
        const key = `timer_${user.id}_kviss_${todayStr}`;
        const savedTime = await AsyncStorage.getItem(key);
        if (savedTime) elapsed = parseInt(savedTime, 10) || 0;
        
        setFinalTime(elapsed);

        const { error } = await supabase.from('game_results').insert({
            time_taken_seconds: elapsed,
            user_id: user.id,
            game_type: 'kviss',
            score: finalScore,
            won: finalScore === 5,
            metadata: { finalScore, puzzleDate: todayStr } as any
        });

        if (error) {
            console.error("Kviss result insert failed:", error);
            setTimeout(() => setIsFreshGameOver(true), 1000);
            return;
        }

        // Clear local state tracking to prevent infinitely reloading old answers
        // Removed game_states deletion to preserve state for replay visualization

        // XP Reward: 30xp per correct answer
        let xpReward = finalScore * 30;
        if (!isToday) xpReward = 0;
        if (xpReward > 0) {
            await supabase.rpc('increment_xp', { user_id_param: user.id, xp_amount: xpReward, p_locale: 'is' });
            setEarnedXp(xpReward);
        } else {
            setEarnedXp(0);
        }
        setTimeout(() => setIsFreshGameOver(true), 1000);
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
                    
                    <NativeGameEndModal
                gameTitle="Kviss"
                        visible={gameState === 'won' && isFreshGameOver}
                        gameState="won"
                        xpEarned={earnedXp}
                        winTitle={score === 5 ? 'Meistaralegt!' : score >= 3 ? 'Vel gert!' : 'Gengur betur næst'}
                        winDesc={`Þú svaraðir ${score} spurningum réttum!`}
                        onContinue={handleCloseModal}
                    />

                    {showFlyXp && earnedXp !== null && earnedXp > 0 && (
                        <Animated.View style={[{ position: 'absolute', top: '40%', alignSelf: 'center', zIndex: 60, pointerEvents: 'none' }, flyStyle]}>
                            <View className="bg-[#EAB308] flex-row items-center gap-1.5 px-4 py-2 rounded-full shadow-lg border border-[#FDE047]">
                                <Ionicons name="star" size={16} color="white" />
                                <Text className="text-white font-black text-xl tracking-widest">+{earnedXp}</Text>
                            </View>
                        </Animated.View>
                    )}

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
                                <View 
                                    key={currentIndex} 
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
                                </View>
                            </View>
                        </>

                </MobileGameLayout>
            </SafeAreaView>
        </>
    );
}
