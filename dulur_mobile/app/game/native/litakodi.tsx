import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter, Share } from 'react-native';
import { Animated } from 'react-native';
import { MobileGameLayout } from '@/components/MobileGameLayout';
import { NativeGameEndModal } from '@/components/NativeGameEndModal';
import { supabase } from '@/lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';

type PegColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'orange' | 'pink' | 'cyan' | 'lime';
const ALL_COLORS: PegColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan', 'lime'];
const MAX_GUESSES = 6;
const CODE_LENGTH = 4;

type Feedback = {
    exactMatches: number;
    partialMatches: number;
};

type RowState = {
    guess: (PegColor | null)[];
    feedback: Feedback | null;
    isSubmitted: boolean;
};

const ColorMap: Record<PegColor, string> = {
    red: '#ef4444',
    blue: '#3b82f6',
    green: '#22c55e',
    yellow: '#eab308',
    purple: '#a855f7',
    orange: '#f97316',
    pink: '#ec4899',
    cyan: '#06b6d4',
    lime: '#84cc16'
};

export default function NativeLitakodi() {
    const [secretCode, setSecretCode] = useState<PegColor[] | null>(null);
    const [gameState, setGameState] = useState<'playing' | 'won' | 'lost' | 'loading'>('loading');
    
    const [rows, setRows] = useState<RowState[]>(() => {
        return Array(MAX_GUESSES).fill(null).map(() => ({
            guess: Array(CODE_LENGTH).fill(null),
            feedback: null,
            isSubmitted: false
        }));
    });
    
    const [currentRowIndex, setCurrentRowIndex] = useState(0);

    const [earnedXp, setEarnedXp] = useState<number | null>(null);
    const [showFlyXp, setShowFlyXp] = useState(false);
    const [isFreshGameOver, setIsFreshGameOver] = useState(false);
    
    // XP Animation vars
    const xpAnimY = React.useRef(new Animated.Value(0)).current;
    const xpAnimOpacity = React.useRef(new Animated.Value(1)).current;

    const flyStyle = {
        transform: [{ translateY: xpAnimY }],
        opacity: xpAnimOpacity,
    };

    useEffect(() => {
        async function init() {
            try {
                const today = new Date().toISOString().split('T')[0];

                const sessionPromise = supabase.auth.getSession();
                const apiPromise = fetch(`${API_URL}/api/mobile/litakodi/init`).then(res => res.json());

                const { data: { session } } = await sessionPromise;
                const user = session?.user;

                const dbPromises = user ? Promise.all([
                    supabase.from('game_results')
                        .select('won')
                        .eq('user_id', user.id)
                        .eq('game_type', 'litakodi')
                        .gte('played_at', `${today}T00:00:00Z`).order('played_at', { ascending: false }).limit(1).maybeSingle(),
                    supabase.from('game_states').select('state_json, updated_at').eq('user_id', user.id).eq('game_type', 'litakodi').maybeSingle()
                ]) : Promise.resolve([{ data: null }, { data: null }]);

                const [data, [resDataRes, stateDataRes]] = await Promise.all([
                    apiPromise,
                    dbPromises
                ]);

                setSecretCode(data.code);
                
                if (!user) {
                    setGameState('playing');
                    return;
                }

                const resData = resDataRes.data;
                const stateData = stateDataRes.data;

                if (stateData && stateData.state_json && stateData.updated_at.startsWith(today)) {
                    setRows(stateData.state_json.rows || rows);
                    setCurrentRowIndex(stateData.state_json.currentRowIndex || 0);
                } else if (stateData) {
                    // Removed game_states deletion to preserve state for replay visualization
                }

                if (resData) {
                    setGameState(resData.won ? 'won' : 'lost');
                    // We DO have the historic board gracefully loaded here now.
                } else {
                    // Timer will start on first interaction
                    setGameState('playing');
                }
            } catch (err) {
                setGameState('playing');
            }
        }
        init();
        return () => { DeviceEventEmitter.emit('stop-timer'); };
    }, []);

    const completeGame = async (statusArg: 'won' | 'lost', finalRows: RowState[], targetRow: number) => {
        DeviceEventEmitter.emit('stop-timer');
        setGameState(statusArg);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let elapsed = 0;
        const date = new Date().toISOString().split('T')[0];
        const key = `timer_${user.id}_litakodi_${date}`;
        const savedTime = await AsyncStorage.getItem(key);
        if (savedTime) elapsed = parseInt(savedTime, 10) || 0;

        const xpReward = statusArg === 'won' ? (100 + ((MAX_GUESSES - (targetRow + 1)) * 20)) : 0;

        const { error } = await supabase.from('game_results').insert({
            time_taken_seconds: elapsed,
            user_id: user.id,
            game_type: 'litakodi',
            score: xpReward,
            won: statusArg === 'won',
            metadata: { rows: finalRows } as any // Use metadata column for historic data matching Web schema
        });

        if (error) {
            console.error("Litakodi result insert failed:", error);
            setTimeout(() => setIsFreshGameOver(true), 1000);
            return;
        }

        // Clear state sync tag
        // Removed game_states deletion to preserve state for replay visualization

        if (xpReward > 0) {
            await supabase.rpc('increment_xp', { user_id_param: user.id, xp_amount: xpReward, p_locale: 'is' });
            setEarnedXp(xpReward);
        }
        setTimeout(() => setIsFreshGameOver(true), 1000);
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
        const header = `Dulur: Litakóði 🎨`;
        const xpText = earnedXp ? `\n⭐ XP: +${earnedXp}` : '';
        const mText = `Tilraunir: ${currentRowIndex + 1}/6`;
        const message = `${header}\n${mText}${xpText}\n\nÉg braut kóðann!\ndulur.is 🔥`;
        try {
            await Share.share({ message });
        } catch (error) {
            console.error('Error sharing', error);
        }
    };

    const syncState = async (nextRows: RowState[], nextIndex: number) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const today = new Date().toISOString().split('T')[0];
        supabase.from('game_states').upsert({
            user_id: user.id,
            game_type: 'litakodi',
            state_json: { rows: nextRows, currentRowIndex: nextIndex },
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, game_type' }).then();
    };

    const handlePegClick = (colIndex: number) => {
        if (gameState !== 'playing') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        DeviceEventEmitter.emit('start-timer');
        
        setRows(prev => {
            const next = [...prev.map(r => ({ ...r, guess: [...r.guess] }))];
            const guess = next[currentRowIndex].guess;
            const current = guess[colIndex];
            
            if (!current) {
                guess[colIndex] = ALL_COLORS[0];
            } else {
                const i = ALL_COLORS.indexOf(current);
                if (i === ALL_COLORS.length - 1) guess[colIndex] = null;
                else guess[colIndex] = ALL_COLORS[i + 1];
            }
            return next;
        });
    };

    const handleColorPaletteSelect = (color: PegColor) => {
        if (gameState !== 'playing') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        DeviceEventEmitter.emit('start-timer');

        setRows(prevRows => {
            const newRows = [...prevRows.map(r => ({ ...r, guess: [...r.guess] }))];
            const currentGuess = newRows[currentRowIndex].guess;
            
            // Try to find the first empty spot to auto-fill
            const firstEmptyMap = currentGuess.findIndex(c => c === null);
            if (firstEmptyMap !== -1) {
                currentGuess[firstEmptyMap] = color;
            } else {
                // If full, we replace the last item for UX ease when spam tapping
                currentGuess[CODE_LENGTH - 1] = color;
            }
            return newRows;
        });
    };

    const handleDelete = () => {
        if (gameState !== 'playing') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        DeviceEventEmitter.emit('start-timer');

        setRows(prevRows => {
            const newRows = [...prevRows.map(r => ({ ...r, guess: [...r.guess] }))];
            const currentGuess = newRows[currentRowIndex].guess;
            for (let i = CODE_LENGTH - 1; i >= 0; i--) {
                if (currentGuess[i] !== null) {
                    currentGuess[i] = null;
                    break;
                }
            }
            return newRows;
        });
    };

    const handleSubmit = () => {
        if (gameState !== 'playing' || !secretCode) return;
        DeviceEventEmitter.emit('start-timer');
        
        const guess = rows[currentRowIndex].guess;
        if (guess.includes(null)) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        const secCode = [...secretCode];
        const gCode = [...guess] as PegColor[];

        let ex = 0;
        let p = 0;

        for (let i = 0; i < CODE_LENGTH; i++) {
            if (gCode[i] === secCode[i]) {
                ex++;
                secCode[i] = null as any;
                gCode[i] = undefined as any;
            }
        }

        for (let i = 0; i < CODE_LENGTH; i++) {
            if (gCode[i] !== undefined) {
                const mi = secCode.indexOf(gCode[i]);
                if (mi !== -1) {
                    p++;
                    secCode[mi] = null as any;
                }
            }
        }

        const newRows = [...rows];
        newRows[currentRowIndex] = {
            guess: [...guess],
            feedback: { exactMatches: ex, partialMatches: p },
            isSubmitted: true
        };

        setRows(newRows);

        if (ex === CODE_LENGTH) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            syncState(newRows, currentRowIndex);
            completeGame('won', newRows, currentRowIndex);
        } else if (currentRowIndex === MAX_GUESSES - 1) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            syncState(newRows, currentRowIndex);
            completeGame('lost', newRows, currentRowIndex);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const nextIdx = currentRowIndex + 1;
            setCurrentRowIndex(nextIdx);
            syncState(newRows, nextIdx);
        }
    };

    if (gameState === 'loading' || !secretCode) {
        return (
            <View className="flex-1 bg-[#FAFAFA] items-center justify-center">
                <ActivityIndicator size="large" color="#1A1A1B" />
            </View>
        );
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
            <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={["top", "bottom"]}>
                <MobileGameLayout onBack={() => router.back()} gameId="litakodi" gameTitle="Litakóði" isGameOver={gameState !== 'playing'}>
            
            <NativeGameEndModal
                gameTitle="Litakóða"
                visible={gameState !== 'playing' && isFreshGameOver}
                gameState={gameState as "won" | "lost"}
                xpEarned={earnedXp}
                winTitle={gameState === 'won' ? 'Vel gert!' : 'Leik lokið'}
                winDesc={gameState === 'won' ? `Kóðinn var brotinn í ${currentRowIndex + 1} tilraunum!` : 'Þér mistókst að brjóta kóðann.'}
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



            <View className="flex-1 w-full flex-col px-4 pb-12 max-w-[500px] self-center items-center">
                
                {/* Board */}
                    <View className="w-full flex-col gap-3 p-4 bg-white rounded-3xl border border-gray-200 shadow-sm mt-4">
                        
                        {gameState !== 'playing' && secretCode && isFreshGameOver === false && (
                            <View className="w-full flex-row items-center p-4 mb-2 rounded-2xl bg-slate-100 border border-slate-200 shadow-sm justify-between">
                                <Text className="text-slate-800 font-black uppercase text-xs tracking-[2px]">Lausn:</Text>
                                <View className="flex-row items-center flex-1 justify-end gap-2 pr-14">
                                    {secretCode.map((c, idx) => (
                                        <View 
                                            key={`secret-${idx}`} 
                                            className="w-10 h-10 rounded-full shadow-sm border-2 border-white"
                                            style={{
                                                backgroundColor: ColorMap[c],
                                                shadowColor: '#000',
                                                shadowOpacity: 0.1,
                                                shadowRadius: 3,
                                                shadowOffset: { width: 0, height: 2 },
                                                elevation: 2
                                            }}
                                        />
                                    ))}
                                </View>
                            </View>
                        )}
                        {rows.map((row, r) => {
                            const isActive = r === currentRowIndex && gameState === 'playing';

                            return (
                                <View 
                                    key={r} 
                                    className={`flex-row items-center p-2 rounded-2xl ${isActive ? 'bg-indigo-50 border border-indigo-200' : 'bg-transparent'}`}
                                >
                                    
                                    {/* Guesses */}
                                    <View className="flex-row items-center gap-2 flex-1">
                                        {row.guess.map((c, idx) => (
                                            <TouchableOpacity 
                                                key={idx} 
                                                activeOpacity={isActive ? 0.8 : 1}
                                                onPress={() => isActive && handlePegClick(idx)}
                                                className="w-12 h-12 rounded-full border-[3px] items-center justify-center shadow-sm"
                                                style={{ 
                                                    backgroundColor: c ? ColorMap[c] : '#FAFAFA', 
                                                    borderColor: c ? 'rgba(0,0,0,0.1)' : '#E2E8F0',
                                                    borderStyle: c ? 'solid' : 'dashed'
                                                }}
                                            />
                                        ))}
                                    </View>

                                    {/* Divider */}
                                    <View className="w-px h-10 bg-gray-300 mx-3" />

                                    {/* Feedback Block */}
                                    <View className="w-10 h-10 flex-row flex-wrap justify-between items-center bg-gray-100 rounded-lg p-1">
                                        {(() => {
                                            if (!row.feedback) {
                                                return Array.from({ length: 4 }).map((_, i) => (
                                                    <View key={i} className="w-[14px] h-[14px] rounded-full bg-gray-200 mb-0.5" />
                                                ));
                                            }
                                            
                                            const pegs = [];
                                            for(let i=0; i<row.feedback.exactMatches; i++) pegs.push('E');
                                            for(let i=0; i<row.feedback.partialMatches; i++) pegs.push('P');
                                            while(pegs.length < CODE_LENGTH) pegs.push('N');

                                            return pegs.map((p, i) => (
                                                <View 
                                                    key={i} 
                                                    className={`w-[14px] h-[14px] rounded-full mb-0.5 ${p === 'E' ? 'bg-[#1A1A1B]' : p === 'P' ? 'bg-white border-[1.5px] border-gray-300' : 'bg-transparent'}`} 
                                                />
                                            ));
                                        })()}
                                    </View>
                                </View>
                            )
                        })}
                    </View>

                    {/* Palletes and interactions below */}
                    {gameState === 'playing' && (
                        <View className="w-full mt-6 mb-6">
                            <View className="flex-row flex-wrap justify-center gap-3 p-4 bg-white border border-gray-200 rounded-3xl shadow-sm mb-4">
                                {ALL_COLORS.slice(0, 6).map(color => (
                                    <TouchableOpacity
                                        key={color}
                                        onPress={() => handleColorPaletteSelect(color)}
                                        className="w-12 h-12 rounded-full border-2 border-black/10 shadow-sm"
                                        style={{ backgroundColor: ColorMap[color] }}
                                    />
                                ))}
                            </View>
                            <View className="flex-row justify-between gap-3 px-2">
                                <TouchableOpacity 
                                    onPress={handleDelete}
                                    className="flex-1 items-center justify-center py-4 bg-white border border-gray-200 rounded-2xl shadow-sm"
                                >
                                    <Ionicons name="backspace-outline" size={24} color="#64748b" />
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    disabled={rows[currentRowIndex].guess.includes(null)}
                                    onPress={handleSubmit}
                                    className={`flex-[2] items-center justify-center py-4 rounded-2xl shadow-sm ${rows[currentRowIndex].guess.includes(null) ? 'bg-gray-300' : 'bg-[#1A1A1B]'}`}
                                >
                                    <Text className="text-white font-bold text-lg font-serif">Giska</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                </View>
        </MobileGameLayout>
            </SafeAreaView>
        </>
    );
}
