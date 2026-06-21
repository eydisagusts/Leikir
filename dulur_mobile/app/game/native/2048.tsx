import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, DeviceEventEmitter, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { supabase, getFreshSession } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MobileGameLayout } from '@/components/MobileGameLayout';
import { NativeGameEndModal } from '@/components/NativeGameEndModal';

const { width } = Dimensions.get('window');

// Seeded RNG implementation
function cyrb128(str: string) {
    let h1 = 1779033703, h2 = 3144134277,
        h3 = 1013904242, h4 = 2773480762;
    for (let i = 0, k; i < str.length; i++) {
        k = str.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
    }
    h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
    h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
    h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
    h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
    return [(h1^h2^h3^h4)>>>0, (h2^h1)>>>0, (h3^h1)>>>0, (h4^h1)>>>0];
}

function sfc32(a: number, b: number, c: number, d: number) {
    return function() {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
      var t = (a + b) | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = (c << 21 | c >>> 11);
      d = d + 1 | 0;
      t = t + d | 0;
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    }
}

export default function Native2048() {
    const [gameState, setGameState] = useState<'playing' | 'won' | 'lost' | 'loading' | 'error'>('loading');
    const [grid, setGrid] = useState<number[][]>([]);
    const [score, setScore] = useState(0);
    const [earnedXp, setEarnedXp] = useState<number | null>(null);
    const [isFreshGameOver, setIsFreshGameOver] = useState(false);
    
    const rngRef = useRef<(() => number) | null>(null);

    useEffect(() => {
        async function init() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                const today = new Date().toISOString().split('T')[0];
                const seedArr = cyrb128(today);
                rngRef.current = sfc32(seedArr[0], seedArr[1], seedArr[2], seedArr[3]);

                if (!user) {
                    setGrid(initializeGrid());
                    setGameState('playing');
                    return;
                }

                const [stateRes, resultRes] = await Promise.all([
                    supabase.from('game_states').select('state_json, updated_at').eq('user_id', user.id).eq('game_type', '2048').maybeSingle(),
                    supabase.from('game_results').select('won, metadata, score').eq('user_id', user.id).eq('game_type', '2048').gte('played_at', `${today}T00:00:00Z`).order('played_at', { ascending: false }).limit(1).maybeSingle()
                ]);

                if (resultRes.data) {
                    setGameState(resultRes.data.won ? 'won' : 'lost');
                    setScore(resultRes.data.score || 0);
                    // Just put a generic grid since game is over
                    setGrid(Array(4).fill(0).map(() => Array(4).fill(0)));
                } else if (stateRes.data?.state_json) {
                    const updatedDate = new Date(stateRes.data.updated_at).toISOString().split('T')[0];
                    if (updatedDate === today) {
                        setGrid(stateRes.data.state_json.grid);
                        setScore(stateRes.data.state_json.score);
                        setGameState('playing');
                    } else {
                        setGrid(initializeGrid());
                        setGameState('playing');
                    }
                } else {
                    setGrid(initializeGrid());
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

    const initializeGrid = () => {
        let newGrid = Array(4).fill(0).map(() => Array(4).fill(0));
        newGrid = addRandomTile(newGrid);
        newGrid = addRandomTile(newGrid);
        return newGrid;
    };

    const getEmptyCells = (currentGrid: number[][]) => {
        let cells: { r: number; c: number }[] = [];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (currentGrid[r][c] === 0) cells.push({ r, c });
            }
        }
        return cells;
    };

    const addRandomTile = (currentGrid: number[][]) => {
        const emptyCells = getEmptyCells(currentGrid);
        if (emptyCells.length === 0 || !rngRef.current) return currentGrid;
        const randIndex = Math.floor(rngRef.current() * emptyCells.length);
        const { r, c } = emptyCells[randIndex];
        const value = rngRef.current() < 0.9 ? 2 : 4;
        const newGrid = currentGrid.map(row => [...row]);
        newGrid[r][c] = value;
        return newGrid;
    };

    const saveStateToDb = async (currentGrid: number[][], currentScore: number) => {
        const session = await getFreshSession();
        if (!session?.user) return;
        await supabase.from('game_states').upsert({
            user_id: session.user.id,
            game_type: '2048',
            state_json: { grid: currentGrid, score: currentScore },
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, game_type' });
    };

    const checkGameOver = async (currentGrid: number[][], currentScore: number) => {
        let has2048 = false;
        let canMove = false;

        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (currentGrid[r][c] === 2048) has2048 = true;
                if (currentGrid[r][c] === 0) canMove = true;
                if (r < 3 && currentGrid[r][c] === currentGrid[r + 1][c]) canMove = true;
                if (c < 3 && currentGrid[r][c] === currentGrid[r][c + 1]) canMove = true;
            }
        }

        if (has2048 || !canMove) {
            setGameState(has2048 ? 'won' : 'lost');
            DeviceEventEmitter.emit('stop-timer');
            setIsFreshGameOver(true);

            const session = await getFreshSession();
            if (session?.user) {
                const today = new Date().toISOString().split('T')[0];
                const key = `timer_${session.user.id}_2048_${today}`;
                const savedTime = await AsyncStorage.getItem(key);
                const elapsed = savedTime ? parseInt(savedTime, 10) : 0;

                const speedBonus = Math.max(0, Math.floor(50 * (1 - (elapsed - 300) / 600)));
                const xpEarnedTotal = has2048 
                    ? 100 + (elapsed <= 300 ? 50 : speedBonus)
                    : Math.min(75, Math.floor(currentScore / 250));
                setEarnedXp(xpEarnedTotal);

                try {
                    await fetch(process.env.EXPO_PUBLIC_API_URL + '/api/mobile/2048', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session.access_token}`
                        },
                        body: JSON.stringify({
                            action: 'save',
                            won: has2048,
                            score: xpEarnedTotal,
                            timeTakenSeconds: elapsed
                        })
                    });
                } catch(e) {}
            }
        }
    };

    const move = (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
        if (gameState !== 'playing') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        let newGrid = grid.map(row => [...row]);
        let moved = false;
        let scoreIncrease = 0;

        const slideAndMerge = (row: number[]) => {
            let arr = row.filter(val => val !== 0);
            for (let i = 0; i < arr.length - 1; i++) {
                if (arr[i] === arr[i + 1]) {
                    arr[i] *= 2;
                    scoreIncrease += arr[i];
                    arr.splice(i + 1, 1);
                }
            }
            while (arr.length < 4) arr.push(0);
            return arr;
        };

        if (direction === 'LEFT' || direction === 'RIGHT') {
            for (let r = 0; r < 4; r++) {
                let row = newGrid[r];
                if (direction === 'RIGHT') row.reverse();
                let newRow = slideAndMerge(row);
                if (direction === 'RIGHT') newRow.reverse();
                if (newGrid[r].join(',') !== newRow.join(',')) moved = true;
                newGrid[r] = newRow;
            }
        } else {
            for (let c = 0; c < 4; c++) {
                let col = [newGrid[0][c], newGrid[1][c], newGrid[2][c], newGrid[3][c]];
                if (direction === 'DOWN') col.reverse();
                let newCol = slideAndMerge(col);
                if (direction === 'DOWN') newCol.reverse();
                for (let r = 0; r < 4; r++) {
                    if (newGrid[r][c] !== newCol[r]) moved = true;
                    newGrid[r][c] = newCol[r];
                }
            }
        }

        if (moved) {
            newGrid = addRandomTile(newGrid);
            setGrid(newGrid);
            const newScore = score + scoreIncrease;
            setScore(newScore);
            saveStateToDb(newGrid, newScore);
            checkGameOver(newGrid, newScore);
        }
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                const { dx, dy } = gestureState;
                return Math.abs(dx) > 10 || Math.abs(dy) > 10;
            },
            onPanResponderRelease: (evt, gestureState) => {
                const { dx, dy } = gestureState;
                if (Math.abs(dx) > Math.abs(dy)) {
                    if (Math.abs(dx) > 30) {
                        move(dx > 0 ? 'RIGHT' : 'LEFT');
                    }
                } else {
                    if (Math.abs(dy) > 30) {
                        move(dy > 0 ? 'DOWN' : 'UP');
                    }
                }
            }
        })
    ).current;

    const getTileColor = (val: number) => {
        const colors: Record<number, { bg: string, text: string }> = {
            0: { bg: '#cdc1b4', text: 'transparent' },
            2: { bg: '#eee4da', text: '#776e65' },
            4: { bg: '#ede0c8', text: '#776e65' },
            8: { bg: '#f2b179', text: '#ffffff' },
            16: { bg: '#f59563', text: '#ffffff' },
            32: { bg: '#f67c5f', text: '#ffffff' },
            64: { bg: '#f65e3b', text: '#ffffff' },
            128: { bg: '#edcf72', text: '#ffffff' },
            256: { bg: '#edcc61', text: '#ffffff' },
            512: { bg: '#edc850', text: '#ffffff' },
            1024: { bg: '#edc53f', text: '#ffffff' },
            2048: { bg: '#edc22e', text: '#ffffff' }
        };
        return colors[val] || { bg: '#3c3a32', text: '#f9f6f2' };
    };

    const handleDevRefresh = () => {
        setGameState('playing');
        setGrid(initializeGrid());
        setScore(0);
        DeviceEventEmitter.emit('reset-timer');
    };

    return (
            <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top', 'bottom']}>
                <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
                <MobileGameLayout 
                    gameId="2048"
                    gameTitle="2048" 
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
                        
                        <View className="w-full flex-row justify-between items-center mb-6">
                            <Text className="text-sm font-bold text-slate-500 uppercase">Stig</Text>
                            <Text className="text-3xl font-black text-slate-800">{score}</Text>
                        </View>

                        <View {...panResponder.panHandlers} className="bg-[#bbada0] p-3 rounded-2xl w-full aspect-square relative">
                                {grid.length > 0 && grid.map((row, r) => (
                                    <View key={r} className="flex-row flex-1 justify-between mb-2 last:mb-0 gap-2">
                                        {row.map((val, c) => (
                                            <View key={`${r}-${c}`} className="flex-1 rounded-xl items-center justify-center shadow-sm" style={{ backgroundColor: getTileColor(val).bg }}>
                                                {val > 0 && (
                                                    <Text style={{ color: getTileColor(val).text, fontSize: val > 512 ? 24 : 32, fontWeight: '900' }}>
                                                        {val}
                                                    </Text>
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                ))}

                                {gameState !== 'playing' && gameState !== 'loading' && (
                                    <View className="absolute inset-0 bg-black/40 rounded-2xl items-center justify-center z-10">
                                        <Text className="text-white font-black text-4xl shadow-md">
                                            {gameState === 'won' ? 'Þú vannst!' : 'Leik lokið'}
                                        </Text>
                                    </View>
                                )}
                            </View>

                        <Text className="text-slate-500 text-center mt-8 px-4 leading-6">
                            Strjúktu til að færa kubbana. Markmiðið er að ná 2048!
                        </Text>
                    </View>

                    <NativeGameEndModal
                        visible={isFreshGameOver}
                        onContinue={() => setIsFreshGameOver(false)}
                        gameTitle="2048"
                        gameState={gameState as "won" | "lost"}
                        xpEarned={earnedXp}
                        winTitle="2048 Náð!"
                        winDesc={`Þú kláraðir daglega 2048.\nÞú fékkst ${score} stig.`}
                    />
                </MobileGameLayout>
            </SafeAreaView>
    );
}
