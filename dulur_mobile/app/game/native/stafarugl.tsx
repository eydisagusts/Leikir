import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, PanResponder, DeviceEventEmitter, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { MobileGameLayout } from '@/components/MobileGameLayout';
import { NativeGameEndModal } from '@/components/NativeGameEndModal';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';

type Point = { r: number; c: number };

// Helper to interpolate path
const getPathPoints = (start: Point, end: Point): Point[] => {
    const dr = end.r - start.r;
    const dc = end.c - start.c;
    if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return [];

    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    const stepR = dr === 0 ? 0 : dr / Math.abs(dr);
    const stepC = dc === 0 ? 0 : dc / Math.abs(dc);

    const path: Point[] = [];
    for (let i = 0; i <= steps; i++) {
        path.push({ r: start.r + i * stepR, c: start.c + i * stepC });
    }
    return path;
};

const StafaruglCell = React.memo(({ letter, isCurrentDrag, isFound, baseFontSize }: { letter: string, isCurrentDrag: boolean, isFound: boolean, baseFontSize: number }) => {
    let bgColor = 'transparent';
    let textColor = '#1A1A1B';
    if (isCurrentDrag) {
        bgColor = 'rgba(79, 70, 229, 0.2)'; // indigo-500/20
        textColor = '#4F46E5';
    } else if (isFound) {
        bgColor = 'rgba(34, 197, 94, 0.2)'; // green-500/20
        textColor = '#16a34a';
    }

    return (
        <View 
            pointerEvents="none"
            style={{ 
                flex: 1, 
                justifyContent: 'center', 
                alignItems: 'center',
                backgroundColor: bgColor,
                borderRadius: 4,
                margin: 1
            }}
        >
            <Text style={{ fontWeight: 'bold', fontSize: baseFontSize, color: textColor }}>
                {letter}
            </Text>
        </View>
    );
});

export default function NativeStafarugl() {
    const { date } = useLocalSearchParams<{ date: string }>();
    const [targetWords, setTargetWords] = useState<string[]>([]);
    const [grid, setGrid] = useState<string[][]>([]);
    const [placements, setPlacements] = useState<any[]>([]);

    const [foundWords, setFoundWords] = useState<string[]>([]);
    const [foundPaths, setFoundPaths] = useState<Point[][]>([]);
    const [gameState, setGameState] = useState<'playing' | 'won' | 'loading' | 'error'>('loading');

    // PanResponder state
    const [isDragging, setIsDragging] = useState(false);
    const [startPt, setStartPt] = useState<Point | null>(null);
    const [currentPath, setCurrentPath] = useState<Point[]>([]);

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
        const header = `Dulur: Stafarugl 🔠`;
        const xpText = earnedXp ? `\n⭐ XP: +${earnedXp}` : '';
        const message = `${header}\n${xpText}\n\nÉg fann öll orðin!\ndulur.is 🔥`;
        try {
            await Share.share({ message });
        } catch (error) {
            console.error('Error sharing', error);
        }
    };

    // Measurement
    const [gridLayout, setGridLayout] = useState({ pageX: 0, pageY: 0, width: 0, height: 0 });
    const gridRef = useRef<View>(null);

    useEffect(() => {
        async function init() {
            try {
                const today = date || new Date().toISOString().split('T')[0];

                const { data: { session } } = await supabase.auth.getSession();
                const apiPromise = fetch(`${API_URL}/api/mobile/stafarugl/init?date=${today}`, {
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
                const gameTypeKey = isToday ? 'stafarugl' : `stafarugl_${today}`;

                const dbPromises = user ? Promise.all([
                    supabase.from('game_states').select('state_json, updated_at').eq('user_id', user.id).eq('game_type', gameTypeKey).maybeSingle(),
                    supabase.from('game_results').select('won').eq('user_id', user.id).eq('game_type', 'stafarugl').eq('metadata->>puzzleDate', today).maybeSingle()
                ]) : Promise.resolve([{ data: null }, { data: null }]);

                const [data, [stateDataRes, resDataRes]] = await Promise.all([
                    apiPromise,
                    dbPromises
                ]);

                setTargetWords(data.targetWords);
                setGrid(data.grid);
                setPlacements(data.placements);
                
                if (!user) { setGameState('playing'); return; }

                const stateData = stateDataRes.data;
                const resData = resDataRes.data;
                
                if (stateData) {
                    let isValidState = true;
                    if (!date) {
                        const updatedDate = new Date(stateData.updated_at).toISOString().split('T')[0];
                        if (updatedDate !== today) {
                            isValidState = false;
                            await supabase.from('game_states').delete().eq('user_id', user.id).eq('game_type', gameTypeKey);
                        }
                    }

                    if (isValidState) {
                        setFoundWords(stateData.state_json.foundWords || []);
                        setFoundPaths(stateData.state_json.foundPaths || []);
                    }
                }

                if (resData) {
                    setGameState('won');
                    setFoundWords([...data.targetWords]);
                    setFoundPaths([...data.placements.map((p: any) => p.path)]);
                } else {
                    setGameState('playing');
                }

                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } catch (err) {
                setGameState('error');
            }
        }
        init();
    }, [date]);

    const handleGridMeasure = (e: any) => {
        const { width, height } = e.nativeEvent.layout;
        setGridLayout(prev => ({ ...prev, width, height }));
    };

    const getCellFromEvent = (locationX: number, locationY: number): Point | null => {
        if (!grid || grid.length === 0 || gridLayout.width === 0) return null;
        
        // Clamp coordinates to allow forgiving drag around the edges including bottom row
        let dx = Math.max(0, Math.min(locationX, gridLayout.width - 0.1));
        let dy = Math.max(0, Math.min(locationY, gridLayout.height - 0.1));

        const cellW = gridLayout.width / grid[0].length;
        const cellH = gridLayout.height / grid.length;

        const c = Math.floor(dx / cellW);
        const r = Math.floor(dy / cellH);

        if (r >= 0 && r < grid.length && c >= 0 && c < grid[0].length) {
            return { r, c };
        }
        return null;
    };

    const panResponder = React.useMemo(() => 
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onStartShouldSetPanResponderCapture: () => true,
            onMoveShouldSetPanResponderCapture: () => true,
            onPanResponderGrant: (e) => {
                if (gameState !== 'playing') return;
                DeviceEventEmitter.emit('start-timer');
                const pt = getCellFromEvent(e.nativeEvent.locationX, e.nativeEvent.locationY);
                if (pt) {
                    setIsDragging(true);
                    setStartPt(pt);
                    setCurrentPath([pt]);
                    Haptics.selectionAsync();
                }
            },
            onPanResponderMove: (e) => {
                if (!isDragging || !startPt || gameState !== 'playing') return;
                const currentPt = getCellFromEvent(e.nativeEvent.locationX, e.nativeEvent.locationY);
                if (currentPt) {
                    const newPath = getPathPoints(startPt, currentPt);
                    if (newPath.length > 0 && newPath.length !== currentPath.length) {
                        setCurrentPath(newPath);
                        Haptics.selectionAsync();
                    }
                }
            },
            onPanResponderRelease: (e) => {
                if (!isDragging || gameState !== 'playing') return;

                if (currentPath.length > 0) {
                    const draggedWord = currentPath.map(pt => grid[pt.r][pt.c]).join('');
                    const reversedWord = draggedWord.split('').reverse().join('');

                    if (targetWords.includes(draggedWord) || targetWords.includes(reversedWord)) {
                        const word = targetWords.includes(draggedWord) ? draggedWord : reversedWord;
                        if (!foundWords.includes(word)) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            const nextWords = [...foundWords, word];
                            const nextPaths = [...foundPaths, currentPath];
                            
                            setFoundWords(nextWords);
                            setFoundPaths(nextPaths);
                            
                            // Check win state immediately
                            if (nextWords.length === targetWords.length) {
                                setGameState('won');
                                syncTrueResult();
                            } else {
                                syncGameState(nextWords, nextPaths);
                            }
                        } else {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); // already found
                        }
                    } else {
                        // Not a word
                         Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                }

                setIsDragging(false);
                setStartPt(null);
                setCurrentPath([]);
            },
            onPanResponderTerminate: () => {
                setIsDragging(false);
                setStartPt(null);
                setCurrentPath([]);
            }
        }), [gameState, isDragging, startPt, currentPath, grid, targetWords, foundWords, foundPaths, gridLayout]);

    const syncGameState = async (words: string[], paths: Point[][]) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const todayStr = date || new Date().toISOString().split('T')[0];
        const isToday = todayStr === new Date().toISOString().split('T')[0];
        const gameTypeKey = isToday ? 'stafarugl' : `stafarugl_${todayStr}`;
        await supabase.from('game_states').upsert({
            user_id: user.id,
            game_type: gameTypeKey,
            state_json: { foundWords: words, foundPaths: paths },
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, game_type' });
    }

    const syncTrueResult = async () => {
        DeviceEventEmitter.emit('stop-timer');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const todayStr = date || new Date().toISOString().split('T')[0];
        const isToday = todayStr === new Date().toISOString().split('T')[0];
        const xpReward = isToday ? 100 : 0;
        setEarnedXp(xpReward);
        setTimeout(() => setIsFreshGameOver(true), 1000);

        let elapsed = 60;
        const savedTime = await AsyncStorage.getItem(`timer_${user.id}_stafarugl_${todayStr}`);
        if (savedTime) elapsed = parseInt(savedTime, 10) || 60;

        await supabase.from('game_results').insert({
            time_taken_seconds: elapsed,
            user_id: user.id,
            game_type: `stafarugl`,
            score: xpReward,
            won: true,
            metadata: { words: targetWords.length, puzzleDate: todayStr }
        });

        if (xpReward > 0) {
            await supabase.rpc('increment_xp', { user_id_param: user.id, xp_amount: xpReward, p_locale: 'is' });
            await supabase.rpc('process_daily_streak', { user_id_param: user.id });
        }
    }

    if (gameState === 'loading') {
        return (
            <SafeAreaView className="flex-1 bg-[#FAFAFA] items-center justify-center">
                <Stack.Screen options={{ headerShown: false }} />
                <ActivityIndicator size="large" color="#1A1A1B" />
            </SafeAreaView>
        )
    }

    if (gameState === 'error') {
        return (
            <SafeAreaView className="flex-1 bg-[#FAFAFA] items-center justify-center p-6 text-center" edges={['top', 'bottom']}>
                <Stack.Screen options={{ headerShown: false }} />
                <View className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 items-center w-full max-w-sm">
                    <Ionicons name="lock-closed" size={48} color="#eb3b5a" style={{ marginBottom: 16 }} />
                    <Text className="text-2xl font-black font-serif text-[#1A1A1B] mb-2 text-center">Aðgangur Lokaður</Text>
                    <Text className="text-gray-500 font-medium text-center mb-6 leading-6">Þessi erfiðleikastig krefst Dulur+ áskriftar eða netþjónn niðri.</Text>
                    <TouchableOpacity onPress={() => router.back()} className="bg-[#1A1A1B] w-full py-4 rounded-full shadow-md items-center">
                        <Text className="text-white font-bold text-lg">Til baka í Leiki</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const screenWidth = Dimensions.get('window').width;
    const gridDim = Math.min(screenWidth * 0.96, 500);

return (
        <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
            <MobileGameLayout onBack={() => router.back()} gameId="stafarugl" gameTitle="Stafarugl" scrollEnabled={false} isGameOver={gameState !== 'playing'}>

            <NativeGameEndModal
                gameTitle="Stafarugl"
                visible={gameState === 'won' && isFreshGameOver}
                gameState="won"
                xpEarned={earnedXp}
                winTitle="Vel gert!"
                winDesc="Þú fannst öll orðin í stafaruglinu."
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

            <View className="w-full flex-1 justify-start items-center mt-4">
                
                {/* Words to Find row */}
                <View className="flex-row flex-wrap justify-center px-2 mb-6 max-w-md w-full gap-2">
                    {targetWords.map(word => {
                        const isFnd = foundWords.includes(word);
                        return (
                            <View key={word} className={`px-2.5 py-1.5 rounded-md border ${isFnd ? 'bg-green-500/10 border-transparent' : 'bg-white border-gray-200'}`}>
                                <Text className={`font-bold text-sm ${isFnd ? 'text-green-600 line-through opacity-70' : 'text-[#1A1A1B]'}`}>{word}</Text>
                            </View>
                        )
                    })}
                </View>

                {/* The React Native Gesture Grid Wrapper */}
                <View style={{ width: gridDim, height: gridDim, position: 'relative' }}>
                    {/* Visual Layer */}
                    <View 
                        onLayout={handleGridMeasure}
                        ref={gridRef}
                    style={{ 
                        width: gridDim, 
                        height: gridDim,
                        flexDirection: 'column',
                        backgroundColor: 'white',
                        borderWidth: 1,
                        borderColor: '#EFEFEF',
                        borderRadius: 12,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.05,
                        shadowRadius: 10,
                        elevation: 2,
                        padding: 2
                    }}
                >
                    {grid.map((rowArr, rIdx) => {
                        const currentPathSet = new Set(currentPath.map(p => `${p.r},${p.c}`));
                        const foundPathSet = new Set();
                        foundPaths.forEach(path => path.forEach(p => foundPathSet.add(`${p.r},${p.c}`)));
                        const baseFontSize = grid[0].length > 10 ? 14 : 18;

                        return (
                            <View key={rIdx} style={{ flex: 1, flexDirection: 'row' }}>
                                {rowArr.map((letter, cIdx) => {
                                    const key = `${rIdx},${cIdx}`;
                                    return (
                                        <StafaruglCell 
                                            key={cIdx} 
                                            letter={letter} 
                                            isCurrentDrag={currentPathSet.has(key)} 
                                            isFound={foundPathSet.has(key)} 
                                            baseFontSize={baseFontSize} 
                                        />
                                    )
                                })}
                            </View>
                        );
                    })}
                    </View>

                    {/* Touch Interaction Layer */}
                    <View 
                        {...panResponder.panHandlers}
                        style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 50, elevation: 5, backgroundColor: 'rgba(255,255,255,0.01)' }} 
                    />
                </View>

            </View>
            </MobileGameLayout>
        </SafeAreaView>
    );
}
