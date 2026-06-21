import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, Animated as RNAnimated } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter, Share } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { MobileGameLayout } from '@/components/MobileGameLayout';
import { NativeGameEndModal } from '@/components/NativeGameEndModal';
import { supabase, getFreshSession } from '@/lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';
const { width } = Dimensions.get('window');
// Calculate card size: we want 4 columns. Padding around board is px-6 = 48px. 4 cards per row, plus gap.
// Let's just use a fixed calculation: max-w is 500. So max board width is 500-48 = 452.
const BOARD_WIDTH = Math.min(width - 48, 452);
const CARD_SIZE = Math.floor((BOARD_WIDTH / 4) - 8); // 8px for margins/gaps

type MinnisspilCard = {
    id: number;
    iconId: keyof typeof Ionicons.glyphMap;
};

type MinnisspilGameData = {
    cards: MinnisspilCard[];
};

// Map the web's Lucide icons to native Ionicons approximately
const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    'Cat': 'paw',
    'Dog': 'logo-octocat',
    'Bird': 'leaf',
    'Fish': 'water',
    'Bug': 'bug',
    'Rabbit': 'logo-amplify',
    'Turtle': 'disc',
    'Snail': 'help-buoy',
    'Star': 'star',
    'Moon': 'moon',
    'Sun': 'sunny',
    'Cloud': 'cloud',
    'Heart': 'heart',
    'Zap': 'flash',
    'Diamond': 'diamond'
};

const CardComponent = ({ 
    card, 
    isFlipped, 
    isMatched, 
    onPress 
}: { 
    card: MinnisspilCard; 
    isFlipped: boolean; 
    isMatched: boolean; 
    onPress: () => void;
}) => {
    const flipValue = useSharedValue(isFlipped || isMatched ? 180 : 0);
    const scaleValue = useSharedValue(1);

    useEffect(() => {
        flipValue.value = withTiming(isFlipped || isMatched ? 180 : 0, { duration: 400 });
        if (isMatched) {
            scaleValue.value = withSpring(1.05, {}, () => {
                scaleValue.value = withSpring(1);
            });
        }
    }, [isFlipped, isMatched]);

    const frontAnimatedStyle = useAnimatedStyle(() => {
        const rotateY = `${flipValue.value + 180}deg`;
        return {
            transform: [{ rotateY }, { scale: scaleValue.value }],
            zIndex: isFlipped || isMatched ? 1 : 0,
            opacity: flipValue.value > 90 ? 1 : 0,
            backfaceVisibility: 'hidden',
        };
    });

    const backAnimatedStyle = useAnimatedStyle(() => {
        const rotateY = `${flipValue.value}deg`;
        return {
            transform: [{ rotateY }, { scale: scaleValue.value }],
            opacity: flipValue.value < 90 ? 1 : 0, // Fallback for android backface
            backfaceVisibility: 'hidden',
        };
    });

    const IconName = iconMap[card.iconId as string] || 'help';

    return (
        <TouchableOpacity activeOpacity={1} onPress={onPress} style={{ width: CARD_SIZE, height: CARD_SIZE, margin: 4 }} className="relative preserve-3d">
            {/* Back of Card (Face Down) */}
            <Animated.View 
                style={[backAnimatedStyle]} 
                className="absolute inset-0 bg-[#4F46E5]/10 border-2 border-[#4F46E5]/20 rounded-2xl flex items-center justify-center shadow-sm z-10"
            >
                <Ionicons name="help" size={24} color="#4F46E5" style={{ opacity: 0.4 }} />
            </Animated.View>

            {/* Front of Card (Face Up) */}
            <Animated.View 
                style={[frontAnimatedStyle]} 
                className={`absolute inset-0 bg-white border-2 rounded-2xl flex items-center justify-center shadow-md z-0 ${isMatched ? 'border-green-500/50 bg-green-500/10' : 'border-gray-200'}`}
            >
                <Ionicons name={IconName} size={32} color={isMatched ? '#16a34a' : '#1A1A1B'} />
            </Animated.View>
        </TouchableOpacity>
    );
};

export default function NativeMinnisspil() {
    const { date } = useLocalSearchParams<{ date: string }>();
    const [game, setGame] = useState<MinnisspilGameData | null>(null);
    const [gameState, setGameState] = useState<'playing' | 'won' | 'loading' | 'error'>('loading');
    
    const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
    const [matchedIcons, setMatchedIcons] = useState<string[]>([]);
    const [isLocked, setIsLocked] = useState(false);
    
    const [turns, setTurns] = useState(0);
    const [mistakes, setMistakes] = useState(0);

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

    useEffect(() => {
        async function init() {
            try {
                const today = date || new Date().toISOString().split('T')[0];
                
                const session = await getFreshSession();
                const apiPromise = fetch(`${API_URL}/api/mobile/minnisspil/init?date=${today}`, {
                    headers: session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : undefined
                }).then(async res => {
                    if (!res.ok) {
                        const errData = await res.json().catch(() => ({}));
                        throw new Error(errData.error || 'Failed to load game');
                    }
                    return res.json();
                });
                const user = session?.user;

                const isToday = today === new Date().toISOString().split('T')[0];
                const gameTypeKey = isToday ? 'minnisspil' : `minnisspil_${today}`;

                const dbPromises = user ? Promise.all([
                    supabase.from('game_results')
                        .select('score')
                        .eq('user_id', user.id)
                        .eq('game_type', 'minnisspil')
                        .eq('metadata->>puzzleDate', today).maybeSingle(),
                    supabase.from('game_states').select('state_json, updated_at').eq('user_id', user.id).eq('game_type', gameTypeKey).maybeSingle(),
                    supabase.from('profiles').select('is_subscribed').eq('id', user.id).maybeSingle()
                ]) : Promise.resolve([{ data: null }, { data: null }, { data: null }]);

                const [data, [resDataRes, stateDataRes, profileRes]] = await Promise.all([
                    apiPromise,
                    dbPromises
                ]);

                setGame(data as MinnisspilGameData);
                
                const userIsSubscribed = !!profileRes?.data?.is_subscribed;
                if (!user || !userIsSubscribed) {
                    setGameState('error');
                    return;
                }

                const resData = resDataRes.data;
                const stateData = stateDataRes.data;

                if (stateData) {
                    let isValidState = true;
                    if (!date) {
                        const updatedDate = new Date(stateData.updated_at).toISOString().split('T')[0];
                        if (updatedDate !== today) {
                            isValidState = false;
                            await supabase.from('game_states').delete().eq('user_id', user.id).eq('game_type', gameTypeKey);
                        }
                    }

                    if (isValidState && stateData.state_json) {
                        setTurns(stateData.state_json.turns || 0);
                        setMistakes(stateData.state_json.mistakes || 0);
                        setMatchedIcons(stateData.state_json.matchedIcons || []);
                        setFlippedIndices(stateData.state_json.flippedIndices || []);
                    }
                }

                if (resData) {
                    setGameState('won');
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
    }, [date]);

    const completeGame = async (finalMistakes: number) => {
        DeviceEventEmitter.emit('stop-timer');
        setGameState('won');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let elapsed = 0;
        const todayStr = date || new Date().toISOString().split('T')[0];
        const isToday = todayStr === new Date().toISOString().split('T')[0];
        const key = `timer_${user.id}_minnisspil_${todayStr}`;
        const savedTime = await AsyncStorage.getItem(key);
        if (savedTime) elapsed = parseInt(savedTime, 10);
        
        setFinalTime(elapsed);

        const penalty = finalMistakes * 10;
        let bonus = 150 - penalty;
        if (bonus < 0) bonus = 0;
        const xpReward = isToday ? 50 + bonus : 0;

        await supabase.from('game_results').insert({
            time_taken_seconds: elapsed,
            user_id: user.id,
            game_type: 'minnisspil',
            score: xpReward, // score is reward, web logic does this via DB insert score: finalReward
            won: true,
            metadata: { mistakes: finalMistakes, matchedIcons: game?.cards.map(c => c.iconId), puzzleDate: todayStr } // Web passes metadata
        });

        // Clear web state flag!
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
        const header = `Dulur: Minnisspil 🧠`;
        const xpText = earnedXp ? `\n⭐ XP: +${earnedXp}` : '';
        const mText = `Tilraunir: ${turns}`;
        const message = `${header}\n${mText}${xpText}\n\nÉg leysti minnisspilið!\ndulur.is 🔥`;
        try {
            await Share.share({ message });
        } catch (error) {
            console.error('Error sharing', error);
        }
    };

    const syncState = async (nextTurns: number, nextMistakes: number, nextMatched: string[], nextFlipped: number[]) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const todayStr = date || new Date().toISOString().split('T')[0];
        const isToday = todayStr === new Date().toISOString().split('T')[0];
        const gameTypeKey = isToday ? 'minnisspil' : `minnisspil_${todayStr}`;
        supabase.from('game_states').upsert({
            user_id: user.id,
            game_type: gameTypeKey,
            state_json: { turns: nextTurns, mistakes: nextMistakes, matchedIcons: nextMatched, flippedIndices: nextFlipped },
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, game_type' }).then();
    };

    const handleCardClick = (index: number) => {
        if (gameState !== 'playing' || isLocked || !game) return;
        if (flippedIndices.includes(index) || matchedIcons.includes(game.cards[index].iconId as string)) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        DeviceEventEmitter.emit('start-timer');

        const newFlipped = [...flippedIndices, index];
        setFlippedIndices(newFlipped);

        if (newFlipped.length === 2) {
            setIsLocked(true);
            const nextTurns = turns + 1;
            setTurns(nextTurns);

            const card1 = game.cards[newFlipped[0]];
            const card2 = game.cards[newFlipped[1]];

            if (card1.iconId === card2.iconId) {
                // Match
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                const nextMatched = [...matchedIcons, card1.iconId as string];
                setMatchedIcons(nextMatched);
                setFlippedIndices([]);
                setIsLocked(false);

                if (nextMatched.length === 10) {
                    completeGame(mistakes);
                } else {
                    syncState(nextTurns, mistakes, nextMatched, []);
                }
            } else {
                // Mismatch
                const nextMistakes = mistakes + 1;
                setMistakes(nextMistakes);
                syncState(nextTurns, nextMistakes, matchedIcons, newFlipped);

                setTimeout(() => {
                    setFlippedIndices([]);
                    setIsLocked(false);
                    syncState(nextTurns, nextMistakes, matchedIcons, []);
                }, 1000);
            }
        }
    };

    if (gameState === 'loading' || !game) {
        return (
            <SafeAreaView className="flex-1 bg-[#FAFAFA] items-center justify-center">
                <Stack.Screen options={{ headerShown: false }} />
                <ActivityIndicator size="large" color="#1A1A1B" />
            </SafeAreaView>
        );
    }

    if (gameState === 'error') {
        return (
            <SafeAreaView className="flex-1 bg-[#FAFAFA] items-center justify-center p-6 text-center" edges={['top', 'bottom']}>
                <Stack.Screen options={{ headerShown: false }} />
                <View className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 items-center w-full max-w-sm">
                    <Ionicons name="lock-closed" size={48} color="#eb3b5a" style={{ marginBottom: 16 }} />
                    <Text className="text-2xl font-black font-serif text-[#1A1A1B] mb-2 text-center">Aðgangur Lokaður</Text>
                    <Text className="text-gray-500 font-medium text-center mb-6 leading-6">Þessi leikur krefst Dulur+ áskriftar eða netþjónn niðri.</Text>
                    <TouchableOpacity onPress={() => router.back()} className="bg-[#1A1A1B] w-full py-4 rounded-full shadow-md items-center">
                        <Text className="text-white font-bold text-lg">Til baka í Leiki</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
            <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top', 'bottom']}>
                <MobileGameLayout onBack={() => router.back()} gameId="minnisspil" gameTitle="Minnisspil" isGameOver={gameState !== 'playing'}>
            
            {/* Header info */}
            <View className="w-full px-6 mb-6 self-center max-w-[500px]">
                <View className="w-full flex-row justify-between items-center bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                    <View className="flex-col">
                        <Text className="text-xs font-bold text-gray-500 uppercase tracking-widest">Tilraunir</Text>
                        <Text className="text-2xl font-black text-[#4F46E5] leading-none">{turns}</Text>
                    </View>
                </View>
            </View>

            <NativeGameEndModal
                gameTitle="Minnisspil"
                visible={gameState === 'won' && isFreshGameOver}
                gameState="won"
                xpEarned={earnedXp}
                winTitle="Leik lokið!"
                winDesc={`Þú leystir spilið í ${turns} tilraunum.`}
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

            <View className="flex-1 w-full flex-row flex-wrap justify-center px-6 pb-20 max-w-[500px] self-center">
                {game.cards.map((card, index) => (
                    <CardComponent 
                        key={index}
                        card={card}
                        isFlipped={gameState === 'won' ? true : flippedIndices.includes(index)}
                        isMatched={gameState === 'won' ? true : matchedIcons.includes(card.iconId as string)}
                        onPress={() => handleCardClick(index)}
                    />
                ))}
            </View>
        </MobileGameLayout>
        </SafeAreaView>
        </>
    );
}
