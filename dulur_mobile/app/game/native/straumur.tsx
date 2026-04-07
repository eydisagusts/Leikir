import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, PanResponder, StyleSheet, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Share } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { MobileGameLayout } from '@/components/MobileGameLayout';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';
const { width } = Dimensions.get('window');

type Coordinate = { r: number; c: number };

interface StraumurGameData {
    id: number;
    themeDisplay: string;
    spangram: { word: string; description: string; coords: Coordinate[] };
    themeWords: { word: string; coords: Coordinate[] }[];
    grid: string[][];
}

export default function NativeStraumur() {
    const [game, setGame] = useState<StraumurGameData | null>(null);
    const [gameState, setGameState] = useState<'playing' | 'won' | 'loading' | 'error'>('loading');
    
    // Found words
    const [foundWords, setFoundWords] = useState<string[]>([]);
    const [foundPaths, setFoundPaths] = useState<Coordinate[][]>([]);
    
    // Hint System
    const [hintsEarned, setHintsEarned] = useState(0);
    const [nonThemeWordsFound, setNonThemeWordsFound] = useState<string[]>([]);
    const [hintedCoords, setHintedCoords] = useState<Coordinate[]>([]);
    
    // Active Drag
    const [activePath, setActivePath] = useState<Coordinate[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [errorShake, setErrorShake] = useState(false);
    
    const [earnedXp, setEarnedXp] = useState<number | null>(null);
    const [showFlyXp, setShowFlyXp] = useState(false);
    const [isFreshGameOver, setIsFreshGameOver] = useState(false);

    const boardRef = useRef<View>(null);
    const [boardLayout, setBoardLayout] = useState<{ x: number, y: number, width: number, height: number } | null>(null);

    // Animations
    const shakeOffset = useSharedValue(0);
    const shakeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shakeOffset.value }]
    }));
    
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
        const title = game.themeDisplay;
        const header = `Dulur: Straumur 🟩`;
        const xpText = earnedXp ? `\n⭐ XP: +${earnedXp}` : '';
        const message = `${header}\nÞema: ${title}${xpText}\n\nÉg kláraði strauminn!\ndulur.is 🔥`;

        try {
            await Share.share({ message });
        } catch (error) {
            console.error('Error sharing', error);
        }
    };

    useEffect(() => {
        async function init() {
            try {
                const res = await fetch(`${API_URL}/api/mobile/straumur/init`);
                if (!res.ok) throw new Error('API down');
                const data: StraumurGameData = await res.json();
                setGame(data);
                
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setGameState('playing');
                    return;
                }

                const today = new Date().toISOString().split('T')[0];
                const { data: resData } = await supabase.from('game_results')
                    .select('won')
                    .eq('user_id', user.id)
                    .eq('game_type', 'straumur')
                    .gte('played_at', `${today}T00:00:00Z`).single();
                
                if (resData) {
                    setGameState('won');
                    setFoundWords([...data.themeWords.map(t => t.word), data.spangram.word]);
                    setFoundPaths([...data.themeWords.map(t => t.coords), data.spangram.coords]);
                } else {
                    const { data: stateData } = await supabase.from('game_states').select('state_json, updated_at').eq('user_id', user.id).eq('game_type', `straumur_${today}`).single();
                    if (stateData) {
                        setFoundWords(stateData.state_json.foundWords || []);
                        setFoundPaths(stateData.state_json.foundPaths || []);
                    }
                    setGameState('playing');
                }
            } catch (err) {
                setGameState('error');
            }
        }
        init();
    }, []);

    const triggerError = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setErrorShake(true);
        shakeOffset.value = withSequence(
            withTiming(-5, { duration: 40 }),
            withTiming(5, { duration: 40 }),
            withTiming(-5, { duration: 40 }),
            withTiming(5, { duration: 40 }),
            withTiming(0, { duration: 40 })
        );
        setTimeout(() => {
            setActivePath([]);
            setErrorShake(false);
        }, 300);
    };

    const panResponder = React.useMemo(() => 
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onStartShouldSetPanResponderCapture: () => true,
            onMoveShouldSetPanResponderCapture: () => true,
            onPanResponderGrant: (evt) => {
                if (gameState !== 'playing' || !game) return;
                DeviceEventEmitter.emit('start-timer');
                setIsDragging(true);
                const { locationX, locationY } = evt.nativeEvent;
                addPointToPath(locationX, locationY);
            },
            onPanResponderMove: (evt) => {
                if (gameState !== 'playing' || !game) return;
                const { locationX, locationY } = evt.nativeEvent;
                addPointToPath(locationX, locationY);
            },
            onPanResponderRelease: () => {
                setIsDragging(false);
                validatePath();
            },
            onPanResponderTerminate: () => {
                setIsDragging(false);
                setActivePath([]);
            }
        }), [gameState, game, foundWords, foundPaths, isDragging, activePath]);

    const addPointToPath = (locationX: number, locationY: number) => {
        if (!game) return;

        const PADDING = 20;
        const TOTAL_WIDTH = Dimensions.get('window').width - (PADDING * 2);
        const cols = game.grid[0].length;
        const rows = game.grid.length;
        
        const cellWidth = TOTAL_WIDTH / cols;
        const cellHeight = cellWidth;
        
        const c = Math.floor(locationX / cellWidth);
        const r = Math.floor(locationY / cellHeight);

        // Check if out of bounds
        if (r < 0 || r >= rows || c < 0 || c >= cols) return;
        
        // Prevent touching already found words
        const isFound = foundPaths.some(p => p.some(coord => coord.r === r && coord.c === c));
        if (isFound) return;

        setActivePath(prev => {
            if (prev.length === 0) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                return [{ r, c }];
            }
            
            const lastNode = prev[prev.length - 1];
            
            // Check if backtracking
            if (prev.length > 1) {
                const secondLast = prev[prev.length - 2];
                if (secondLast.r === r && secondLast.c === c) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    return prev.slice(0, -1);
                }
            }
            
            // If it's a new adjacent node
            if (lastNode.r === r && lastNode.c === c) return prev;
            
            // Validate adjacency (horizontal, vertical, or diagonal)
            const rDiff = Math.abs(lastNode.r - r);
            const cDiff = Math.abs(lastNode.c - c);
            
            if (rDiff <= 1 && cDiff <= 1 && !(rDiff === 0 && cDiff === 0)) {
                // Ensure not already in path
                if (!prev.some(coord => coord.r === r && coord.c === c)) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    return [...prev, { r, c }];
                }
            } else {
                // FAST SWIPE INTERPOLATION (Frame skipping patch)
                if (rDiff === 0 || cDiff === 0 || rDiff === cDiff) {
                    const steps = Math.max(rDiff, cDiff);
                    const stepR = rDiff === 0 ? 0 : (r - lastNode.r) / rDiff;
                    const stepC = cDiff === 0 ? 0 : (c - lastNode.c) / cDiff;
                    
                    const newPath = [...prev];
                    let isValidInterpolation = true;
                    
                    for (let i = 1; i <= steps; i++) {
                        const midR = lastNode.r + i * stepR;
                        const midC = lastNode.c + i * stepC;
                        
                        const hitFound = foundPaths.some(p => p.some(coord => coord.r === midR && coord.c === midC));
                        if (hitFound || newPath.some(coord => coord.r === midR && coord.c === midC)) {
                            isValidInterpolation = false;
                            break;
                        }
                        newPath.push({ r: midR, c: midC });
                    }
                    
                    if (isValidInterpolation) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        return newPath;
                    }
                }
            }
            return prev;
        });
    };

    const validatePath = async () => {
        if (!game || activePath.length === 0) return;
        
        // Construct the word
        const currentWord = activePath.map(coord => game.grid[coord.r][coord.c]).join('');
        
        // Check if it matches Spangram
        const isSpangram = currentWord === game.spangram.word || currentWord === game.spangram.word.split('').reverse().join('');
        if (isSpangram && !foundWords.includes(game.spangram.word)) {
            successFound(game.spangram.word, true);
            return;
        }
        
        // Check if it matches a theme word
        const matchedTheme = game.themeWords.find(t => t.word === currentWord || t.word === currentWord.split('').reverse().join(''));
        if (matchedTheme && !foundWords.includes(matchedTheme.word)) {
            successFound(matchedTheme.word, false);
            return;
        }

        // Check if it's a generic >3 letter word to boost hints
        if (currentWord.length >= 4 && !nonThemeWordsFound.includes(currentWord)) {
            setNonThemeWordsFound(prev => [...prev, currentWord]);
            setHintsEarned(prev => Math.min(3, prev + 1));
        }

        // Invalid word
        triggerError();
    };

    const handleHint = async () => {
        if (hintsEarned < 3 || !game) return;
        DeviceEventEmitter.emit('start-timer');
        setHintsEarned(0);
        
        const unfoundTheme = game.themeWords.find(tw => !foundWords.includes(tw.word));
        if (unfoundTheme) {
            setHintedCoords(prev => [...prev, ...unfoundTheme.coords]);
        } else if (!foundWords.includes(game.spangram.word)) {
            setHintedCoords(prev => [...prev, ...game.spangram.coords]);
        }
        
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.rpc('increment_xp', { user_id_param: user.id, xp_amount: -10, p_locale: 'is' });
            DeviceEventEmitter.emit('xp-earned', -10);
        }
    };

    const successFound = async (word: string, isSpangram: boolean) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        const newFoundWords = [...foundWords, word];
        const newFoundPaths = [...foundPaths, [...activePath]];
        
        setFoundWords(newFoundWords);
        setFoundPaths(newFoundPaths);
        setActivePath([]);
        
        setHintedCoords(prev => prev.filter(hc => !activePath.some(ac => ac.r === hc.r && ac.c === hc.c)));
        
        syncGameState(newFoundWords, newFoundPaths);

        // Check overall win
        if (newFoundWords.length === game!.themeWords.length + 1) {
            DeviceEventEmitter.emit('stop-timer');
            setGameState('won');
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('game_results').insert({
                    time_taken_seconds: 120,
                    user_id: user.id,
                    game_type: 'straumur',
                    score: 100,
                    won: true,
                    metadata: { difficulty: 'medium' }
                });
                await supabase.rpc('increment_xp', { user_id_param: user.id, xp_amount: 100, p_locale: 'is' });
                setEarnedXp(100);
                setIsFreshGameOver(true);
            }
        }
    };

    const syncGameState = async (words: string[], paths: Coordinate[][]) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !game) return;
        const today = new Date().toISOString().split('T')[0];
        supabase.from('game_states').upsert({
            user_id: user.id,
            game_type: `straumur_${today}`,
            state_json: { foundWords: words, foundPaths: paths },
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, game_type' }).then();
    };


    if (gameState === 'loading' || !game) {
        return (
            <>
                <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
                <SafeAreaView className="flex-1 bg-[#FAFAFA] items-center justify-center">
                    <ActivityIndicator size="large" color="#1A1A1B" />
                </SafeAreaView>
            </>
        );
    }

    if (gameState === 'error') {
        return (
            <>
                <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
                <SafeAreaView className="flex-1 bg-[#FAFAFA] items-center justify-center p-6 text-center" edges={['top', 'bottom']}>
                    <View className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 items-center w-full max-w-sm">
                        <Ionicons name="lock-closed" size={48} color="#eb3b5a" style={{ marginBottom: 16 }} />
                        <Text className="text-2xl font-black font-serif text-[#1A1A1B] mb-2 text-center">Aðgangur Lokaður</Text>
                        <Text className="text-gray-500 font-medium text-center mb-6 leading-6">Þessi erfiðleikastig krefst Dulur+ áskriftar eða netþjónn niðri.</Text>
                        <TouchableOpacity onPress={() => router.back()} className="bg-[#1A1A1B] w-full py-4 rounded-full shadow-md items-center">
                            <Text className="text-white font-bold text-lg">Til baka í Leiki</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </>
        );
    }

    const PADDING = 20;
    const TOTAL_WIDTH = width - (PADDING * 2);
    const COLS = game.grid[0].length;
    const ROWS = game.grid.length;
    
    // We want relatively square cells
    const CELL_SIZE = TOTAL_WIDTH / COLS;
    const TOTAL_HEIGHT = CELL_SIZE * ROWS;

    // Helper to get exact center pixel of a cell
    const getCenter = (r: number, c: number) => {
        return {
            x: (c * CELL_SIZE) + (CELL_SIZE / 2),
            y: (r * CELL_SIZE) + (CELL_SIZE / 2)
        };
    };

    const getPolylinePoints = (path: Coordinate[]) => {
        return path.map(p => {
            const center = getCenter(p.r, p.c);
            return `${center.x},${center.y}`;
        }).join(' ');
    };

    let wordsLeft = game.themeWords.length + 1 - foundWords.length;

    return (
        <>
        <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
        <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top', 'bottom']}>
            <MobileGameLayout onBack={() => router.back()} gameId="straumur" gameTitle="Straumur" scrollEnabled={!isDragging} isGameOver={gameState !== 'playing'}>
                
            {gameState === 'won' && !isDragging && isFreshGameOver && (
                <View className="absolute top-1/4 self-center bg-white px-6 py-8 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] items-center z-40 w-[85%] max-w-[340px] border border-gray-200">
                    <TouchableOpacity 
                        onPress={handleCloseModal}
                        className="absolute top-4 right-4 p-2 z-50 bg-gray-100 rounded-full"
                    >
                        <Ionicons name="close" size={24} color="#64748B" />
                    </TouchableOpacity>

                    <View className="w-20 h-20 rounded-full items-center justify-center mb-4 bg-green-100 border-4 border-green-200">
                        <Text className="text-4xl">🏆</Text>
                    </View>

                    <Text className="text-3xl font-black font-serif text-[#1A1A1B] mb-2">Vel gert!</Text>
                    <Text className="text-lg font-medium text-gray-500 mb-6 text-center">Þú fannst öll þemaorðin ásamt Spangraminu!</Text>

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

                <View className="flex-1 justify-center w-full">

            <View className="px-6 mt-2 mb-6 items-center">
                <Text className="text-[#1A1A1B] font-bold text-lg text-center leading-6">{game.themeDisplay}</Text>
                
                <TouchableOpacity 
                    onPress={handleHint}
                    disabled={hintsEarned < 3}
                    className={`mt-4 w-full max-w-[280px] h-12 flex-row items-center justify-between px-4 rounded-2xl shadow-sm overflow-hidden ${hintsEarned >= 3 ? 'bg-[#1A1A1B]' : 'bg-white border border-gray-200'}`}
                >
                    <View className="flex-row items-center gap-2 z-10">
                        <Ionicons name="bulb" size={16} color={hintsEarned >= 3 ? "#EAB308" : "#9CA3AF"} />
                        <Text className={`font-bold ${hintsEarned >= 3 ? 'text-white' : 'text-gray-400'}`}>Vísbending</Text>
                        {hintsEarned >= 3 && <Text className="ml-1 text-xs opacity-80 text-gray-300 font-normal">-10 XP</Text>}
                    </View>
                    
                    <View className="flex-row gap-1.5 z-10">
                        {[1, 2, 3].map(i => (
                            <View key={i} className={`w-3 h-3 rounded-full ${hintsEarned >= i ? (hintsEarned >= 3 ? 'bg-white' : 'bg-[#1A1A1B]') : 'bg-gray-200'}`} />
                        ))}
                    </View>
                    
                    {hintsEarned < 3 && (
                        <View 
                            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(hintsEarned / 3) * 100}%`, backgroundColor: 'rgba(26,26,27,0.05)', zIndex: 0 }} 
                        />
                    )}
                </TouchableOpacity>
            </View>

            <View className="flex-1 items-center justify-center">
                <Animated.View 
                    style={[shakeStyle, { width: TOTAL_WIDTH, height: TOTAL_HEIGHT, position: 'relative' }]}
                    /* @ts-ignore */
                    ref={boardRef}
                    onLayout={(e) => {
                        const { width, height } = e.nativeEvent.layout;
                        setBoardLayout({ x: 0, y: 0, width, height });
                    }}
                >
                    {/* SVG Layer Underneath rendering all found paths AND current path */}
                    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                        {foundPaths.map((path, idx) => {
                            // Check if this path is the spangram
                            const word = path.map(coord => game.grid[coord.r][coord.c]).join('');
                            const isSpan = word === game.spangram.word || word === game.spangram.word.split('').reverse().join('');
                            
                            return (
                                <Polyline 
                                    key={`found-${idx}`}
                                    points={getPolylinePoints(path)} 
                                    fill="none" 
                                    stroke={isSpan ? "#eab308" : "#2563eb"} // Yellow or Blue
                                    strokeWidth={CELL_SIZE * 0.7} 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                    opacity={0.3} // Faded opacity so it minimizes visually
                                />
                            );
                        })}
                        
                        {activePath.length > 0 && (
                            <Polyline 
                                points={getPolylinePoints(activePath)} 
                                fill="none" 
                                stroke={errorShake ? "#ef4444" : "#93c5fd"} // Red Error or Light Blue Current
                                strokeWidth={CELL_SIZE * 0.7} 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                opacity={0.6}
                            />
                        )}
                    </Svg>

                    {/* Nodes Layer */}
                    {game.grid.map((row, rIdx) => (
                        <View key={rIdx} className="flex-row absolute" style={{ top: rIdx * CELL_SIZE }}>
                            {row.map((letter, cIdx) => {
                                const isFound = foundPaths.some(p => p.some(coord => coord.r === rIdx && coord.c === cIdx));
                                const isActive = activePath.some(coord => coord.r === rIdx && coord.c === cIdx);
                                const isHinted = hintedCoords.some(h => h.r === rIdx && h.c === cIdx);
                                
                                return (
                                    <Animated.View 
                                        key={cIdx} 
                                        pointerEvents="none"
                                        style={[
                                            { 
                                                width: CELL_SIZE, 
                                                height: CELL_SIZE, 
                                                justifyContent: 'center', 
                                                alignItems: 'center',
                                                borderWidth: isHinted && !isFound && !isActive ? 3 : 0,
                                                borderColor: '#93c5fd',
                                                borderStyle: 'dashed',
                                                borderRadius: CELL_SIZE / 2,
                                                backgroundColor: isHinted && !isFound && !isActive ? 'rgba(59,130,246,0.1)' : 'transparent'
                                            },
                                            isFound ? { opacity: 0.4, transform: [{ scale: 0.85 }] } : {}
                                        ]}
                                    >
                                        <Text style={{ 
                                            fontSize: 24, 
                                            fontFamily: 'serif', 
                                            fontWeight: '900', 
                                            color: errorShake && isActive ? '#ef4444' : isActive || isFound ? '#1A1A1B' : '#71717A',
                                        }}>
                                            {letter}
                                        </Text>
                                    </Animated.View>
                                );
                            })}
                        </View>
                    ))}
                    
                    <View 
                        {...panResponder.panHandlers}
                        style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 100, elevation: 10, backgroundColor: 'rgba(255,255,255,0.01)' }} 
                    />
                </Animated.View>
            </View>

            <View className="mt-8 flex-row flex-wrap justify-center w-full max-w-sm self-center gap-2 px-4 pb-12">
                {game.themeWords.map((tw, idx) => {
                    const found = foundWords.includes(tw.word);
                    return (
                        <View key={idx} className={`px-4 py-2 rounded-full border-[2px] ${found ? 'bg-blue-100 border-blue-200' : 'bg-transparent border-gray-200'}`}>
                            <Text className={`text-sm font-bold tracking-wider ${found ? 'text-blue-900' : 'text-gray-300'}`}>
                                {found ? tw.word : "•".repeat(tw.word.length)}
                            </Text>
                        </View>
                    );
                })}
                <View className={`px-6 py-2.5 rounded-full border-[2px] w-[90%] max-w-[280px] items-center mt-2 ${foundWords.includes(game.spangram.word) ? 'bg-yellow-100 border-yellow-400 shadow-sm' : 'bg-transparent border-dashed border-gray-300'}`}>
                    <Text className={`text-sm font-black tracking-widest uppercase ${foundWords.includes(game.spangram.word) ? 'text-yellow-900' : 'text-gray-400'}`}>
                        {foundWords.includes(game.spangram.word) ? game.spangram.word : "S P A N G R A M"}
                    </Text>
                </View>
            </View>

            </View>
            </MobileGameLayout>
        </SafeAreaView>
        </>
    );
}
