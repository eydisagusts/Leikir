import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, DeviceEventEmitter, Dimensions, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MobileGameLayout } from '@/components/MobileGameLayout';
import { NativeGameEndModal } from '@/components/NativeGameEndModal';
export interface DailyDulmalData {
    quote: string;
    decryption: Record<string, string>;
    words: string[][];
}
import { useLocalSearchParams } from 'expo-router';

const ALPHABET_IS = [
    'A', 'Á', 'B', 'D', 'Ð', 'E', 'É', 'F', 'G', 'H', 'I', 'Í', 'J', 'K', 'L', 'M', 'N', 'O', 'Ó', 'P', 'R', 'S', 'T', 'U', 'Ú', 'V', 'X', 'Y', 'Ý', 'Þ', 'Æ', 'Ö'
];

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';

export default function NativeDulmal() {
    const { date, challengeId } = useLocalSearchParams<{ date: string, challengeId?: string }>();
    const [gameState, setGameState] = useState<'loading' | 'playing' | 'won' | 'lost' | 'error'>('loading');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [puzzleData, setPuzzleData] = useState<DailyDulmalData | null>(null);
    
    const [guesses, setGuesses] = useState<Record<number, string>>({});
    const [wrongGuesses, setWrongGuesses] = useState<Record<number, string>>({});
    const [mistakes, setMistakes] = useState<number>(0);
    const [activeIndex, setActiveIndex] = useState<number>(-1);
    
    const [earnedXp, setEarnedXp] = useState<number | null>(null);
    const [isFreshGameOver, setIsFreshGameOver] = useState(false);
    
    const hiddenInputRef = useRef<TextInput>(null);

    const initGame = async () => {
        setGameState('loading');
        try {
            const today = date || new Date().toISOString().split('T')[0];
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${API_URL}/api/mobile/dulmal/init?d=${today}${challengeId ? `&c=${challengeId}` : ''}`, {
                headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : undefined
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to load game');
            }
            const data = await res.json();
            const puzzle = data.puzzleData;
            
            if (!puzzle) throw new Error('Failed to fetch puzzle');
            
            setPuzzleData(puzzle);

            const user = session?.user;

            const isToday = today === new Date().toISOString().split('T')[0];
            const gameTypeKey = isToday ? 'dulmal' : `dulmal_${today}`;

            const dbPromises = user ? Promise.all([
                supabase.from('game_states').select('state_json, updated_at').eq('user_id', user.id).eq('game_type', gameTypeKey).maybeSingle(),
                supabase.from('game_results').select('won').eq('user_id', user.id).eq('game_type', 'dulmal').eq('metadata->>date', today).maybeSingle()
            ]) : Promise.resolve([{ data: null }, { data: null }]);

            const [stateRes, resultRes] = await dbPromises;

            let loadedGuesses: Record<number, string> = {};
            let loadedWrong: Record<number, string> = {};
            let loadedMistakes = 0;

            const ciphersToReveal = Object.keys(puzzle.decryption).slice(0, 6);
            const revealedCiphers = new Set<string>();

            let tempGuesses: Record<number, string> = {};
            let index = 0;
            puzzle.words.forEach((word: string[]) => {
                word.forEach((char: string) => {
                    if (/[0-9]+/.test(char)) {
                        if (resultRes.data?.won) {
                            tempGuesses[index] = puzzle.decryption[char];
                        } else if (ciphersToReveal.includes(char) && !revealedCiphers.has(char)) {
                            tempGuesses[index] = puzzle.decryption[char];
                            revealedCiphers.add(char);
                        }
                    }
                    index++;
                });
            });

            loadedGuesses = tempGuesses;

            if (user) {
                const existingResult = resultRes.data;
                const existingState = stateRes.data;

                if (existingResult) {
                    setGameState(existingResult.won ? 'won' : 'lost');
                } else {
                    setGameState('playing');
                    if (existingState && existingState.updated_at.startsWith(today)) {
                        const saved = existingState.state_json;
                        if (saved.quote === puzzle.quote) {
                            if (saved.guesses) loadedGuesses = { ...loadedGuesses, ...saved.guesses };
                            if (saved.wrongGuesses) loadedWrong = saved.wrongGuesses;
                            if (saved.mistakes) loadedMistakes = saved.mistakes;
                        }
                    } else if (existingState) {
                        await supabase.from('game_states').delete().eq('user_id', user.id).eq('game_type', gameTypeKey);
                    }
                    setTimeout(() => DeviceEventEmitter.emit('start-timer'), 500);
                }
            } else {
                setGameState('playing');
            }

            setGuesses(loadedGuesses);
            setWrongGuesses(loadedWrong);
            setMistakes(loadedMistakes);
            
            // Auto focus first available
            if (!resultRes.data) {
                const map = getCharMap(puzzle);
                let max = 0;
                for(const k in map) { if (parseInt(k) > max) max = parseInt(k); }
                for(let i=0; i<=max; i++) {
                    if (map[i] && !loadedGuesses[i]) {
                        setActiveIndex(i);
                        break;
                    }
                }
            }

        } catch (err: any) {
            setGameState('error');
            setErrorMsg(err.message);
            console.error("Init Error:", err.message);
        }
    };

    useEffect(() => {
        initGame();
    }, [date]);

    const getCharMap = (puzzle: DailyDulmalData) => {
        const m: Record<number, string> = {};
        let idx = 0;
        puzzle.words.forEach(word => {
            word.forEach(char => {
                if (/[0-9]+/.test(char)) m[idx] = char;
                idx++;
            });
        });
        return m;
    };

    const advanceCursor = () => {
        if (!puzzleData) return;
        const map = getCharMap(puzzleData);
        let max = 0;
        for(const k in map) { if (parseInt(k) > max) max = parseInt(k); }

        for(let i = activeIndex + 1; i <= max; i++) {
            if (map[i] && !guesses[i] && !wrongGuesses[i]) {
                setActiveIndex(i);
                return;
            }
        }
        for(let i = 0; i < activeIndex; i++) {
            if (map[i] && !guesses[i] && !wrongGuesses[i]) {
                setActiveIndex(i);
                return;
            }
        }
    };

    const saveState = async (newGuesses: Record<number, string>, newWrong: Record<number, string>, newMistakes: number) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const today = date || new Date().toISOString().split('T')[0];
        const isToday = today === new Date().toISOString().split('T')[0];
        const gameTypeKey = isToday ? 'dulmal' : `dulmal_${today}`;
        
        await supabase.from('game_states').upsert({
            user_id: user.id,
            game_type: gameTypeKey,
            state_json: { guesses: newGuesses, wrongGuesses: newWrong, mistakes: newMistakes, quote: puzzleData?.quote },
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, game_type' });
    };

    const handleGuess = (letter: string) => {
        if (gameState !== 'playing' || activeIndex === -1 || !puzzleData) return;
        const char = letter.toUpperCase();
        
        const map = getCharMap(puzzleData);
        const cipherChar = map[activeIndex];
        if (!cipherChar) return;

        if (char === puzzleData.decryption[cipherChar]) {
            Haptics.selectionAsync();
            const next = { ...guesses };
            
            // Only fill the specific cell the user tapped
            next[activeIndex] = char;
            
            setGuesses(next);
            saveState(next, wrongGuesses, mistakes);
            
            // Check win
            let hasWon = true;
            let max = 0;
            for(const k in map) { if (parseInt(k) > max) max = parseInt(k); }
            
            for (let i = 0; i <= max; i++) {
                if (map[i] && !next[i]) hasWon = false;
            }
            
            if (hasWon) {
                setGameState('won');
                setIsFreshGameOver(true);
                syncGameEnd(true);
            } else {
                setTimeout(advanceCursor, 10);
            }
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            const thisIndex = activeIndex;
            const newWrong = { ...wrongGuesses, [thisIndex]: char };
            const newMistakes = mistakes + 1;
            
            setWrongGuesses(newWrong);
            setMistakes(newMistakes);
            saveState(guesses, newWrong, newMistakes);

            setTimeout(() => {
                setWrongGuesses(prev => {
                    const next = { ...prev };
                    delete next[thisIndex];
                    return next;
                });
            }, 800);

            if (newMistakes >= 3) {
                setGameState('lost');
                setIsFreshGameOver(true);
                
                // Reveal all
                let g: Record<number, string> = {};
                let max = 0;
                for(const k in map) { if (parseInt(k) > max) max = parseInt(k); }
                for (let i = 0; i <= max; i++) {
                    if (map[i]) g[i] = puzzleData.decryption[map[i]];
                }
                setGuesses(g);
                syncGameEnd(false);
            }
        }
    };

    const syncGameEnd = async (won: boolean) => {
        DeviceEventEmitter.emit('stop-timer');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const today = date || new Date().toISOString().split('T')[0];
        const isToday = today === new Date().toISOString().split('T')[0];
        let xpReward = won ? (isToday ? 150 : 0) : 0;
        
        let elapsed = 60;
        const savedTime = await AsyncStorage.getItem(`timer_${user.id}_dulmal_${today}`);
        if (savedTime) elapsed = parseInt(savedTime, 10) || 60;

        await supabase.from('game_results').insert({
            time_taken_seconds: elapsed,
            user_id: user.id,
            game_type: 'dulmal',
            score: xpReward,
            won,
            metadata: { date: today }
        });

        if (won) {
            await supabase.rpc('increment_xp', { user_id_param: user.id, xp_amount: xpReward, p_locale: 'is' });
            await supabase.rpc('process_daily_streak', { user_id_param: user.id });
        }
        setEarnedXp(xpReward);
        DeviceEventEmitter.emit('refresh-stats');
    };

    let globalCharIndex = 0;

    return (
        <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />
            <MobileGameLayout gameId="dulmal" gameTitle="Dulmál" isGameOver={gameState === 'won' || gameState === 'lost'} onBack={() => router.back()}>
                {gameState === 'loading' ? (
                    <View className="flex-1 items-center justify-center p-6 text-center min-h-[300px]">
                        <ActivityIndicator size="large" color="#4338CA" />
                    </View>
                ) : gameState === 'error' || !puzzleData ? (
                    <View className="flex-1 items-center justify-center p-6 text-center min-h-[300px]">
                        <View className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 items-center w-full max-w-sm">
                            <Ionicons name="lock-closed" size={48} color="#eb3b5a" style={{ marginBottom: 16 }} />
                            <Text className="text-2xl font-black font-serif text-[#1A1A1B] mb-2 text-center">Aðgangur Lokaður</Text>
                            <Text className="text-sm font-medium text-slate-500 mb-2 text-center leading-6">{errorMsg || 'Þessi leikur krefst Dulur+ áskriftar eða netþjónn niðri.'}</Text>
                            <TouchableOpacity onPress={() => router.back()} className="bg-[#1A1A1B] w-full py-4 rounded-full shadow-md items-center mt-6">
                                <Text className="text-white font-bold text-lg">Til baka í Leiki</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View className="flex-1 flex-col items-center w-full self-center pb-8 pt-2 px-4">
                        
                        {/* Hidden Native Input */}
                        <TextInput
                            ref={hiddenInputRef}
                            style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
                            value=""
                            autoCapitalize="characters"
                            autoCorrect={false}
                            onChangeText={(t) => {
                                if (t.length > 0) handleGuess(t);
                            }}
                        />

                        {/* Intro Text */}
                        <Text className="text-slate-500 font-bold mb-6 text-center w-full px-4 text-sm">
                            Málshátturinn hefur verið dulkóðaður. Hver tölustafur stendur fyrir bókstaf.
                        </Text>

                        {/* Game Board */}
                        <View className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-200 w-full mb-8 pt-16 relative items-center">
                            
                            {/* Lives Indicator */}
                            <View className="absolute top-3 left-3 flex-row items-center bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full">
                                {[0, 1, 2].map(i => (
                                    <Ionicons 
                                        key={i} 
                                        name="heart" 
                                        size={14} 
                                        color={i < (3 - mistakes) ? "#ef4444" : "#cbd5e1"} 
                                        style={{ marginHorizontal: 2 }} 
                                    />
                                ))}
                                <Text className="text-[10px] font-black uppercase text-slate-400 ml-1">Líf</Text>
                            </View>

                            <View className="flex-row flex-wrap justify-center gap-x-4 gap-y-6">
                                {puzzleData.words.map((word, wIdx) => (
                                    <View key={wIdx} className="flex-row gap-1.5">
                                        {word.map((char, cIdx) => {
                                            const currentIndex = globalCharIndex++;
                                            const isEncrypted = /[0-9]+/.test(char);
                                            const currentGuess = guesses[currentIndex] || wrongGuesses[currentIndex] || '';
                                            const isWrong = !!wrongGuesses[currentIndex];
                                            const isActive = activeIndex === currentIndex;

                                            if (!isEncrypted) {
                                                return (
                                                    <View key={cIdx} className="justify-end items-center pb-2 px-1">
                                                        <Text className="text-2xl font-black text-slate-400">{char}</Text>
                                                    </View>
                                                );
                                            }

                                            return (
                                                <TouchableOpacity 
                                                    key={cIdx} 
                                                    activeOpacity={0.7}
                                                    onPress={() => {
                                                        if (gameState === 'playing' && !guesses[currentIndex] && !isWrong) {
                                                            setActiveIndex(currentIndex);
                                                            hiddenInputRef.current?.focus();
                                                        }
                                                    }}
                                                    className={`items-center flex-col`}
                                                >
                                                    <View className={`w-8 h-10 items-center justify-center border-b-2 rounded-t-sm
                                                        ${gameState === 'won' || guesses[currentIndex] ? 'border-[#4338CA] bg-indigo-50' 
                                                        : isWrong ? 'border-red-500 bg-red-50' 
                                                        : gameState === 'lost' ? 'border-red-500 bg-red-50' 
                                                        : isActive ? 'border-[#4338CA] bg-slate-100' : 'border-slate-300'}`
                                                    }>
                                                        <Text className={`text-xl font-bold uppercase
                                                            ${gameState === 'won' || guesses[currentIndex] ? 'text-[#4338CA]' 
                                                            : isWrong || gameState === 'lost' ? 'text-red-500' 
                                                            : isActive ? 'text-slate-800' : 'text-slate-800'}`}
                                                        >
                                                            {currentGuess}
                                                        </Text>
                                                    </View>
                                                    <Text className="text-[10px] font-mono font-bold text-slate-400 mt-1">{char}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* On Screen Keyboard */}
                        <View className={`w-full max-w-[500px] flex-row flex-wrap justify-center gap-1.5 ${gameState !== 'playing' ? 'opacity-50' : ''}`} pointerEvents={gameState === 'playing' ? 'auto' : 'none'}>
                            {ALPHABET_IS.map(letter => (
                                <TouchableOpacity
                                    key={letter}
                                    onPress={() => handleGuess(letter)}
                                    activeOpacity={0.7}
                                    className="w-8 h-12 bg-slate-100 rounded-lg items-center justify-center shadow-sm"
                                >
                                    <Text className="text-base font-bold text-slate-800">{letter}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <NativeGameEndModal
                            gameTitle="Dulmál"
                            visible={(gameState === 'won' || gameState === 'lost') && isFreshGameOver}
                            gameState={gameState as 'won' | 'lost'}
                            xpEarned={earnedXp}
                            winTitle="Vel afkóðað!"
                            winDesc="Þú leystir dulmálið."
                            loseTitle="Þú tapaðir!"
                            loseDesc="Þú kláraðir öll lífin."
                            onContinue={() => {
                                setIsFreshGameOver(false);
                                if (earnedXp && earnedXp > 0) {
                                    DeviceEventEmitter.emit('xp-earned', earnedXp);
                                }
                            }}
                        />
                    </View>
                )}
            </MobileGameLayout>
        </SafeAreaView>
    );
}
