import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Pressable, ActivityIndicator, Dimensions, DeviceEventEmitter, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { supabase } from '@/lib/supabase';
import { MobileGameLayout } from '@/components/MobileGameLayout';
import { NativeGameEndModal } from '@/components/NativeGameEndModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';
const { width } = Dimensions.get('window');

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

const KEYBOARD_LAYOUT = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ö'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Æ'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Þ', 'Ð'],
    ['Á', 'É', 'Í', 'Ó', 'Ú', 'Ý']
];

export default function NativeHengimadur() {
    const { date } = useLocalSearchParams<{ date: string }>();
    const [level, setLevel] = useState<number>(1);
    const [targetWord, setTargetWord] = useState('');
    const [guessedLetters, setGuessedLetters] = useState<string[]>([]);
    const [gameState, setGameState] = useState<'playing' | 'won' | 'lost' | 'loading' | 'error'>('loading');
    const [mistakes, setMistakes] = useState(0);

    const [earnedXp, setEarnedXp] = useState<number | null>(null);
    const [showFlyXp, setShowFlyXp] = useState(false);
    const [isFreshGameOver, setIsFreshGameOver] = useState(false);

    const xpAnimY = useSharedValue(0);
    const xpAnimOpacity = useSharedValue(1);

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

    const flyStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: xpAnimY.value }],
            opacity: xpAnimOpacity.value,
        };
    });

    const handleShare = async () => {
        const header = `Dulur: Hengimaður 🤠`;
        const xpText = earnedXp ? `\n⭐ XP: +${earnedXp}` : '';
        const message = `${header}\n${xpText}\n\nÉg giskaði á rétt orð!\ndulur.is 🔥`;
        try {
            await Share.share({ message });
        } catch (error) {
            console.error('Error sharing', error);
        }
    };

    const MAX_MISTAKES = 6;

    const handleLevelChange = (newLevel: number) => {
        if (newLevel === level) return;
        setGameState('loading');
        setGuessedLetters([]);
        setMistakes(0);
        setLevel(newLevel);
    };

    const initGame = async (l: number) => {
        try {
            const todayStr = date || new Date().toISOString().split('T')[0];
            const isToday = todayStr === new Date().toISOString().split('T')[0];
            const gameTypeKey = isToday ? `hengimadur_${l}` : `hengimadur_${l}_${todayStr}`;

            const sessionPromise = supabase.auth.getSession();
            const apiPromise = fetch(`${API_URL}/api/mobile/hengimadur/init?level=${l}&date=${todayStr}`).then(res => res.json());

            const { data: { session } } = await sessionPromise;
            const user = session?.user;

            const dbPromises = user ? Promise.all([
                supabase.from('game_states').select('state_json, updated_at').eq('user_id', user.id).eq('game_type', gameTypeKey).maybeSingle(),
                supabase.from('game_results').select('won, metadata').eq('user_id', user.id).eq('game_type', `hengimadur_${l}`).eq('metadata->>puzzleDate', todayStr).maybeSingle()
            ]) : Promise.resolve([{ data: null }, { data: null }]);

            const [data, [stateDataRes, resDataRes]] = await Promise.all([
                apiPromise,
                dbPromises
            ]);
            
            setTargetWord(data.targetWord);
            
            if (!user) {
                setGameState('playing'); 
                return; 
            }

            const stateData = stateDataRes.data;
            const resData = resDataRes.data;
            
            let loadedGuesses: string[] = [];
            let loadedMistakes = 0;

            if (stateData) {
                let isValidState = true;
                if (!date) {
                    const updatedDate = new Date(stateData.updated_at).toISOString().split('T')[0];
                    if (updatedDate !== todayStr) {
                        isValidState = false;
                        await supabase.from('game_states').delete().eq('user_id', user.id).eq('game_type', gameTypeKey);
                    }
                }

                if (isValidState) {
                    loadedGuesses = stateData.state_json.guessedLetters || [];
                    loadedMistakes = stateData.state_json.mistakes || 0;
                }
            }

            if (resData) {
                setGameState(resData.won ? 'won' : 'lost');
                if (resData.won) {
                    setGuessedLetters(Array.from(new Set(data.targetWord.split(''))));
                } else {
                    setGuessedLetters(loadedGuesses);
                }
                setMistakes(resData.metadata?.errors || 0);
            } else {
                setGameState('playing');
                setGuessedLetters(loadedGuesses);
                setMistakes(loadedMistakes);
            }

        } catch (err) {
            setGameState('error');
        }
    };

    useEffect(() => {
        initGame(level);
    }, [level, date]);

    const handleKeyPress = async (letter: string) => {
        if (gameState !== 'playing' || guessedLetters.includes(letter)) return;

        DeviceEventEmitter.emit('start-timer');

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        const newGuesses = [...guessedLetters, letter];
        setGuessedLetters(newGuesses);

        const isWrong = !targetWord.includes(letter);
        const newMistakes = isWrong ? mistakes + 1 : mistakes;

        if (isWrong) {
            setMistakes(newMistakes);
            if (newMistakes === 1) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (newMistakes === 6) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
            Haptics.selectionAsync();
        }

        const isWon = targetWord.split('').every(char => newGuesses.includes(char));
        const isLost = newMistakes >= MAX_MISTAKES;

        if (isWon) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            DeviceEventEmitter.emit('stop-timer');
            setGameState('won');
            await syncTrueResult(true, newMistakes);
        } else if (isLost) {
            DeviceEventEmitter.emit('stop-timer');
            setGameState('lost');
            await syncTrueResult(false, newMistakes);
        } else {
            await syncGameState(newGuesses, newMistakes);
        }
    };

    const syncGameState = async (guesses: string[], msts: number) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const todayStr = date || new Date().toISOString().split('T')[0];
        const isToday = todayStr === new Date().toISOString().split('T')[0];
        const gameTypeKey = isToday ? `hengimadur_${level}` : `hengimadur_${level}_${todayStr}`;
        await supabase.from('game_states').upsert({
            user_id: user.id,
            game_type: gameTypeKey,
            state_json: { guessedLetters: guesses, mistakes: msts },
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, game_type' });
    };

    const syncTrueResult = async (won: boolean, numMistakes: number) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const todayStr = date || new Date().toISOString().split('T')[0];
        const isToday = todayStr === new Date().toISOString().split('T')[0];

        const maxMistakes = 6;
        let xpReward = 0;
        
        if (won) {
            const pureBonus = Math.max(0, (maxMistakes - numMistakes) * 10);
            xpReward = 100 + pureBonus;
        } else {
            const correctCount = Array.from(new Set(targetWord.split(''))).filter(c => guessedLetters.includes(c)).length;
            xpReward = correctCount * 5;
        }
        if (!isToday) xpReward = 0;

        setEarnedXp(xpReward);
        setTimeout(() => setIsFreshGameOver(true), 1000);

        let elapsed = 60;
        const savedTime = await AsyncStorage.getItem(`timer_${user.id}_hengimadur_${level}_${todayStr}`);
        if (savedTime) elapsed = parseInt(savedTime, 10) || 60;

        await supabase.from('game_results').insert({
            time_taken_seconds: elapsed,
            user_id: user.id,
            game_type: `hengimadur_${level}`,
            score: xpReward,
            won,
            metadata: { errors: numMistakes, puzzleDate: todayStr }
        });

        if (xpReward > 0) {
            await supabase.rpc('increment_xp', { user_id_param: user.id, xp_amount: xpReward, p_locale: 'is' });
            await supabase.rpc('process_daily_streak', { user_id_param: user.id });
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top', 'bottom']}>
            <MobileGameLayout onBack={() => router.back()} gameId={`hengimadur_${level}`} gameTitle="Hengimaður" isGameOver={gameState !== 'playing'}>
            
            {gameState === 'loading' && (
                <View className="flex-1 items-center justify-center min-h-[500px]">
                    <ActivityIndicator size="large" color="#1A1A1B" />
                </View>
            )}

            {gameState === 'error' && (
                <View className="flex-1 items-center justify-center min-h-[500px] p-6 text-center">
                    <View className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 items-center w-full max-w-sm">
                        <Ionicons name="lock-closed" size={48} color="#eb3b5a" style={{ marginBottom: 16 }} />
                        <Text className="text-2xl font-black font-serif text-[#1A1A1B] mb-2 text-center">Aðgangur Lokaður</Text>
                        <Text className="text-gray-500 font-medium text-center mb-6 leading-6">Þessi erfiðleikastig krefst Dulur+ áskriftar eða netþjónn niðri.</Text>
                        <TouchableOpacity onPress={() => router.back()} className="bg-[#1A1A1B] w-full py-4 rounded-full shadow-md items-center">
                            <Text className="text-white font-bold text-lg">Til baka í Leiki</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {gameState !== 'loading' && gameState !== 'error' && (
                <>
            
            {/* Header Level Picker */}
            <View className="flex-row items-center justify-center w-full px-4 pt-2 pb-4 self-center max-w-[500px]">
                    <View className="flex-row items-center gap-1 bg-[#F0F0F0] rounded-full p-1.5 border border-[#D3D6DA]">
                        <Pressable onPress={() => handleLevelChange(1)} className={`px-5 py-3 rounded-full flex-row items-center gap-1.5 ${level === 1 ? 'bg-white shadow-sm' : ''}`}>
                            <Text className={`font-bold text-sm ${level === 1 ? 'text-[#1A1A1B]' : 'text-gray-500'}`}>Stutt</Text>
                        </Pressable>
                        <Pressable onPress={() => handleLevelChange(2)} className={`px-5 py-3 rounded-full flex-row items-center gap-1.5 ${level === 2 ? 'bg-white shadow-sm' : ''}`}>
                            <Text className={`font-bold text-sm ${level === 2 ? 'text-[#1A1A1B]' : 'text-gray-500'}`}>Miðlungs</Text>
                        </Pressable>
                        <Pressable onPress={() => handleLevelChange(3)} className={`px-5 py-3 rounded-full flex-row items-center gap-1.5 ${level === 3 ? 'bg-white shadow-sm' : ''}`}>
                            <Text className={`font-bold text-sm ${level === 3 ? 'text-[#1A1A1B]' : 'text-gray-500'}`}>Langt</Text>
                        </Pressable>
                    </View>
            </View>

            {/* Hangman SVG Canvas */}
            <View className="items-center justify-center my-6" style={{ height: 200 }}>
                <Svg width={200} height={200} viewBox="0 0 200 200">
                    {/* Gallows Base */}
                    <Line x1="10" y1="190" x2="190" y2="190" stroke="#1A1A1B" strokeWidth="10" strokeLinecap="round" />
                    <Line x1="50" y1="190" x2="50" y2="20" stroke="#1A1A1B" strokeWidth="10" strokeLinecap="round" />
                    <Line x1="50" y1="20" x2="150" y2="20" stroke="#1A1A1B" strokeWidth="10" strokeLinecap="round" />
                    <Line x1="150" y1="20" x2="150" y2="40" stroke="#64748B" strokeWidth="5" strokeLinecap="round" />
                    
                    {/* Visual Mistakes */}
                    {mistakes >= 1 && <AnimatedCircle cx="150" cy="60" r="20" stroke="#EF4444" strokeWidth="5" fill="none" entering={FadeIn.duration(300)} />}
                    {mistakes >= 2 && <AnimatedLine x1="150" y1="80" x2="150" y2="130" stroke="#EF4444" strokeWidth="5" strokeLinecap="round" entering={FadeIn.duration(300)} />}
                    {mistakes >= 3 && <AnimatedLine x1="150" y1="90" x2="120" y2="120" stroke="#EF4444" strokeWidth="5" strokeLinecap="round" entering={FadeIn.duration(300)} />}
                    {mistakes >= 4 && <AnimatedLine x1="150" y1="90" x2="180" y2="120" stroke="#EF4444" strokeWidth="5" strokeLinecap="round" entering={FadeIn.duration(300)} />}
                    {mistakes >= 5 && <AnimatedLine x1="150" y1="130" x2="120" y2="170" stroke="#EF4444" strokeWidth="5" strokeLinecap="round" entering={FadeIn.duration(300)} />}
                    {mistakes >= 6 && <AnimatedLine x1="150" y1="130" x2="180" y2="170" stroke="#EF4444" strokeWidth="5" strokeLinecap="round" entering={FadeIn.duration(300)} />}
                </Svg>
            </View>

            {/* Hidden Word Display */}
            <View className="flex-row flex-wrap justify-center px-4 mb-10 gap-x-3 gap-y-4">
                {targetWord.split('').map((char, idx) => {
                    const isRevealed = guessedLetters.includes(char) || gameState === 'lost' || gameState === 'won';
                    const isMissing = !guessedLetters.includes(char) && gameState === 'lost';
                    return (
                        <View key={idx} className="items-center justify-end" style={{ width: 32, height: 48, borderBottomWidth: 3, borderBottomColor: isMissing ? '#EF4444' : '#1A1A1B' }}>
                            <Text className={`font-black font-serif text-3xl pb-1 ${isMissing ? 'text-red-500' : 'text-[#1A1A1B]'}`}>
                                {isRevealed ? char : ''}
                            </Text>
                        </View>
                    );
                })}
            </View>

            {/* Status Messages */}
            <NativeGameEndModal
                gameTitle="Hengimann"
                visible={(gameState === 'won' || gameState === 'lost') && isFreshGameOver}
                gameState={gameState as 'won' | 'lost'}
                xpEarned={earnedXp}
                winTitle="Lifaði Af!"
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

            {/* Native Keyboard */}
            <View className="w-full px-2 pb-8 flex-1 justify-end">
                {KEYBOARD_LAYOUT.map((row, rIdx) => (
                    <View key={rIdx} className="flex-row justify-center mb-2 gap-1.5">
                        {row.map(char => {
                            const isGuessed = guessedLetters.includes(char);
                            const isCorrect = isGuessed && targetWord.includes(char);
                            const isWrong = isGuessed && !targetWord.includes(char);
                            
                            let bgColor = '#E5E7EB'; 
                            let textColor = '#1A1A1B';

                            if (isCorrect) {
                                bgColor = '#10B981'; // Green
                                textColor = '#ffffff';
                            } else if (isWrong) {
                                bgColor = '#EF4444'; // Red
                                textColor = '#ffffff';
                            }

                            return (
                                <TouchableOpacity 
                                    key={char}
                                    activeOpacity={0.7}
                                    onPress={() => handleKeyPress(char)}
                                    disabled={isGuessed || gameState !== 'playing'}
                                    style={{
                                        backgroundColor: bgColor,
                                        width: (Dimensions.get('window').width - 40) / 11.5,
                                        maxWidth: 42,
                                        height: 52,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        borderRadius: 8,
                                        opacity: isWrong ? 0.6 : 1
                                    }}
                                >
                                    <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 18 }}>{char}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}
            </View>
                </>
            )}
            </MobileGameLayout>
        </SafeAreaView>
    );
}
