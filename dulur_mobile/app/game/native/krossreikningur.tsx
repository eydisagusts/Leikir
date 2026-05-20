import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, DeviceEventEmitter, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MobileGameLayout } from '@/components/MobileGameLayout';
import { NativeGameEndModal } from '@/components/NativeGameEndModal';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';

type CellData = {
    type: 'number' | 'operator' | 'blank' | 'empty';
    value: string | number | null;
    id: string;
    fixed?: boolean;
};

type PuzzleData = {
    id: string;
    grid: CellData[][];
    size: number;
    answerBank: number[];
};

type LevelData = {
    easy: PuzzleData;
    medium: PuzzleData;
    hard: PuzzleData;
};

type BankItem = { id: number; val: number; used: boolean };

function classNames(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(' ');
}

export default function NativeKrossreikningur() {
    const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
    const [gameState, setGameState] = useState<'loading' | 'playing' | 'won' | 'error'>('loading');
    
    const [grid, setGrid] = useState<CellData[][]>([]);
    const [answerBank, setAnswerBank] = useState<BankItem[]>([]);
    
    const [selectedBankId, setSelectedBankId] = useState<number | null>(null);
    const [selectedCell, setSelectedCell] = useState<{r: number, c: number} | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const [earnedXp, setEarnedXp] = useState<number | null>(null);
    const [isFreshGameOver, setIsFreshGameOver] = useState(false);
    
    const [allPuzzles, setAllPuzzles] = useState<LevelData | null>(null);

    const initGame = async (diff: 'easy' | 'medium' | 'hard') => {
        setGameState('loading');
        try {
            const today = new Date().toISOString().split('T')[0];
            const sessionPromise = supabase.auth.getSession();
            
            let puzzles = allPuzzles;
            if (!puzzles) {
                puzzles = await fetch(`${API_URL}/api/mobile/krossreikningur/init`).then(res => res.json());
                setAllPuzzles(puzzles);
            }

            const { data: { session } } = await sessionPromise;
            const user = session?.user;

            const dbPromises = user ? Promise.all([
                supabase.from('game_states').select('state_json, updated_at').eq('user_id', user.id).eq('game_type', `krossreikningur_${diff}`).maybeSingle(),
                supabase.from('game_results').select('won').eq('user_id', user.id).eq('game_type', `krossreikningur`).gte('played_at', `${today}T00:00:00Z`).maybeSingle()
            ]) : Promise.resolve([{ data: null }, { data: null }]);

            const [stateRes, resultRes] = await dbPromises;

            let loadedGrid = puzzles![diff].grid;
            let loadedBank = puzzles![diff].answerBank.map((val: number, idx: number) => ({ id: idx, val, used: false }));

            if (user) {
                const existingResult = resultRes.data;
                const existingState = stateRes.data;

                // Check if they won this specific difficulty today
                const diffResult = await supabase.from('game_results').select('won').eq('user_id', user.id).eq('game_type', `krossreikningur`).eq('metadata->>difficulty', diff).gte('played_at', `${today}T00:00:00Z`).maybeSingle();

                if (diffResult.data?.won) {
                    setGameState('won');
                } else {
                    setGameState('playing');
                    if (existingState && existingState.updated_at.startsWith(today)) {
                        const saved = existingState.state_json;
                        if (saved.grid) loadedGrid = saved.grid;
                        if (saved.answerBank) loadedBank = saved.answerBank;
                    }
                    setTimeout(() => DeviceEventEmitter.emit('start-timer'), 500);
                }
            } else {
                setGameState('playing');
            }

            setGrid(loadedGrid);
            setAnswerBank(loadedBank);
            setSelectedBankId(null);
            setSelectedCell(null);
        } catch (err) {
            setGameState('error');
        }
    };

    useEffect(() => {
        initGame(difficulty);
    }, [difficulty]);

    const changeDifficulty = (newDiff: 'easy' | 'medium' | 'hard') => {
        if (difficulty === newDiff) return;
        setGameState('loading');
        setGrid([]);
        setAnswerBank([]);
        setDifficulty(newDiff);
    };

    const handleBankTap = (id: number) => {
        if (gameState !== 'playing') return;
        Haptics.selectionAsync();
        
        if (selectedBankId === id) {
            setSelectedBankId(null);
        } else {
            setSelectedBankId(id);
            // If a cell was already selected, place it immediately
            if (selectedCell) {
                placeNumber(selectedCell.r, selectedCell.c, id);
            }
        }
    };

    const handleCellTap = (r: number, c: number) => {
        if (gameState !== 'playing') return;
        const cell = grid[r][c];
        if (cell.type !== 'empty' && cell.type !== 'number') return;
        if (cell.fixed) return;

        Haptics.selectionAsync();
        
        // If they tap a cell that already has a user-placed number, remove it
        if (cell.type === 'number' && !cell.fixed) {
            const oldVal = cell.value as number;
            
            // Find which bank item this was
            const bankItem = answerBank.find(b => b.val === oldVal && b.used);
            if (bankItem) {
                const newBank = [...answerBank];
                newBank[bankItem.id].used = false;
                setAnswerBank(newBank);
            }
            
            const newGrid = [...grid];
            newGrid[r][c] = { ...cell, type: 'empty', value: null };
            setGrid(newGrid);
            setSelectedCell(null);
            saveState(newGrid, answerBank);
            return;
        }

        if (selectedBankId !== null) {
            placeNumber(r, c, selectedBankId);
        } else {
            if (selectedCell?.r === r && selectedCell?.c === c) {
                setSelectedCell(null);
            } else {
                setSelectedCell({ r, c });
            }
        }
    };

    const placeNumber = (r: number, c: number, bankId: number) => {
        const item = answerBank.find(b => b.id === bankId);
        if (!item || item.used) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        DeviceEventEmitter.emit('start-timer');

        const newGrid = [...grid];
        const newBank = [...answerBank];

        // If the cell already had a user number, return it to bank
        const cell = grid[r][c];
        if (cell.type === 'number' && !cell.fixed) {
            const oldVal = cell.value as number;
            const oldBankItem = newBank.find(b => b.val === oldVal && b.used);
            if (oldBankItem) {
                oldBankItem.used = false;
            }
        }

        newGrid[r][c] = { ...cell, type: 'number', value: item.val, fixed: false };
        newBank[bankId].used = true;

        setGrid(newGrid);
        setAnswerBank(newBank);
        setSelectedBankId(null);
        setSelectedCell(null);
        setErrorMsg(null);

        saveState(newGrid, newBank);

        // Auto-validate if all used
        if (newBank.every(b => b.used)) {
            setTimeout(() => validateBoard(newGrid), 500);
        }
    };

    const saveState = async (currentGrid: CellData[][], currentBank: BankItem[]) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from('game_states').upsert({
            user_id: user.id,
            game_type: `krossreikningur_${difficulty}`,
            state_json: { grid: currentGrid, answerBank: currentBank, difficulty },
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, game_type' });
    };

    const evalOp = (a: number, op: string, b: number) => {
        if (op === '+') return a + b;
        if (op === '-') return a - b;
        if (op === '*') return a * b;
        if (op === '/') return a / b;
        return a;
    };

    const evalEq = (nums: number[], operators: string[]) => {
        let res = nums[0];
        for (let i = 0; i < operators.length; i++) {
            res = evalOp(res, operators[i], nums[i + 1]);
        }
        return res;
    };

    const validateBoard = async (currentGrid = grid) => {
        const isFull = currentGrid.every(row => row.every(c => c.type !== 'empty'));
        if (!isFull) {
            setErrorMsg("Þú þarft að fylla út alla reiti áður en þú yfirferð.");
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        let isCorrect = true;

        for (let r = 0; r < currentGrid.length; r++) {
            for (let c = 0; c < currentGrid[r].length; c++) {
                if (currentGrid[r][c].type === 'operator' && currentGrid[r][c].value === '=') {
                    // Check horizontal equation
                    if (c > 0 && currentGrid[r][c - 1].type !== 'blank') {
                        let nums: number[] = [];
                        let ops: string[] = [];
                        let cc = c - 1;
                        while (cc >= 0 && currentGrid[r][cc].type !== 'blank' && currentGrid[r][cc].value !== '=') {
                            if (currentGrid[r][cc].type === 'number' || currentGrid[r][cc].type === 'empty') {
                                nums.unshift(currentGrid[r][cc].value as number);
                            } else {
                                ops.unshift(currentGrid[r][cc].value as string);
                            }
                            cc--;
                        }
                        let expectedRes = currentGrid[r][c + 1].value as number;
                        if (nums.includes(null as any) || evalEq(nums, ops) !== expectedRes) {
                            isCorrect = false;
                        }
                    }

                    // Check vertical equation
                    if (r > 0 && currentGrid[r - 1][c].type !== 'blank') {
                        let nums: number[] = [];
                        let ops: string[] = [];
                        let rr = r - 1;
                        while (rr >= 0 && currentGrid[rr][c].type !== 'blank' && currentGrid[rr][c].value !== '=') {
                            if (currentGrid[rr][c].type === 'number' || currentGrid[rr][c].type === 'empty') {
                                nums.unshift(currentGrid[rr][c].value as number);
                            } else {
                                ops.unshift(currentGrid[rr][c].value as string);
                            }
                            rr--;
                        }
                        let expectedRes = currentGrid[r + 1][c].value as number;
                        if (nums.includes(null as any) || evalEq(nums, ops) !== expectedRes) {
                            isCorrect = false;
                        }
                    }
                }
            }
        }

        if (isCorrect) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setGameState('won');
            setIsFreshGameOver(true);
            await syncWin();
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setErrorMsg("Það eru villur á borðinu. Reyndu aftur!");
        }
    };

    const syncWin = async () => {
        DeviceEventEmitter.emit('stop-timer');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let xpReward = 100;
        if (difficulty === 'medium') xpReward = 150;
        if (difficulty === 'hard') xpReward = 250;

        let elapsed = 60;
        const date = new Date().toLocaleDateString('en-CA');
        const savedTime = await AsyncStorage.getItem(`timer_${user.id}_krossreikningur_${date}`);
        if (savedTime) elapsed = parseInt(savedTime, 10) || 60;

        await supabase.from('game_results').insert({
            time_taken_seconds: elapsed,
            user_id: user.id,
            game_type: 'krossreikningur',
            score: xpReward,
            won: true,
            metadata: { difficulty }
        });

        await supabase.rpc('increment_xp', { user_id_param: user.id, xp_amount: xpReward, p_locale: 'is' });
        await supabase.rpc('process_daily_streak', { user_id_param: user.id });
        setEarnedXp(xpReward);
        DeviceEventEmitter.emit('refresh-stats'); // Immediately update dashboard
    };

    const handleCloseModal = () => {
        setIsFreshGameOver(false);
        if (earnedXp && earnedXp > 0) {
            DeviceEventEmitter.emit('xp-earned', earnedXp);
        }
    };

    // Calculate grid dynamic size based on device width
    const SCREEN_WIDTH = Dimensions.get('window').width;
    const isPad = SCREEN_WIDTH >= 768;
    const MAX_GRID_WIDTH = isPad ? 500 : SCREEN_WIDTH - 32; // 16px padding on sides
    
    // We render the rows. Find exact number of columns
    const cols = grid.length > 0 ? grid[0].length : 1;
    const cellSize = Math.floor(MAX_GRID_WIDTH / cols);

    const answerCols = answerBank.length === 10 ? 5 : answerBank.length === 18 ? 9 : 12;

    return (
        <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />
            <MobileGameLayout gameId={`krossreikningur_${difficulty}`} gameTitle="Krossreikningur" isGameOver={gameState === 'won'} onBack={() => router.back()}>
                {gameState === 'loading' ? (
                    <View className="flex-1 items-center justify-center p-6 text-center min-h-[300px]">
                        <ActivityIndicator size="large" color="#538D4E" />
                    </View>
                ) : gameState === 'error' ? (
                    <View className="flex-1 items-center justify-center p-6 text-center min-h-[300px]">
                        <View className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 items-center w-full max-w-sm">
                            <Ionicons name="lock-closed" size={48} color="#eb3b5a" style={{ marginBottom: 16 }} />
                            <Text className="text-2xl font-black font-serif text-[#1A1A1B] mb-2 text-center">Aðgangur Lokaður</Text>
                            <TouchableOpacity onPress={() => router.back()} className="bg-[#1A1A1B] w-full py-4 rounded-full shadow-md items-center mt-6">
                                <Text className="text-white font-bold text-lg">Til baka</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <View className="flex-1 flex-col items-center w-full self-center pb-8 pt-2 px-4">
                        {/* Level Picker */}
                        <View className="flex-row items-center justify-center gap-2 bg-[#F0F0F0] rounded-full p-1.5 border border-[#D3D6DA] mb-6">
                            {(['easy', 'medium', 'hard'] as const).map(level => (
                                <TouchableOpacity 
                                    key={level} 
                                    onPress={() => changeDifficulty(level)} 
                                    className={`px-4 py-2 rounded-full ${difficulty === level ? 'bg-white shadow-sm border border-gray-100' : ''}`}
                                >
                                    <Text className={`font-bold text-sm capitalize ${difficulty === level ? 'text-[#1A1A1B]' : 'text-gray-500'}`}>
                                        {level === 'easy' ? 'Auðvelt' : level === 'medium' ? 'Miðlungs' : 'Erfitt'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {errorMsg && (
                            <View className="w-full p-3 mb-4 bg-red-100 border border-red-200 rounded-lg">
                                <Text className="text-red-600 text-center text-sm font-bold">{errorMsg}</Text>
                            </View>
                        )}

                        {/* Game Board */}
                        <View className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 justify-center items-center w-full max-w-[500px]">
                            <View style={{ flexDirection: 'column' }}>
                                {grid.map((row, rIdx) => (
                                    <View key={rIdx} style={{ flexDirection: 'row' }}>
                                        {row.map((cell, cIdx) => {
                                            if (cell.type === 'blank') {
                                                return <View key={cIdx} style={{ width: cellSize, height: cellSize }} />;
                                            }

                                            if (cell.type === 'operator') {
                                                return (
                                                    <View key={cIdx} style={{ width: cellSize, height: cellSize, borderWidth: 1, borderColor: '#1e293b', backgroundColor: '#FFF8E7', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Text style={{ fontSize: cellSize * 0.45, fontWeight: 'bold', color: '#0f172a' }}>
                                                            {cell.value === '/' ? '÷' : cell.value}
                                                        </Text>
                                                    </View>
                                                );
                                            }

                                            const isFixed = cell.type === 'number' && cell.fixed;
                                            const isUserPlaced = cell.type === 'number' && !cell.fixed;
                                            const isSelected = selectedCell?.r === rIdx && selectedCell?.c === cIdx;

                                            let bgColor = 'white';
                                            let textColor = 'transparent';
                                            let ring = false;

                                            if (isFixed) {
                                                bgColor = '#FFF8E7';
                                                textColor = '#0f172a';
                                            } else if (isUserPlaced) {
                                                textColor = '#10b981';
                                            }

                                            if (isSelected) {
                                                bgColor = '#eff6ff';
                                                ring = true;
                                            }

                                            // Highlight if a bank item is selected and this is an empty spot
                                            if (selectedBankId !== null && cell.type === 'empty') {
                                                bgColor = '#ecfdf5';
                                            }

                                            return (
                                                <TouchableOpacity 
                                                    key={cIdx} 
                                                    onPress={() => handleCellTap(rIdx, cIdx)}
                                                    activeOpacity={isFixed ? 1 : 0.7}
                                                    style={{ 
                                                        width: cellSize, 
                                                        height: cellSize, 
                                                        borderWidth: ring ? 2 : 1, 
                                                        borderColor: ring ? '#3b82f6' : '#1e293b', 
                                                        backgroundColor: bgColor, 
                                                        alignItems: 'center', 
                                                        justifyContent: 'center' 
                                                    }}
                                                >
                                                    <Text style={{ fontSize: cellSize * 0.45, fontWeight: 'bold', color: textColor }}>
                                                        {cell.value}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Answer Bank */}
                        <View className="w-full max-w-[500px] mt-6 bg-transparent">
                            <Text className="text-center text-gray-500 font-bold mb-3 uppercase tracking-wider text-xs">
                                Ýttu á tölu og svo á reit
                            </Text>
                            <View 
                                style={{ 
                                    flexDirection: 'row', 
                                    flexWrap: 'wrap', 
                                    justifyContent: 'center', 
                                    gap: 6 
                                }}
                            >
                                {answerBank.map((bankItem) => {
                                    const isSelected = selectedBankId === bankItem.id;
                                    const itemWidth = Math.floor((MAX_GRID_WIDTH - (answerCols * 6)) / answerCols);
                                    
                                    return (
                                        <TouchableOpacity
                                            key={bankItem.id}
                                            onPress={() => handleBankTap(bankItem.id)}
                                            disabled={bankItem.used}
                                            style={{
                                                width: itemWidth,
                                                height: itemWidth,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderRadius: 8,
                                                borderWidth: 2,
                                                borderColor: bankItem.used ? '#f1f5f9' : isSelected ? '#34d399' : '#cbd5e1',
                                                backgroundColor: bankItem.used ? '#f8fafc' : isSelected ? '#ecfdf5' : 'white',
                                                opacity: bankItem.used ? 0 : 1,
                                            }}
                                            activeOpacity={0.6}
                                        >
                                            <Text style={{ 
                                                fontSize: itemWidth * 0.4, 
                                                fontWeight: 'bold', 
                                                color: isSelected ? '#10b981' : '#334155' 
                                            }}>
                                                {bankItem.val}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                        
                        {/* Clear Button */}
                        <View className="mt-8 mb-4 w-full max-w-[500px] flex-row gap-4 px-2">
                            <TouchableOpacity 
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    const newGrid = [...grid.map(row => [...row])];
                                    const newBank = [...answerBank];
                                    
                                    for (let r=0; r<newGrid.length; r++) {
                                        for (let c=0; c<newGrid[r].length; c++) {
                                            const cell = newGrid[r][c];
                                            if (cell.type === 'number' && !cell.fixed) {
                                                const oldBankItem = newBank.find(b => b.val === cell.value && b.used);
                                                if (oldBankItem) oldBankItem.used = false;
                                                newGrid[r][c] = { ...cell, type: 'empty', value: null };
                                            }
                                        }
                                    }
                                    
                                    setGrid(newGrid);
                                    setAnswerBank(newBank);
                                    setSelectedCell(null);
                                    setSelectedBankId(null);
                                    setErrorMsg(null);
                                    saveState(newGrid, newBank);
                                }}
                                className="flex-1 bg-white border border-slate-300 py-4 rounded-xl items-center shadow-sm"
                            >
                                <Text className="text-slate-600 font-bold text-lg uppercase tracking-wider">Hreinsa</Text>
                            </TouchableOpacity>
                        </View>

                        <NativeGameEndModal
                            gameTitle="Krossreikningur"
                            visible={gameState === 'won' && isFreshGameOver}
                            gameState="won"
                            xpEarned={earnedXp}
                            winTitle="Vel reiknað!"
                            winDesc="Öll borð leyst."
                            loseTitle=""
                            loseDesc=""
                            onContinue={handleCloseModal}
                        />

                    </View>
                )}
            </MobileGameLayout>
        </SafeAreaView>
    );
}
