import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, DeviceEventEmitter, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { supabase, getFreshSession } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MobileGameLayout } from '@/components/MobileGameLayout';
import { NativeGameEndModal } from '@/components/NativeGameEndModal';

// Shared content constants for React Native since we can't easily import from global Next.js
export interface FlaediDot {
    r: number;
    c: number;
    colorId: string;
}

export interface FlaediPuzzle {
    id: string;
    size: number;
    dots: FlaediDot[];
}

const FLAEDI_PUZZLES: FlaediPuzzle[] = [
    {
        id: "day_0",
        size: 5,
        dots: [
            { r: 0, c: 0, colorId: "red" }, { r: 4, c: 4, colorId: "red" },
            { r: 1, c: 0, colorId: "blue" }, { r: 1, c: 1, colorId: "blue" },
            { r: 2, c: 1, colorId: "yellow" }, { r: 2, c: 2, colorId: "yellow" }
        ]
    },
    {
        id: "day_1",
        size: 5,
        dots: [
            { r: 0, c: 0, colorId: "red" }, { r: 4, c: 3, colorId: "red" },
            { r: 3, c: 1, colorId: "blue" }, { r: 4, c: 4, colorId: "blue" },
            { r: 1, c: 2, colorId: "yellow" }, { r: 2, c: 3, colorId: "yellow" },
            { r: 2, c: 2, colorId: "green" }, { r: 3, c: 3, colorId: "green" }
        ]
    },
    {
        id: "day_2",
        size: 5,
        dots: [
            { r: 0, c: 0, colorId: "red" }, { r: 4, c: 4, colorId: "red" },
            { r: 1, c: 0, colorId: "green" }, { r: 4, c: 3, colorId: "green" },
            { r: 2, c: 0, colorId: "yellow" }, { r: 4, c: 2, colorId: "yellow" },
            { r: 3, c: 0, colorId: "blue" }, { r: 3, c: 1, colorId: "blue" },
            { r: 4, c: 0, colorId: "purple" }, { r: 4, c: 1, colorId: "purple" }
        ]
    },
    {
        id: "day_3",
        size: 5,
        dots: [
            { r: 0, c: 4, colorId: "red" }, { r: 4, c: 0, colorId: "red" },
            { r: 4, c: 4, colorId: "blue" }, { r: 3, c: 1, colorId: "blue" },
            { r: 4, c: 1, colorId: "green" }, { r: 3, c: 2, colorId: "green" },
            { r: 2, c: 2, colorId: "yellow" }, { r: 2, c: 3, colorId: "yellow" }
        ]
    },
    {
        id: "day_4",
        size: 6,
        dots: [
            { r: 0, c: 0, colorId: "red" }, { r: 5, c: 5, colorId: "red" },
            { r: 1, c: 0, colorId: "blue" }, { r: 5, c: 4, colorId: "blue" },
            { r: 2, c: 0, colorId: "yellow" }, { r: 4, c: 3, colorId: "yellow" },
            { r: 3, c: 0, colorId: "green" }, { r: 5, c: 3, colorId: "green" },
            { r: 4, c: 0, colorId: "purple" }, { r: 5, c: 0, colorId: "purple" }
        ]
    }
];

export function getDailyFlaediNative(): FlaediPuzzle {
    const today = new Date().toISOString().split('T')[0];
    const dayOfMonth = parseInt(today.split('-')[2], 10);
    const index = (dayOfMonth - 1) % FLAEDI_PUZZLES.length;
    return FLAEDI_PUZZLES[index];
}

const { width } = Dimensions.get('window');

export default function NativeFlaedi() {
    const [gameState, setGameState] = useState<'playing' | 'won' | 'lost' | 'loading' | 'error'>('loading');
    const [earnedXp, setEarnedXp] = useState<number | null>(null);
    const [isFreshGameOver, setIsFreshGameOver] = useState(false);
    
    const [dailyData, setDailyData] = useState<FlaediPuzzle | null>(null);
    const [paths, setPaths] = useState<Record<string, string[]>>({});
    const [activeColor, setActiveColor] = useState<string | null>(null);
    
    // For hit detection
    const [boardLayout, setBoardLayout] = useState({ x: 0, y: 0, width: 0, height: 0, pageX: 0, pageY: 0 });
    const boardRef = useRef<View>(null);

    useEffect(() => {
        async function init() {
            try {
                const puzzle = getDailyFlaediNative();
                setDailyData(puzzle);

                const { data: { user } } = await supabase.auth.getUser();
                const today = new Date().toISOString().split('T')[0];

                if (!user) {
                    setGameState('playing');
                    return;
                }

                const [stateRes, resultRes] = await Promise.all([
                    supabase.from('game_states').select('state_json, updated_at').eq('user_id', user.id).eq('game_type', 'flaedi').maybeSingle(),
                    supabase.from('game_results').select('won, metadata, score').eq('user_id', user.id).eq('game_type', 'flaedi').gte('played_at', `${today}T00:00:00Z`).order('played_at', { ascending: false }).limit(1).maybeSingle()
                ]);

                if (resultRes.data) {
                    setGameState(resultRes.data.won ? 'won' : 'lost');
                    if (stateRes.data?.state_json) {
                        const lp: Record<string, string[]> = {};
                        for (const [color, coords] of Object.entries(stateRes.data.state_json.paths)) {
                            lp[color] = (coords as {r:number,c:number}[]).map((c: any) => `${c.r},${c.c}`);
                        }
                        setPaths(lp);
                    }
                } else if (stateRes.data?.state_json) {
                    const updatedDate = new Date(stateRes.data.updated_at).toISOString().split('T')[0];
                    if (updatedDate === today) {
                        const lp: Record<string, string[]> = {};
                        for (const [color, coords] of Object.entries(stateRes.data.state_json.paths)) {
                            lp[color] = (coords as {r:number,c:number}[]).map((c: any) => `${c.r},${c.c}`);
                        }
                        setPaths(lp);
                        setGameState('playing');
                    } else {
                        setGameState('playing');
                    }
                } else {
                    setGameState('playing');
                }
            } catch (err) {
                console.error(err);
                setGameState('error');
            }
        }
        init();
    }, []);

    useEffect(() => {
        if (gameState === 'playing') {
            setTimeout(() => DeviceEventEmitter.emit('start-timer'), 500);
        }
    }, [gameState]);

    const saveStateToDb = async (currentPaths: Record<string, string[]>) => {
        const session = await getFreshSession();
        if (!session?.user) return;
        const saveFormat: Record<string, { r: number, c: number }[]> = {};
        for (const [color, coords] of Object.entries(currentPaths)) {
            saveFormat[color] = coords.map(c => {
                const [r, cStr] = c.split(',');
                return { r: parseInt(r), c: parseInt(cStr) };
            });
        }
        await supabase.from('game_states').upsert({
            user_id: session.user.id,
            game_type: 'flaedi',
            state_json: { paths: saveFormat },
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, game_type' });
    };

    const getDotAt = (r: number, c: number) => {
        return dailyData?.dots.find(d => d.r === r && d.c === c);
    };

    const getColorAt = (r: number, c: number, currentPaths: Record<string, string[]>) => {
        const dot = getDotAt(r, c);
        if (dot) return dot.colorId;
        for (const [color, coords] of Object.entries(currentPaths)) {
            if (coords.includes(`${r},${c}`)) return color;
        }
        return null;
    };

    const checkWinCondition = async (finalPaths: Record<string, string[]>) => {
        if (gameState !== 'playing' || !dailyData) return;

        const colors = new Set(dailyData.dots.map(d => d.colorId));
        for (const color of Array.from(colors)) {
            const path = finalPaths[color];
            if (!path || path.length < 2) return;
            
            const startDot = getDotAt(parseInt(path[0].split(',')[0]), parseInt(path[0].split(',')[1]));
            const endDot = getDotAt(parseInt(path[path.length - 1].split(',')[0]), parseInt(path[path.length - 1].split(',')[1]));

            if (!startDot || !endDot || startDot.colorId !== color || endDot.colorId !== color || `${startDot.r},${startDot.c}` === `${endDot.r},${endDot.c}`) {
                return;
            }
        }

        let totalCovered = 0;
        for (const path of Object.values(finalPaths)) {
            totalCovered += path.length;
        }

        if (totalCovered < dailyData.size * dailyData.size) return;

        setGameState('won');
        DeviceEventEmitter.emit('stop-timer');
        setIsFreshGameOver(true);

        const session = await getFreshSession();
        if (session?.user) {
            const today = new Date().toISOString().split('T')[0];
            const key = `timer_${session.user.id}_flaedi_${today}`;
            const savedTime = await AsyncStorage.getItem(key);
            const elapsed = savedTime ? parseInt(savedTime, 10) : 0;

            const speedBonus = Math.max(0, Math.floor(50 * (1 - (elapsed - 60) / 240)));
            const xpEarnedTotal = 50 + (elapsed <= 60 ? 50 : speedBonus);
            setEarnedXp(xpEarnedTotal);

            try {
                await fetch(process.env.EXPO_PUBLIC_API_URL + '/api/mobile/flaedi', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        action: 'save',
                        won: true,
                        score: xpEarnedTotal,
                        timeTakenSeconds: elapsed
                    })
                });
            } catch(e) {}
        }
    };

    const handleTouchStart = (r: number, c: number) => {
        if (gameState !== 'playing') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        DeviceEventEmitter.emit('start-timer');

        const color = getColorAt(r, c, paths);
        if (!color) return;

        setActiveColor(color);

        setPaths(prev => {
            const newPaths = { ...prev };
            const currentPath = prev[color] || [];
            const pos = `${r},${c}`;

            const isDot = getDotAt(r, c);
            if (isDot) {
                newPaths[color] = [pos];
            } else {
                const idx = currentPath.indexOf(pos);
                if (idx !== -1) {
                    newPaths[color] = currentPath.slice(0, idx + 1);
                }
            }
            return newPaths;
        });
    };

    const handleTouchMove = (r: number, c: number) => {
        if (gameState !== 'playing' || !activeColor) return;

        setPaths(prev => {
            const currentPath = prev[activeColor] || [];
            const pos = `${r},${c}`;

            if (currentPath[currentPath.length - 1] === pos) return prev;

            if (currentPath.length > 0) {
                const lastPos = currentPath[currentPath.length - 1];
                const [lr, lc] = lastPos.split(',').map(Number);
                const isAdjacent = Math.abs(lr - r) + Math.abs(lc - c) === 1;
                if (!isAdjacent) return prev;
            }

            if (currentPath.length > 1 && currentPath[currentPath.length - 2] === pos) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                return { ...prev, [activeColor]: currentPath.slice(0, -1) };
            }

            const dotHit = getDotAt(r, c);
            if (dotHit && dotHit.colorId !== activeColor) return prev;

            const selfIdx = currentPath.indexOf(pos);
            if (selfIdx !== -1) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                return { ...prev, [activeColor]: currentPath.slice(0, selfIdx + 1) };
            }

            if (currentPath.length > 1) {
                const firstDot = getDotAt(parseInt(currentPath[0].split(',')[0]), parseInt(currentPath[0].split(',')[1]));
                if (dotHit && dotHit.colorId === activeColor && firstDot && `${r},${c}` !== currentPath[0]) {
                    // completion
                } else if (dotHit && dotHit.colorId === activeColor) {
                    return prev;
                }
            }

            const newPaths = { ...prev };
            for (const color of Object.keys(newPaths)) {
                if (color !== activeColor) {
                    const idx = newPaths[color].indexOf(pos);
                    if (idx !== -1) {
                        newPaths[color] = newPaths[color].slice(0, idx);
                    }
                }
            }

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            newPaths[activeColor] = [...currentPath, pos];
            return newPaths;
        });
    };

    const handleTouchEnd = () => {
        if (activeColor !== null) {
            setActiveColor(null);
            checkWinCondition(paths);
            saveStateToDb(paths);
        }
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                if (!dailyData || boardLayout.width === 0) return;
                const { pageX, pageY } = evt.nativeEvent;
                const x = pageX - boardLayout.pageX;
                const y = pageY - boardLayout.pageY;
                const cellSize = boardLayout.width / dailyData.size;
                const c = Math.floor(x / cellSize);
                const r = Math.floor(y / cellSize);
                
                if (r >= 0 && r < dailyData.size && c >= 0 && c < dailyData.size) {
                    handleTouchStart(r, c);
                }
            },
            onPanResponderMove: (evt) => {
                if (!dailyData || boardLayout.width === 0 || !activeColor) return;
                const { pageX, pageY } = evt.nativeEvent;
                const x = pageX - boardLayout.pageX;
                const y = pageY - boardLayout.pageY;
                const cellSize = boardLayout.width / dailyData.size;
                const c = Math.floor(x / cellSize);
                const r = Math.floor(y / cellSize);
                
                if (r >= 0 && r < dailyData.size && c >= 0 && c < dailyData.size) {
                    handleTouchMove(r, c);
                }
            },
            onPanResponderRelease: () => {
                handleTouchEnd();
            },
            onPanResponderTerminate: () => {
                handleTouchEnd();
            }
        })
    ).current;

    const getCSSColor = (id: string) => {
        const map: Record<string, string> = {
            red: '#ef4444',
            blue: '#3b82f6',
            green: '#22c55e',
            yellow: '#eab308',
            purple: '#a855f7'
        };
        return map[id] || '#000';
    };

    if (!dailyData || gameState === 'loading') {
        return <View className="flex-1 bg-[#FAFAFA]" />;
    }

    const cellSize = boardLayout.width > 0 ? boardLayout.width / dailyData.size : 0;

    const handleDevRefresh = () => {
        setGameState('playing');
        setPaths({});
        setActiveColor(null);
        DeviceEventEmitter.emit('reset-timer');
    };

    return (
        <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
            <MobileGameLayout 
                gameId="flaedi"
                gameTitle="Flæði" 
                isGameOver={gameState !== 'playing'}
                onBack={() => router.replace('/(tabs)')}
                scrollEnabled={false}
            >
                <View className="flex-1 items-center justify-center p-4">
                    {__DEV__ && (
                        <View className="w-full items-center mb-4">
                            <Text onPress={handleDevRefresh} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg overflow-hidden">DEV REFRESH</Text>
                        </View>
                    )}
                    <View 
                        ref={boardRef}
                        onLayout={() => {
                            boardRef.current?.measure((x, y, w, h, pX, pY) => {
                                setBoardLayout({ x, y, width: w, height: h, pageX: pX, pageY: pY });
                            });
                        }}
                        {...panResponder.panHandlers}
                        className="bg-[#1E293B] w-full aspect-square rounded-2xl border-4 border-[#334155] relative overflow-hidden"
                    >
                        {boardLayout.width > 0 && Array.from({ length: dailyData.size * dailyData.size }).map((_, i) => {
                            const r = Math.floor(i / dailyData.size);
                            const c = i % dailyData.size;
                            return (
                                <View 
                                    key={`grid-${r}-${c}`} 
                                    className="absolute border border-[#334155]/50"
                                    style={{
                                        width: cellSize,
                                        height: cellSize,
                                        top: r * cellSize,
                                        left: c * cellSize
                                    }}
                                />
                            );
                        })}

                        {/* Render Pipes */}
                        {boardLayout.width > 0 && Object.entries(paths).map(([colorId, pathCoords]) => {
                            const cssColor = getCSSColor(colorId);
                            return pathCoords.map((coord, idx) => {
                                const [r, c] = coord.split(',').map(Number);
                                const prev = idx > 0 ? pathCoords[idx - 1] : null;
                                const next = idx < pathCoords.length - 1 ? pathCoords[idx + 1] : null;

                                return (
                                    <View 
                                        key={`pipe-${colorId}-${idx}`} 
                                        className="absolute items-center justify-center pointer-events-none"
                                        style={{
                                            width: cellSize,
                                            height: cellSize,
                                            top: r * cellSize,
                                            left: c * cellSize
                                        }}
                                    >
                                        <View style={{ width: '40%', height: '40%', borderRadius: 100, backgroundColor: cssColor }} />
                                        
                                        {prev && (() => {
                                            const [pr, pc] = prev.split(',').map(Number);
                                            return (
                                                <View style={{
                                                    position: 'absolute',
                                                    backgroundColor: cssColor,
                                                    top: pr === r - 1 ? 0 : '30%',
                                                    bottom: pr === r + 1 ? 0 : '30%',
                                                    left: pc === c - 1 ? 0 : '30%',
                                                    right: pc === c + 1 ? 0 : '30%',
                                                }} />
                                            );
                                        })()}

                                        {next && (() => {
                                            const [nr, nc] = next.split(',').map(Number);
                                            return (
                                                <View style={{
                                                    position: 'absolute',
                                                    backgroundColor: cssColor,
                                                    top: nr === r - 1 ? 0 : '30%',
                                                    bottom: nr === r + 1 ? 0 : '30%',
                                                    left: nc === c - 1 ? 0 : '30%',
                                                    right: nc === c + 1 ? 0 : '30%',
                                                }} />
                                            );
                                        })()}
                                    </View>
                                );
                            });
                        })}

                        {/* Render Dots */}
                        {boardLayout.width > 0 && dailyData.dots.map(dot => (
                            <View 
                                key={`dot-${dot.r}-${dot.c}`} 
                                className="absolute items-center justify-center pointer-events-none"
                                style={{
                                    width: cellSize,
                                    height: cellSize,
                                    top: dot.r * cellSize,
                                    left: dot.c * cellSize
                                }}
                            >
                                <View style={{ width: '70%', height: '70%', borderRadius: 100, backgroundColor: getCSSColor(dot.colorId) }} />
                            </View>
                        ))}

                        {gameState !== 'playing' && (
                            <View className="absolute inset-0 bg-black/50 items-center justify-center z-10 rounded-xl">
                                <Text className="text-white font-black text-4xl shadow-md">
                                    {gameState === 'won' ? 'Flæði leyst!' : 'Leik lokið'}
                                </Text>
                            </View>
                        )}
                    </View>

                    <Text className="text-slate-500 text-center mt-8 px-4 leading-6">
                        Tengdu saman eins liti án þess að línur krossist. Öll borðið verður að vera fyllt!
                    </Text>
                </View>

                <NativeGameEndModal
                    visible={isFreshGameOver}
                    onContinue={() => setIsFreshGameOver(false)}
                    gameTitle="Flæði"
                    gameState={gameState as "won" | "lost"}
                    xpEarned={earnedXp}
                    winTitle="Flæði leyst!"
                    winDesc={`Þú fylltir borðið!`}
                />
            </MobileGameLayout>
        </SafeAreaView>
    );
}
