import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, DeviceEventEmitter, Dimensions, PanResponder, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { MobileGameLayout } from '@/components/MobileGameLayout';
import { NativeGameEndModal } from '@/components/NativeGameEndModal';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';
const { width } = Dimensions.get('window');

type CellState = 0 | 1 | 2;

export default function NativeMyndagata() {
    const [puzzleData, setPuzzleData] = useState<any>(null);
    const [grid, setGrid] = useState<CellState[][]>([]);
    const [gameState, setGameState] = useState<'playing' | 'won' | 'loading' | 'error'>('loading');
    
    // User requested better toggles
    const [drawMode, setDrawMode] = useState<'fill' | 'mark'>('fill');

    const [scrollEnabled, setScrollEnabled] = useState(true);

    const [earnedXp, setEarnedXp] = useState<number>(0);
    const [showFlyXp, setShowFlyXp] = useState(false);
    const [isFreshGameOver, setIsFreshGameOver] = useState(false);

    const xpAnimY = useSharedValue(0);
    const xpAnimOpacity = useSharedValue(0);

    const gridRef = useRef<View>(null);
    const gridLayout = useRef({ x: 0, y: 0, width: 0, height: 0 });
    const isDrawingRef = useRef(false);
    const lastCellRef = useRef({ r: -1, c: -1 });

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

    const xpFloatingStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: xpAnimY.value }],
            opacity: xpAnimOpacity.value
        };
    });

    useEffect(() => {
        async function init() {
            try {
                const today = new Date().toISOString().split('T')[0];

                const sessionPromise = supabase.auth.getSession();
                const apiPromise = fetch(`${API_URL}/api/mobile/myndagata/init`).then(res => res.json());

                const { data: { session } } = await sessionPromise;
                const user = session?.user;

                const dbPromises = user ? Promise.all([
                    supabase.from('game_states').select('state_json, updated_at').eq('user_id', user.id).eq('game_type', 'myndagata').maybeSingle(),
                    supabase.from('game_results').select('won, metadata, score').eq('user_id', user.id).eq('game_type', 'myndagata').gte('played_at', `${today}T00:00:00Z`).order('played_at', { ascending: false }).limit(1).maybeSingle()
                ]) : Promise.resolve([{ data: null }, { data: null }]);

                const [data, [stateDataRes, resDataRes]] = await Promise.all([
                    apiPromise,
                    dbPromises
                ]);

                setPuzzleData(data);

                if (!user) {
                    setGrid(data.solution.map((row: any) => row.map(() => 0)));
                    setGameState('playing');
                    return;
                }

                const stateRow = stateDataRes?.data;
                const resultRow = resDataRes?.data;

                if (resultRow) {
                    setGameState('won');
                    setGrid(data.solution.map((row: any) => row.map((c: any) => c === 1 ? 1 : 0)));
                } else if (stateRow?.state_json) {
                    const updatedDate = new Date(stateRow.updated_at).toISOString().split('T')[0];
                    if (updatedDate === today) {
                        setGrid(stateRow.state_json.grid || data.solution.map((row: any) => row.map(() => 0)));
                        setGameState('playing');
                    } else {
                        setGrid(data.solution.map((row: any) => row.map(() => 0)));
                        setGameState('playing');
                    }
                } else {
                    setGrid(data.solution.map((row: any) => row.map(() => 0)));
                    setGameState('playing');
                }

            } catch (error) {
                console.error("Init Error", error);
                setGameState('error');
            }
        }
        init();
    }, []);

    const saveStateToDb = async (currentGrid: CellState[][]) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || !puzzleData) return;
        await supabase.from('game_states').upsert({
            user_id: session.user.id,
            game_type: 'myndagata',
            state_json: { grid: currentGrid },
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, game_type' });
    };

    const handleSubmit = async () => {
        if (gameState !== 'playing' || !puzzleData) return;

        let won = true;
        for (let r = 0; r < puzzleData.solution.length; r++) {
            for (let c = 0; c < puzzleData.solution[r].length; c++) {
                if (puzzleData.solution[r][c] === 1 && grid[r][c] !== 1) won = false;
                if (puzzleData.solution[r][c] === 0 && grid[r][c] === 1) won = false;
            }
        }

        if (won) {
            setGameState('won');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            setEarnedXp(100);
            setIsFreshGameOver(true);

            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                try {
                    const res = await fetch(`${API_URL}/api/mobile/myndagata`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({
                            won: true,
                            timeTakenSeconds: 60
                        })
                    });
                    const d = await res.json();
                    if (d.success && typeof d.xpEarned === 'number') {
                        setEarnedXp(d.xpEarned);
                    }
                } catch(e) {}
            }
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Rangt', 'Myndin er ekki rétt. Reyndu aftur!');
        }
    };

    const handleClear = () => {
        Alert.alert(
            'Hreinsa borð?',
            'Ertu viss um að þú viljir hreinsa borðið?',
            [
                { text: 'Hætta við', style: 'cancel' },
                { text: 'Já, hreinsa', style: 'destructive', onPress: () => {
                    const emptyGrid = puzzleData.solution.map((row: any) => row.map(() => 0));
                    setGrid(emptyGrid);
                    saveStateToDb(emptyGrid);
                }}
            ]
        );
    };

    const updateCellFromCoordinates = (x: number, y: number) => {
        if (gameState !== 'playing') return;
        if (gridLayout.current.width === 0) return;

        const cols = puzzleData.solution[0].length;
        const rows = puzzleData.solution.length;
        
        const cellW = gridLayout.current.width / cols;
        const cellH = gridLayout.current.height / rows;

        // Local coordinates relative to the grid
        let localX = x - gridLayout.current.x;
        let localY = y - gridLayout.current.y;

        // If coordinates are completely off due to a bad measure, let's just attempt to measure synchronously again using the layout width
        // Wait, gestureState.moveX is global. If gridLayout.x is 0 but it's actually in the middle of the screen, we need a reliable fallback.
        // A simple trick: Since we know the grid is centered, we can guess its global X:
        // const guessedX = (Dimensions.get('window').width - gridLayout.current.width) / 2;
        // But measuring again is better.

        if (localX >= -10 && localX <= gridLayout.current.width + 10 && localY >= -10 && localY <= gridLayout.current.height + 10) {
            // Clamp to grid boundaries
            localX = Math.max(0, Math.min(localX, gridLayout.current.width - 1));
            localY = Math.max(0, Math.min(localY, gridLayout.current.height - 1));

            const c = Math.floor(localX / cellW);
            const r = Math.floor(localY / cellH);

            if (r >= 0 && r < rows && c >= 0 && c < cols) {
                if (lastCellRef.current.r !== r || lastCellRef.current.c !== c) {
                    lastCellRef.current = { r, c };
                    
                    setGrid(prev => {
                        const currentVal = prev[r][c];
                        const next = [...prev];
                        next[r] = [...next[r]];
                        
                        let targetVal: CellState = 1;
                        if (drawMode === 'mark') {
                            targetVal = currentVal === 2 ? 0 : 2;
                        } else {
                            targetVal = currentVal === 1 ? 0 : 1;
                        }

                        // We only want to set to targetVal if it's not already that, to prevent toggling back and forth when sliding
                        // Wait, a standard sliding fill: we should decide the "brush" state on touch start.
                        // For simplicity, we just set it to the active tool.
                        const brushVal = drawMode === 'mark' ? 2 : 1;
                        // Actually, if we just tapped it, we toggle. If we slide, we paint.
                        // To keep it simple: just paint with the brush. If they tap an already painted cell, we erase it.
                        
                        if (!isDrawingRef.current) {
                            // First tap - determine brush
                            isDrawingRef.current = true;
                            next[r][c] = currentVal === brushVal ? 0 : brushVal;
                        } else {
                            // Sliding - paint with active brush
                            next[r][c] = brushVal;
                        }

                        // Debounce save state
                        setTimeout(() => saveStateToDb(next), 1000);
                        return next;
                    });
                }
            }
        }
    };

    const measureGrid = () => {
        gridRef.current?.measure((x, y, w, h, pageX, pageY) => {
            if (w > 0 && h > 0) {
                gridLayout.current = { x: pageX, y: pageY, width: w, height: h };
            }
        });
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt, gestureState) => {
                setScrollEnabled(false);
                measureGrid(); // Guarantee accurate coordinates
                isDrawingRef.current = false; // Reset brush state
                lastCellRef.current = { r: -1, c: -1 };
                
                // Allow a small delay for measure to complete if it was wrong
                setTimeout(() => {
                    updateCellFromCoordinates(gestureState.x0, gestureState.y0);
                }, 10);
            },
            onPanResponderMove: (evt, gestureState) => {
                isDrawingRef.current = true;
                updateCellFromCoordinates(gestureState.moveX, gestureState.moveY);
            },
            onPanResponderRelease: () => {
                setScrollEnabled(true);
                isDrawingRef.current = false;
                lastCellRef.current = { r: -1, c: -1 };
            },
            onPanResponderTerminate: () => {
                setScrollEnabled(true);
                isDrawingRef.current = false;
            }
        })
    ).current;

    if (gameState === 'loading') {
        return (
            <SafeAreaView className="flex-1 bg-[#FAFAFA] justify-center items-center">
                <ActivityIndicator size="large" color="#1e1b4b" />
            </SafeAreaView>
        );
    }

    if (gameState === 'error' || !puzzleData) {
        return (
            <SafeAreaView className="flex-1 bg-[#FAFAFA] justify-center items-center">
                <Ionicons name="cloud-offline" size={64} color="#94a3b8" />
                <Text className="mt-4 text-slate-500 font-semibold text-lg">Gat ekki hlaðið leik</Text>
                <TouchableOpacity onPress={() => router.replace('/(tabs)')} className="mt-8 bg-[#1e1b4b] px-6 py-3 rounded-full">
                    <Text className="text-white font-bold">Aftur á forsíðu</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // Calculate max clue lengths to allocate space
    const maxRowClues = Math.max(...puzzleData.rowClues.map((c: any) => c.length || 1));
    const maxColClues = Math.max(...puzzleData.colClues.map((c: any) => c.length || 1));

    // Ensure grid display size leaves room for the row clues so it doesn't overflow!
    const rowClueWidth = maxRowClues * 12 + 10;
    const gridDisplaySize = Math.min(width * 0.9 - rowClueWidth, 350);
    const cols = puzzleData.solution[0].length;
    const rows = puzzleData.solution.length;

    const clueFontSize = cols >= 15 ? 9 : 11;
    const cellBorder = 0.5;

    return (
        <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
            <MobileGameLayout 
                gameId="myndagata"
                gameTitle="Myndagáta" 
                isGameOver={gameState !== 'playing'}
                onBack={() => router.replace('/(tabs)')}
            >
            <ScrollView scrollEnabled={scrollEnabled} className="flex-1" contentContainerStyle={{ alignItems: 'center', paddingBottom: 40, paddingTop: 10 }} showsVerticalScrollIndicator={false} bounces={false}>
                
                <View className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 w-[95%]">
                    
                    {/* The entire game board including clues */}
                    <View className="flex-row w-full justify-center">
                        
                        {/* Row Clues (Left) */}
                        <View className="flex-col justify-end" style={{ marginRight: 4, marginTop: maxColClues * 16 }}>
                            {puzzleData.rowClues.map((clueArr: number[], r: number) => (
                                <View key={`rc-${r}`} className="flex-row items-center justify-end" style={{ height: gridDisplaySize / rows }}>
                                    {clueArr.length === 0 ? (
                                        <Text style={{ fontSize: clueFontSize, color: '#94a3b8', fontWeight: 'bold' }}>0</Text>
                                    ) : (
                                        clueArr.map((num, i) => (
                                            <Text key={i} style={{ fontSize: clueFontSize, color: '#1e293b', fontWeight: 'bold', marginLeft: 4 }}>{num}</Text>
                                        ))
                                    )}
                                </View>
                            ))}
                        </View>

                        <View className="flex-col">
                            {/* Col Clues (Top) */}
                            <View className="flex-row justify-between mb-1" style={{ height: maxColClues * 16, width: gridDisplaySize }}>
                                {puzzleData.colClues.map((clueArr: number[], c: number) => (
                                    <View key={`cc-${c}`} className="flex-col justify-end items-center" style={{ width: gridDisplaySize / cols }}>
                                        {clueArr.length === 0 ? (
                                            <Text style={{ fontSize: clueFontSize, color: '#94a3b8', fontWeight: 'bold' }}>0</Text>
                                        ) : (
                                            clueArr.map((num, i) => (
                                                <Text key={i} style={{ fontSize: clueFontSize, color: '#1e293b', fontWeight: 'bold' }}>{num}</Text>
                                            ))
                                        )}
                                    </View>
                                ))}
                            </View>

                            {/* The Grid */}
                            <View 
                                ref={gridRef}
                                onLayout={(e) => {
                                    const { width: w, height: h } = e.nativeEvent.layout;
                                    gridLayout.current.width = w;
                                    gridLayout.current.height = h;
                                    measureGrid();
                                }}
                                style={{ width: gridDisplaySize, height: gridDisplaySize, backgroundColor: '#1e293b', borderWidth: 2, borderColor: '#1e293b' }}
                                {...panResponder.panHandlers}
                            >
                                <View className="flex-1 flex-col justify-between">
                                    {grid.map((row, r) => (
                                        <View key={`r-${r}`} className="flex-1 flex-row justify-between">
                                            {row.map((cell, c) => {
                                                // Add slight borders for 5x5 chunks
                                                const isRightChunk = (c + 1) % 5 === 0 && c !== cols - 1;
                                                const isBottomChunk = (r + 1) % 5 === 0 && r !== rows - 1;

                                                return (
                                                    <View 
                                                        key={`c-${c}`} 
                                                        style={{ 
                                                            flex: 1, 
                                                            backgroundColor: cell === 1 ? '#0f172a' : '#ffffff',
                                                            borderRightWidth: isRightChunk ? 1.5 : cellBorder,
                                                            borderBottomWidth: isBottomChunk ? 1.5 : cellBorder,
                                                            borderColor: '#64748b',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                    >
                                                        {cell === 2 && <Text style={{ color: '#94a3b8', fontSize: clueFontSize, fontWeight: 'bold' }}>✕</Text>}
                                                    </View>
                                                )
                                            })}
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Controls - Made much better as requested by user */}
                <View className="w-[90%] max-w-[400px] flex-col gap-6">
                    <View className="flex-row bg-slate-100 p-1.5 rounded-2xl w-full justify-between items-center shadow-sm border border-slate-200">
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setDrawMode('fill')}
                            className={`flex-1 py-4 rounded-xl flex-row justify-center items-center gap-2 ${drawMode === 'fill' ? 'bg-white shadow-sm' : ''}`}
                        >
                            <View className="w-5 h-5 bg-[#0f172a] rounded-[4px] border border-slate-300" />
                            <Text className={`font-bold text-lg ${drawMode === 'fill' ? 'text-[#0f172a]' : 'text-slate-500'}`}>Fylla</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setDrawMode('mark')}
                            className={`flex-1 py-4 rounded-xl flex-row justify-center items-center gap-2 ${drawMode === 'mark' ? 'bg-white shadow-sm' : ''}`}
                        >
                            <Text className={`font-black text-xl ${drawMode === 'mark' ? 'text-[#0f172a]' : 'text-slate-400'}`}>✕</Text>
                            <Text className={`font-bold text-lg ${drawMode === 'mark' ? 'text-[#0f172a]' : 'text-slate-500'}`}>Krossa</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Action Buttons */}
                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={handleClear}
                            className="bg-red-50 py-4 px-6 rounded-2xl border border-red-200 items-center justify-center shadow-sm"
                        >
                            <Ionicons name="trash" size={24} color="#ef4444" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleSubmit}
                            className="flex-1 bg-[#1e1b4b] py-4 rounded-2xl items-center shadow-md flex-row justify-center gap-2"
                        >
                            <Text className="text-white font-black text-xl">Giska á mynd</Text>
                            <Ionicons name="checkmark-circle" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>

            </ScrollView>

            {showFlyXp && (
                <Animated.View style={[{ position: 'absolute', top: Dimensions.get('window').height * 0.6, left: 0, right: 0, alignItems: 'center', zIndex: 100 }, xpFloatingStyle]} pointerEvents="none">
                    <View className="bg-[#EAB308] border-2 border-[#CA8A04] px-4 py-2 rounded-xl flex-row items-center gap-2 shadow-lg">
                        <Ionicons name="star" size={24} color="white" />
                        <Text className="text-white font-black text-2xl">+{earnedXp}</Text>
                    </View>
                </Animated.View>
            )}

            <NativeGameEndModal
                visible={isFreshGameOver}
                onContinue={handleCloseModal}
                gameTitle="Myndagáta"
                gameState={gameState as "won" | "lost"}
                xpEarned={earnedXp}
            />
            </MobileGameLayout>
        </SafeAreaView>
    );
}
