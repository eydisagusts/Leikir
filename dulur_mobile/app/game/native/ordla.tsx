import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, TouchableOpacity, ActivityIndicator, Dimensions, DeviceEventEmitter, Share, TextInput, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, withTiming, withSequence, withDelay, interpolate, useSharedValue, Easing, Layout, FadeIn, FadeOut } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MobileGameLayout } from '@/components/MobileGameLayout';
import { NativeGameEndModal } from '@/components/NativeGameEndModal';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';

type LetterState = 'correct' | 'present' | 'absent' | 'empty' | 'tbd';

interface Guess {
    word: string;
    states: LetterState[];
}

const NATIVE_LAYOUT = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ö'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Æ'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Þ', 'Ð', 'BACK'],
    ['Á', 'É', 'Í', 'Ó', 'Ú', 'Ý', 'ENTER']
];

function AnimatedCell({ char, state, index, isRevealing, wordLength }: { char: string, state: LetterState, index: number, isRevealing: boolean, wordLength: number }) {
    const flip = useSharedValue(0);

    useEffect(() => {
        if (isRevealing) {
            flip.value = withDelay(
                index * 300, 
                withSequence(
                    withTiming(-90, { duration: 150 }), 
                    withTiming(0, { duration: 150 })
                )
            );
        } else {
            flip.value = 0; // Static state
        }
    }, [isRevealing]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ perspective: 800 }, { rotateX: `${flip.value}deg` }]
        };
    });

    const innerStyle = useAnimatedStyle(() => {
        let bgColor = 'transparent';
        let borderColor = '#D3D6DA'; 
        
        if (state === 'tbd') {
            borderColor = '#CBD5E1'; // Soft slate border
        }

        if (state !== 'empty' && state !== 'tbd') {
            borderColor = 'transparent';
            if (state === 'correct') bgColor = '#22C55E';
            if (state === 'present') bgColor = '#EAB308';
            if (state === 'absent') { bgColor = '#E2E8F0'; borderColor = '#E2E8F0'; }
        }

        return {
            backgroundColor: bgColor,
            borderColor: borderColor,
        };
    });

    const isCellRevealed = (state !== 'empty' && state !== 'tbd') && (!isRevealing || flip.value === 0);

    return (
        <Animated.View style={[{ width: 44, height: 44, marginHorizontal: 3, marginBottom: 6, zIndex: isRevealing ? 50 : 1 }, animatedStyle]}>
            <Animated.View style={[{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: state === 'tbd' ? 0.03 : 0, shadowRadius: 2, elevation: state === 'tbd' ? 1 : 0 }, innerStyle]}>
                <Text style={{ 
                    fontSize: 24, 
                    fontWeight: '800', 
                    color: isCellRevealed ? (state === 'absent' ? '#64748B' : 'white') : (state === 'tbd' ? '#0F172A' : '#94A3B8') 
                }}>
                    {char}
                </Text>
            </Animated.View>
        </Animated.View>
    );
}

export default function NativeOrdla() {
    const { date, challengeId } = useLocalSearchParams<{ date: string, challengeId?: string }>();
    const [wordLength, setWordLength] = useState<number>(5);
    const MAX_GUESSES = 6;
    
    const [targetWord, setTargetWord] = useState('');
    const [dictionary, setDictionary] = useState<Set<string>>(new Set());
    const [guesses, setGuesses] = useState<Guess[]>([]);
    const [currentGuess, setCurrentGuess] = useState('');
    const [gameState, setGameState] = useState<'playing' | 'won' | 'lost' | 'loading' | 'error'>('loading');
    const [isRevealing, setIsRevealing] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    const inputRef = useRef<TextInput>(null);

    const [earnedXp, setEarnedXp] = useState<number | null>(null);
    const [showFlyXp, setShowFlyXp] = useState(false);
    const [isFreshGameOver, setIsFreshGameOver] = useState(false);

    const handleWordLengthChange = (len: number) => {
        if (len === wordLength) return;
        setGameState('loading');
        setGuesses([]);
        setCurrentGuess('');
        setEarnedXp(null);
        setShowFlyXp(false);
        setIsFreshGameOver(false);
        setWordLength(len);
    };

    const initGame = async (length: number) => {
        setGameState('loading');
        try {
            const todayStr = date || new Date().toISOString().split('T')[0];
            const isToday = todayStr === new Date().toISOString().split('T')[0];
            const gameTypeKey = isToday ? `ordla_${length}` : `ordla_${length}_${todayStr}`;
            
            const sessionPromise = supabase.auth.getSession();
            const apiPromise = fetch(`${API_URL}/api/mobile/ordla/init?length=${length}&date=${todayStr}${challengeId ? `&challengeId=${challengeId}` : ''}`).then(res => res.json());

            const { data: { session } } = await sessionPromise;
            const user = session?.user;

            const dbPromises = user ? Promise.all([
                supabase.from('game_states').select('state_json, updated_at').eq('user_id', user.id).eq('game_type', gameTypeKey).maybeSingle(),
                supabase.from('game_results').select('won, metadata').eq('user_id', user.id).eq('game_type', `ordla_${length}`).eq('metadata->>puzzleDate', todayStr).maybeSingle()
            ]) : Promise.resolve([{ data: null }, { data: null }]);

            const [data, [stateRes, resultRes]] = await Promise.all([
                apiPromise,
                dbPromises
            ]);
            
            setTargetWord(data.targetWord);
            setDictionary(new Set(data.dict));
            setGuesses([]);
            setCurrentGuess('');
            
            if (!user) { setGameState('playing'); return; }

            const existingState = stateRes.data;
            const existingResult = resultRes.data;

            if (existingState) {
                let isValidState = true;
                if (!date) {
                    const updatedDate = new Date(existingState.updated_at).toISOString().split('T')[0];
                    if (updatedDate !== todayStr) {
                        isValidState = false;
                        await supabase.from('game_states').delete().eq('user_id', user.id).eq('game_type', gameTypeKey);
                    }
                }
                
                if (isValidState) {
                    setGuesses(existingState.state_json.guesses || []);
                }
            }

            if (existingResult) {
                setGameState(existingResult.won ? 'won' : 'lost');
                if (existingResult.metadata?.guessList) {
                    setGuesses(existingResult.metadata.guessList);
                }
            } else {
                setGameState('playing');
                // Force timer to actively start explicitly if a player left an unfinished game
                if (existingState && existingState.state_json.guesses && existingState.state_json.guesses.length > 0) {
                    setTimeout(() => DeviceEventEmitter.emit('start-timer'), 500);
                }
            }

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (err) {
            setToast('Gat ekki sótt leik eða læstur.');
            setGameState('error');
        }
    }

    useEffect(() => {
        initGame(wordLength);
    }, [wordLength, date]);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2000);
    }

    const onKeyPress = (key: string) => {
        if (gameState !== 'playing' || isRevealing) return;

        // Trigger native timer on any input identical to web behavior
        DeviceEventEmitter.emit('start-timer');

        if (key === 'BACK') {
            if (currentGuess.length > 0) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setCurrentGuess(prev => prev.slice(0, -1));
            }
            return;
        }

        if (key === 'ENTER') {
            if (currentGuess.length !== wordLength) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                showToast("Orðið er ekki nógu langt");
                return;
            }

            // Urgent bypass: The actual answer must ALWAYS be accepted as a valid word, even if server dictionaries are out of sync.
            if (currentGuess !== targetWord && !dictionary.has(currentGuess)) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                showToast("Orð ekki í orðabók");
                return;
            }

            validateGuess();
            return;
        }

        if (currentGuess.length < wordLength) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setCurrentGuess(prev => prev + key);
        }
    };

    const handleTextChange = (text: string) => {
        if (gameState !== 'playing' || isRevealing) return;
        DeviceEventEmitter.emit('start-timer');
        const filtered = text.toUpperCase().replace(/[^A-ZÁÉÍÓÚÝÐÞÆÖ]/g, '');
        const truncated = filtered.slice(0, wordLength);
        if (truncated !== currentGuess) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setCurrentGuess(truncated);
        }
    };

    const handleSubmit = () => {
        if (gameState !== 'playing' || isRevealing) return;
        onKeyPress('ENTER');
    };

    const validateGuess = async () => {
        setIsRevealing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const states: LetterState[] = Array(wordLength).fill('absent');
        const tLetters = targetWord.split('');
        const gLetters = currentGuess.split('');

        // First pass
        gLetters.forEach((l, i) => {
            if (l === tLetters[i]) { states[i] = 'correct'; tLetters[i] = '.'; }
        });

        // Second pass
        gLetters.forEach((l, i) => {
            if (states[i] !== 'correct' && tLetters.includes(l)) {
                states[i] = 'present';
                tLetters[tLetters.indexOf(l)] = '.';
            }
        });

        const finalStates = states;
        const newGuesses = [...guesses, { word: currentGuess, states: Array(wordLength).fill('tbd') as LetterState[] }];
        setGuesses(newGuesses);
        setCurrentGuess('');

        // Provide success/warn haptics based on states
        setTimeout(() => {
            if (finalStates.every(s => s === 'correct')) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        }, wordLength * 300);

        // Sequence state changes identically to Next.js mid-flip timing
        finalStates.forEach((st, j) => {
            setTimeout(() => {
                setGuesses(prev => {
                    const next = [...prev];
                    const lastGuess = next[next.length - 1];
                    if (lastGuess) lastGuess.states[j] = st;
                    return next;
                });
            }, j * 300 + 150);
        });

        setTimeout(async () => {
            setIsRevealing(false);
            const isWin = finalStates.every(s => s === 'correct');
            const isLoss = !isWin && newGuesses.length >= MAX_GUESSES;

            if (isWin || isLoss) {
                setGameState(isWin ? 'won' : 'lost');
                setTimeout(() => setIsFreshGameOver(true), 1000);
                newGuesses[newGuesses.length - 1].states = finalStates;
                await syncTrueResult(isWin, newGuesses);
            } else {
                await syncGameState(newGuesses);
            }
        }, wordLength * 300 + 300);
    };

    const syncGameState = async (newGuesses: Guess[]) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const todayStr = date || new Date().toISOString().split('T')[0];
        const isToday = todayStr === new Date().toISOString().split('T')[0];
        const gameTypeKey = isToday ? `ordla_${wordLength}` : `ordla_${wordLength}_${todayStr}`;
        await supabase.from('game_states').upsert({
            user_id: user.id,
            game_type: gameTypeKey,
            state_json: { guesses: newGuesses },
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, game_type' });
    }

    const syncTrueResult = async (won: boolean, guessList: Guess[]) => {
        DeviceEventEmitter.emit('stop-timer');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const todayStr = date || new Date().toISOString().split('T')[0];
        const isToday = todayStr === new Date().toISOString().split('T')[0];

        let xpReward = 50;
        if (won) {
            const penalty = (guessList.length - 1) * 15;
            xpReward = Math.max(100, Math.min(220, 100 + (80 - penalty)));
        }
        if (!isToday) xpReward = 0;

        let elapsed = 60;
        const savedTime = await AsyncStorage.getItem(`timer_${user.id}_ordla_${wordLength}_${todayStr}`);
        if (savedTime) elapsed = parseInt(savedTime, 10) || 60;

        await supabase.from('game_results').insert({
            time_taken_seconds: elapsed,
            user_id: user.id,
            game_type: `ordla_${wordLength}`,
            score: xpReward,
            won,
            metadata: { guesses: guessList.length, guessList, puzzleDate: todayStr }
        });

        // Clear the in-progress state explicitly
        const gameTypeKey = isToday ? `ordla_${wordLength}` : `ordla_${wordLength}_${todayStr}`;
        await supabase.from('game_states').delete().eq('user_id', user.id).eq('game_type', gameTypeKey);

        if (xpReward > 0) {
            await supabase.rpc('increment_xp', { user_id_param: user.id, xp_amount: xpReward, p_locale: 'is' });
            await supabase.rpc('process_daily_streak', { user_id_param: user.id });
        }
        setEarnedXp(xpReward);
    }

    const getKeyboardState = () => {
        const states: Record<string, LetterState> = {};
        guesses.forEach(g => {
            g.word.split('').forEach((char, i) => {
                const state = g.states[i];
                if (state === 'correct') {
                    states[char] = 'correct';
                } else if (state === 'present') {
                    if (states[char] !== 'correct') states[char] = 'present';
                } else if (state === 'absent') {
                    if (!states[char]) states[char] = 'absent';
                }
            });
        });
        return states;
    }

    const handleShare = async () => {
        const title = `Orðla ${wordLength}`;
        const resultEmoji = gameState === 'won' ? '🟩' : '🟥';
        let boxes = '';
        guesses.forEach(g => {
            if (g.states.includes('empty') || g.states.includes('tbd')) return;
            g.states.forEach(state => {
                if (state === 'correct') boxes += '🟩';
                else if (state === 'present') boxes += '🟨';
                else boxes += '⬜';
            });
            boxes += '\n';
        });

        const header = `Dulur: ${title} ${resultEmoji}`;
        const xpText = earnedXp ? `\n⭐ XP: +${earnedXp}` : '';
        const attempts = gameState === 'won' ? `${guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
        const message = `${header}\nTilraunir: ${attempts}\n\n${boxes}${xpText}\n\ndulur.is 🔥`;

        try {
            await Share.share({ message });
        } catch (error) {
            console.error('Error sharing', error);
        }
    };

    const xpAnimY = useSharedValue(0);
    const xpAnimOpacity = useSharedValue(1);

    const handleCloseModal = () => {
        setIsFreshGameOver(false);
        if (earnedXp && earnedXp > 0) {
            setShowFlyXp(true);
            xpAnimY.value = 0;
            xpAnimOpacity.value = 1;
            // Target the header's Y coordinate (roughly -300 from center modal depending on device)
            xpAnimY.value = withTiming(-350, { duration: 1200 });
            xpAnimOpacity.value = withTiming(0, { duration: 1200 });
            setTimeout(() => {
                setShowFlyXp(false);
                DeviceEventEmitter.emit('xp-earned', earnedXp);
            }, 1300);
        }
    };

    const flyStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: xpAnimY.value }],
            opacity: xpAnimOpacity.value,
        };
    });

    const keyboardStates = getKeyboardState();

    const rows = Array.from({ length: MAX_GUESSES }).map((_, i) => {
        if (i < guesses.length) return { ...guesses[i], isRevealing: isRevealing && i === guesses.length - 1 };
        if (i === guesses.length) return { word: currentGuess.padEnd(wordLength, ' '), states: Array(wordLength).fill('tbd') as LetterState[], isRevealing: false };
        return { word: ' '.repeat(wordLength), states: Array(wordLength).fill('empty') as LetterState[], isRevealing: false };
    });

    // Extract UI
    return (
        <>
            <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top', 'bottom']}>
                <MobileGameLayout gameId={`ordla_${wordLength}`} gameTitle="Orðla" isGameOver={gameState !== 'playing'} onBack={() => router.back()}>
                    {gameState === 'loading' ? (
                        <View className="flex-1 items-center justify-center p-6 text-center min-h-[300px]">
                            <ActivityIndicator size="large" color="#538D4E" />
                        </View>
                    ) : gameState === 'error' ? (
                        <View className="flex-1 items-center justify-center p-6 text-center min-h-[300px]">
                            <View className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 items-center w-full max-w-sm">
                                <Ionicons name="lock-closed" size={48} color="#eb3b5a" style={{ marginBottom: 16 }} />
                                <Text className="text-2xl font-black font-serif text-[#1A1A1B] mb-2 text-center">Aðgangur Lokaður</Text>
                                <Text className="text-gray-500 font-medium text-center mb-6 leading-6">Þessi erfiðleikastig krefst Dulur+ áskriftar eða netþjónn niðri.</Text>
                                <TouchableOpacity onPress={() => router.back()} className="bg-[#1A1A1B] w-full py-4 rounded-full shadow-md items-center">
                                    <Text className="text-white font-bold text-lg">Til baka í Leiki</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()} accessible={false}>
                            <View className="flex-1 flex-col items-center w-full self-center pb-2 pt-2">
                                <View className="flex-row items-center justify-center gap-2 bg-[#F0F0F0] rounded-full p-1.5 border border-[#D3D6DA] self-center mb-6 z-10">
                                    {[5,6,7].map(len => (
                                        <Pressable 
                                            key={len} 
                                            onPress={() => handleWordLengthChange(len)} 
                                            className={`px-5 py-2.5 rounded-full ${wordLength === len ? 'bg-white shadow-sm border border-gray-100' : ''}`}
                                        >
                                            <Text className={`font-bold text-sm ${wordLength === len ? 'text-[#1A1A1B]' : 'text-gray-500'}`}>{len} stafir</Text>
                                        </Pressable>
                                    ))}
                                </View>

                                {toast && (
                                    <View style={{ position: 'absolute', top: 60, left: 0, right: 0, zIndex: 999, elevation: 10, alignItems: 'center' }} pointerEvents="none">
                                        <View className="bg-[#1A1A1B] px-4 py-3 rounded-xl shadow-lg">
                                            <Text className="text-white font-bold">{toast}</Text>
                                        </View>
                                    </View>
                                )}

                                <Pressable onPress={() => inputRef.current?.focus()} className="w-full flex-1 justify-center items-center self-center mb-6 relative">
                                    <TextInput
                                        ref={inputRef}
                                        value={currentGuess}
                                        onChangeText={handleTextChange}
                                        onSubmitEditing={handleSubmit}
                                        autoCorrect={false}
                                        autoCapitalize="characters"
                                        maxLength={wordLength}
                                        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                                        spellCheck={false}
                                    />
                                    {rows.map((row, rIdx) => (
                                        <View key={rIdx} className="flex-row w-full justify-center" pointerEvents="none">
                                            {row.word.split('').map((char, cIdx) => (
                                                <AnimatedCell 
                                                    key={cIdx} 
                                                    char={char === ' ' ? '' : char} 
                                                    state={row.states[cIdx]} 
                                                    index={cIdx} 
                                                    isRevealing={row.isRevealing} 
                                                    wordLength={wordLength}
                                                />
                                            ))}
                                        </View>
                                    ))}
                                </Pressable>

                        <NativeGameEndModal
                gameTitle="Orðlu"
                            visible={(gameState === 'won' || gameState === 'lost') && !isRevealing && isFreshGameOver}
                            gameState={gameState as 'won' | 'lost'}
                            xpEarned={earnedXp}
                            winTitle="Vel gert!"
                            winDesc={`Orðið var: ${targetWord}`}
                            loseTitle="Því miður!"
                            loseDesc={`Orðið var: ${targetWord}`}
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

                        <View className="w-full max-w-[500px] px-2 pb-8 self-center">
                            {NATIVE_LAYOUT.map((r, i) => (
                                <View key={i} className="flex-row justify-center mb-1.5 w-full">
                                    {r.map((key) => {
                                        const state = keyboardStates[key] || 'empty';
                                        const isSpecial = key === 'ENTER' || key === 'BACK';
                                        
                                        let bgColor = '#D3D6DA';
                                        let textCol = '#1A1A1B';
                                        if (state === 'correct') { bgColor = '#22C55E'; textCol = 'white'; }
                                        if (state === 'present') { bgColor = '#EAB308'; textCol = 'white'; }
                                        if (state === 'absent') { bgColor = '#94A3B8'; textCol = 'white'; }

                                        return (
                                            <TouchableOpacity 
                                                key={key}
                                                onPress={() => onKeyPress(key)}
                                                activeOpacity={0.7}
                                                style={{ 
                                                    backgroundColor: bgColor, 
                                                    flex: isSpecial ? 1.5 : 1, 
                                                    height: 52, 
                                                    marginHorizontal: 3, 
                                                    borderRadius: 8, 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center',
                                                    shadowColor: '#000',
                                                    shadowOffset: { width: 0, height: 2 },
                                                    shadowOpacity: 0.1,
                                                    shadowRadius: 2,
                                                    elevation: 2
                                                }}
                                            >
                                                {key === 'BACK' ? <Ionicons name="backspace-outline" size={24} color={textCol} /> : 
                                                <Text style={{ fontSize: isSpecial ? 13 : 18, fontWeight: '800', color: textCol }}>{key}</Text>}
                                            </TouchableOpacity>
                                        )
                                    })}
                                </View>
                            ))}
                        </View>
                            </View>
                        </TouchableWithoutFeedback>
                    )}
                </MobileGameLayout>
            </SafeAreaView>
        </>
    );
}
