import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Share, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { supabase, getFreshSession } from '@/lib/supabase';
import { MobileGameLayout } from '@/components/MobileGameLayout';
import { NativeGameEndModal } from '@/components/NativeGameEndModal';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';
const { width } = Dimensions.get('window');

type SprengjuleitGameData = {
    id: number;
    rows: number;
    cols: number;
    mines: number;
    seedMultiplier: number;
};

type CellState = {
    isMine: boolean;
    isRevealed: boolean;
    isFlagged: boolean;
    neighborMines: number;
};

export default function NativeSprengjuleit() {
    const { date, challengeId } = useLocalSearchParams<{ date: string, challengeId?: string }>();
    const [game, setGame] = useState<SprengjuleitGameData | null>(null);
    const [gameState, setGameState] = useState<'playing' | 'won' | 'lost' | 'loading' | 'error'>('loading');
    
    const [grid, setGrid] = useState<CellState[][]>([]);
    const [firstClick, setFirstClick] = useState(true);
    
    // Toggle Mode
    const [tapMode, setTapMode] = useState<'dig' | 'flag'>('dig');
    const [flagsPlaced, setFlagsPlaced] = useState(0);

    const shakeOffset = useSharedValue(0);
    const shakeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shakeOffset.value }]
    }));

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
        const resultEmoji = gameState === 'won' ? '🟩' : '🟥';
        const header = `Dulur: Sprengjuleit ${resultEmoji}`;
        let timeStr = "";
        if (finalTime > 0) {
            const m = Math.floor(finalTime / 60);
            const s = finalTime % 60;
            timeStr = `⏱️ Tími: ${m}:${s < 10 ? '0' : ''}${s}`;
        }
        const xpText = earnedXp ? `\n⭐ XP: +${earnedXp}` : '';
        const message = `${header}\n${timeStr}${xpText}\n\n${gameState === 'won' ? 'Ég fann allar sprengjurnar!' : 'Ég steig á sprengju!'}\ndulur.is 🔥`;

        try {
            await Share.share({ message });
        } catch (error) {
            console.error('Error sharing', error);
        }
    };

    useEffect(() => {
        async function init() {
            try {
                const today = date || new Date().toISOString().split('T')[0];
                const session = await getFreshSession();
                const apiPromise = fetch(`${API_URL}/api/mobile/sprengjuleit/init?date=${today}${challengeId ? `&c=${challengeId}` : ''}`, {
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
                const gameTypeKey = isToday ? 'sprengjuleit' : `sprengjuleit_${today}`;

                const dbPromises = user ? Promise.all([
                    supabase.from('game_results')
                        .select('won')
                        .eq('user_id', user.id)
                        .eq('game_type', 'sprengjuleit')
                        .eq('metadata->>puzzleDate', today).maybeSingle(),
                    supabase.from('game_states').select('state_json, updated_at').eq('user_id', user.id).eq('game_type', gameTypeKey).maybeSingle()
                ]) : Promise.resolve([{ data: null }, { data: null }]);

                const [data, [resDataRes, stateDataRes]] = await Promise.all([
                    apiPromise,
                    dbPromises
                ]);

                setGame(data as SprengjuleitGameData);
                
                // Initialize Blank Grid
                const initialGrid: CellState[][] = Array(data.rows).fill(null).map(() => 
                    Array(data.cols).fill(null).map(() => ({
                        isMine: false,
                        isRevealed: false,
                        isFlagged: false,
                        neighborMines: 0
                    }))
                );
                
                if (!user) {
                    setGrid(initialGrid);
                    setGameState('playing');
                    return;
                }

                const resData = resDataRes.data;
                const stateData = stateDataRes.data;

                let loadedGrid = initialGrid;
                let isValidState = false;

                if (stateData && stateData.state_json.board) {
                    isValidState = true;
                    if (!date) { // Date validation only when playing current live day
                        const updatedDate = new Date(stateData.updated_at).toISOString().split('T')[0];
                        if (updatedDate !== today) {
                            isValidState = false;
                            await supabase.from('game_states').delete().eq('user_id', user.id).eq('game_type', gameTypeKey);
                        }
                    }
                }

                if (isValidState && stateData) {
                    loadedGrid = stateData.state_json.board;
                    setFirstClick(false);
                    const flags = stateData.state_json.board.flat().filter((c: CellState) => c.isFlagged).length;
                    setFlagsPlaced(flags);
                }

                if (resData) {
                    setGameState(resData.won ? 'won' : 'lost');
                    setGrid(loadedGrid);
                } else {
                    setGrid(loadedGrid);
                    setGameState('playing');
                }
            } catch (err) {
                setGameState('error');
            }
        }
        init();
    }, [date]);

    // Deterministic random
    const seededRandom = (seed: number) => {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };

    const placeMines = (initialR: number, initialC: number) => {
        if (!game) return;
        const newGrid = [...grid.map(r => [...r.map(c => ({...c}))])];
        
        let minesPlaced = 0;
        let attemptCount = 0;
        let pSeed = game.seedMultiplier;

        while (minesPlaced < game.mines && attemptCount < 10000) {
            attemptCount++;
            const rand = seededRandom(pSeed + attemptCount);
            const pr = Math.floor(rand * game.rows);
            // new random
            const randC = seededRandom(pSeed + attemptCount + 1000);
            const pc = Math.floor(randC * game.cols);

            // Don't place on first click or immediate neighbors
            if (Math.abs(pr - initialR) <= 1 && Math.abs(pc - initialC) <= 1) continue;

            if (!newGrid[pr][pc].isMine) {
                newGrid[pr][pc].isMine = true;
                minesPlaced++;
            }
        }

        // Calculate neighbors
        for (let r = 0; r < game.rows; r++) {
            for (let c = 0; c < game.cols; c++) {
                if (!newGrid[r][c].isMine) {
                    let count = 0;
                    for (let x = -1; x <= 1; x++) {
                        for (let y = -1; y <= 1; y++) {
                            const nr = r + x;
                            const nc = c + y;
                            if (nr >= 0 && nr < game.rows && nc >= 0 && nc < game.cols && newGrid[nr][nc].isMine) {
                                count++;
                            }
                        }
                    }
                    newGrid[r][c].neighborMines = count;
                }
            }
        }

        return newGrid;
    };

    const handleTap = (r: number, c: number) => {
        if (gameState !== 'playing') return;

        DeviceEventEmitter.emit('start-timer');

        if (tapMode === 'flag') {
            toggleFlag(r, c);
            return;
        }

        // Dig Mode
        if (grid[r][c].isFlagged || grid[r][c].isRevealed) return;

        let activeGrid = grid;
        if (firstClick) {
            activeGrid = placeMines(r, c) || grid;
            setFirstClick(false);
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (activeGrid[r][c].isMine) {
            triggerLoss(activeGrid);
            return;
        }

        // Reveal recursive
        const newGrid = revealRecursive(activeGrid, r, c);
        setGrid(newGrid);
        checkWin(newGrid);
    };

    const toggleFlag = (r: number, c: number) => {
        if (gameState !== 'playing' || grid[r][c].isRevealed) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        const newGrid = [...grid.map(row => [...row.map(cell => ({...cell}))])];
        newGrid[r][c].isFlagged = !newGrid[r][c].isFlagged;
        
        setGrid(newGrid);
        setFlagsPlaced(newGrid[r][c].isFlagged ? flagsPlaced + 1 : flagsPlaced - 1);
        syncGameState(newGrid);
    };

    const revealRecursive = (board: CellState[][], sr: number, sc: number): CellState[][] => {
        const newGrid = [...board.map(r => [...r.map(c => ({...c}))])];
        if (!game) return newGrid;

        const stack = [{ r: sr, c: sc }];
        
        while (stack.length > 0) {
            const { r, c } = stack.pop()!;
            if (r < 0 || r >= game.rows || c < 0 || c >= game.cols) continue;
            
            const cell = newGrid[r][c];
            if (cell.isRevealed || cell.isFlagged || cell.isMine) continue;

            cell.isRevealed = true;

            if (cell.neighborMines === 0) {
                for (let x = -1; x <= 1; x++) {
                    for (let y = -1; y <= 1; y++) {
                        if (x !== 0 || y !== 0) {
                            stack.push({ r: r + x, c: c + y });
                        }
                    }
                }
            }
        }
        return newGrid;
    };

    const triggerLoss = async (failedGrid: CellState[][]) => {
        DeviceEventEmitter.emit('stop-timer');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        shakeOffset.value = withSequence(
            withTiming(-5, { duration: 40 }),
            withTiming(5, { duration: 80 }),
            withTiming(-5, { duration: 80 }),
            withTiming(0, { duration: 40 })
        );
        
        // Reveal all mines
        const newGrid = [...failedGrid.map(row => [...row.map(cell => ({...cell}))])];
        for (let r=0; r<game!.rows; r++) {
            for (let c=0; c<game!.cols; c++) {
                if (newGrid[r][c].isMine) newGrid[r][c].isRevealed = true;
            }
        }

        setGrid(newGrid);
        setGameState('lost');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                let elapsed = 0;
                const todayStr = date || new Date().toISOString().split('T')[0];
                const key = `timer_${user.id}_sprengjuleit_${todayStr}`;
                const savedTime = await AsyncStorage.getItem(key);
                if (savedTime) elapsed = parseInt(savedTime, 10);
                
                setFinalTime(elapsed);

                await supabase.from('game_results').insert({
                    time_taken_seconds: elapsed,
                    user_id: user.id,
                    game_type: 'sprengjuleit',
                    score: 0,
                    won: false,
                    metadata: { difficulty: 'medium', puzzleDate: todayStr }
                });

                await supabase.rpc('process_daily_streak', { user_id_param: user.id });
                setEarnedXp(0);
            }
        } catch (e) {
            console.error('Error during loss trigger:', e);
        } finally {
            setTimeout(() => setIsFreshGameOver(true), 1000);
        }
    };

    const checkWin = async (currentGrid: CellState[][]) => {
        if (!game) return;
        
        syncGameState(currentGrid);

        let unrevealedCleanCells = 0;
        for (let r=0; r<game.rows; r++) {
            for (let c=0; c<game.cols; c++) {
                if (!currentGrid[r][c].isMine && !currentGrid[r][c].isRevealed) {
                    unrevealedCleanCells++;
                }
            }
        }

        if (unrevealedCleanCells === 0) {
            DeviceEventEmitter.emit('stop-timer');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setGameState('won');

            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    let elapsed = 0;
                    const todayStr = date || new Date().toISOString().split('T')[0];
                    const key = `timer_${user.id}_sprengjuleit_${todayStr}`;
                    const savedTime = await AsyncStorage.getItem(key);
                    if (savedTime) elapsed = parseInt(savedTime, 10);
                    
                    setFinalTime(elapsed);
                    
                    // You start with 200XP, max -100XP penalty, dropping by 1 per 3 seconds.
                    const isToday = todayStr === new Date().toISOString().split('T')[0];
                    const penalty = Math.floor(elapsed / 3);
                    const finalXp = isToday ? Math.max(100, 200 - penalty) : 0;

                    await supabase.from('game_results').insert({
                        time_taken_seconds: elapsed,
                        user_id: user.id,
                        game_type: 'sprengjuleit',
                        score: finalXp,
                        won: true,
                        metadata: { difficulty: 'medium', puzzleDate: todayStr }
                    });
                    if (finalXp > 0) {
                        await supabase.rpc('increment_xp', { user_id_param: user.id, xp_amount: finalXp, p_locale: 'is' });
                    }

                    setEarnedXp(finalXp);
                }
            } catch (e) {
                console.error('Error during win trigger:', e);
            } finally {
                setTimeout(() => setIsFreshGameOver(true), 1000);
            }
        }
    };

    const syncGameState = async (cGrid: CellState[][]) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !game) return;

        const todayStr = date || new Date().toISOString().split('T')[0];
        const isToday = todayStr === new Date().toISOString().split('T')[0];
        const gameTypeKey = isToday ? 'sprengjuleit' : `sprengjuleit_${todayStr}`;
        supabase.from('game_states').upsert({
            user_id: user.id,
            game_type: gameTypeKey,
            state_json: { board: cGrid },
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, game_type' }).then();
    };

    if (gameState === 'loading' || !game) {
        return (
            <SafeAreaView className="flex-1 bg-[#FAFAFA] items-center justify-center">
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
                    <Text className="text-2xl font-black font-serif text-[#1A1A1B] mb-2 text-center">Villa kom upp</Text>
                    <Text className="text-gray-500 font-medium text-center mb-6 leading-6">Vatn eða netsamband vantar. Vinsamlegast reyndu aftur síðar.</Text>
                    <TouchableOpacity onPress={() => router.back()} className="bg-[#1A1A1B] w-full py-4 rounded-full shadow-md items-center">
                        <Text className="text-white font-bold text-lg">Til baka</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const PADDING = 16;
    const TOTAL_WIDTH = width - (PADDING * 2);
    // Determine cell max size based on cols.
    const maxCellSize = Math.min(TOTAL_WIDTH / game.cols, 44);

    return (
        <>
            <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
            <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top', 'bottom']}>
                <MobileGameLayout onBack={() => router.back()} gameId="sprengjuleit" gameTitle="Sprengjuleit" isGameOver={gameState !== 'playing'}>
                    
                    <NativeGameEndModal
                gameTitle="Sprengjuleit"
                        visible={(gameState === 'won' || gameState === 'lost') && isFreshGameOver}
                        gameState={gameState as "won" | "lost"}
                        xpEarned={earnedXp}
                        winTitle={gameState === 'won' ? 'Vel gert!' : 'Því miður!'}
                        winDesc={gameState === 'won' ? "Þú fannst allar sprengjurnar!" : "Þú steigst á sprengju!"}
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

                    <View className="items-center mt-2 mb-4">
                        <Text className="text-gray-500 font-medium text-sm border border-gray-200 bg-white shadow-sm px-4 py-1.5 rounded-full">
                            {game.mines - flagsPlaced} {game.mines - flagsPlaced === 1 ? 'Sprengja' : 'Sprengjur'} eftir
                        </Text>
                    </View>

                    <ScrollView 
                        className="flex-1 w-full"
                        contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
                        maximumZoomScale={3.0}
                        minimumZoomScale={1.0}
                        showsVerticalScrollIndicator={false}
                        showsHorizontalScrollIndicator={false}
                    >
                        <Animated.View style={[shakeStyle, { backgroundColor: 'white', borderWidth: 1, borderColor: '#D3D6DA' }]}>
                            {grid.map((row, rIdx) => (
                                <View key={rIdx} className="flex-row">
                                    {row.map((cell, cIdx) => {
                                        let bgColor = '#E5E7EB'; 
                                        if (cell.isRevealed) {
                                            bgColor = cell.isMine ? '#ef4444' : '#ffffff'; 
                                        } else if (cell.isFlagged) {
                                            bgColor = '#D1D5DB';
                                        }

                                        const numColorObj: Record<number, string> = {
                                            1: '#60A5FA', // Blue
                                            2: '#34D399', // Green
                                            3: '#F87171', // Red
                                            4: '#A78BFA', // Purple
                                            5: '#FBBF24', // Yellow
                                        };

                                        return (
                                            <TouchableOpacity
                                                key={cIdx}
                                                activeOpacity={0.8}
                                                onPress={() => handleTap(rIdx, cIdx)}
                                                onLongPress={() => toggleFlag(rIdx, cIdx)}
                                                delayLongPress={300}
                                                style={{
                                                    width: maxCellSize,
                                                    height: maxCellSize,
                                                    backgroundColor: bgColor,
                                                    borderWidth: 0.5,
                                                    borderColor: '#D3D6DA', 
                                                    justifyContent: 'center',
                                                    alignItems: 'center'
                                                }}
                                            >
                                                {!cell.isRevealed && cell.isFlagged && (
                                                    <Ionicons name="flag" size={maxCellSize * 0.6} color="#fbbf24" />
                                                )}
                                                {cell.isRevealed && cell.isMine && (
                                                    <Text style={{ fontSize: maxCellSize * 0.6 }}>💣</Text>
                                                )}
                                                {cell.isRevealed && !cell.isMine && cell.neighborMines > 0 && (
                                                    <Text style={{ 
                                                        color: numColorObj[cell.neighborMines] || '#1A1A1B', 
                                                        fontWeight: '900', 
                                                        fontSize: maxCellSize * 0.5,
                                                        fontFamily: 'serif' 
                                                    }}>
                                                        {cell.neighborMines}
                                                    </Text>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            ))}
                        </Animated.View>
                    </ScrollView>

                    {/* Toggle Switch */}
                    <View className="px-6 py-6 pb-8 items-center bg-transparent mt-2">
                        <View className="flex-row bg-white rounded-full p-1 w-64 shadow-sm border border-[#D3D6DA]">
                            <TouchableOpacity 
                                activeOpacity={1}
                                onPress={() => {
                                    Haptics.impactAsync();
                                    setTapMode('dig');
                                }}
                                className={`flex-1 flex-row justify-center items-center py-3 rounded-full ${tapMode === 'dig' ? 'bg-[#3b82f6]' : 'bg-transparent'}`}
                            >
                                <Ionicons name="hammer" size={18} color={tapMode === 'dig' ? '#ffffff' : '#9CA3AF'} />
                                <Text className={`font-bold ml-2 ${tapMode === 'dig' ? 'text-white' : 'text-gray-500'}`}>Grafa</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                activeOpacity={1}
                                onPress={() => {
                                    Haptics.impactAsync();
                                    setTapMode('flag');
                                }}
                                className={`flex-1 flex-row justify-center items-center py-3 rounded-full ${tapMode === 'flag' ? 'bg-[#ef4444]' : 'bg-transparent'}`}
                            >
                                <Ionicons name="flag" size={18} color={tapMode === 'flag' ? '#ffffff' : '#9CA3AF'} />
                                <Text className={`font-bold ml-2 ${tapMode === 'flag' ? 'text-white' : 'text-gray-500'}`}>Flagga</Text>
                            </TouchableOpacity>
                        </View>
                        <Text className="text-gray-500 text-xs mt-3">Þú getur einnig haldið inni til að flagga</Text>
                    </View>

                </MobileGameLayout>
            </SafeAreaView>
        </>
    );
}
