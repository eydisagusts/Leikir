import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, DeviceEventEmitter, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withRepeat } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { MobileGameLayout } from '@/components/MobileGameLayout';
import { NativeGameEndModal } from '@/components/NativeGameEndModal';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';
const { width } = Dimensions.get('window');

type SudokuPuzzle = {
    id: number;
    initial: number[][];
    solution: number[][];
};

export default function NativeSudoku() {
    const [puzzle, setPuzzle] = useState<SudokuPuzzle | null>(null);
    const [difficulty, setDifficulty] = useState('easy');
    const [userGrid, setUserGrid] = useState<number[][]>([]);
    
    const [selectedRow, setSelectedRow] = useState<number | null>(null);
    const [selectedCol, setSelectedCol] = useState<number | null>(null);
    const [isNotesMode, setIsNotesMode] = useState(false);
    const [notes, setNotes] = useState<Record<string, number[]>>({});
    const [xpAvailable, setXpAvailable] = useState<number>(0);

    const [gameState, setGameState] = useState<'playing' | 'won' | 'loading' | 'error'>('loading');
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

    const handleShare = async () => {
        const header = `Dulur: Sudoku ✏️`;
        const diffDict: Record<string, string> = { easy: 'Létt', medium: 'Miðlungs', hard: 'Erfitt' };
        const diffText = diffDict[difficulty] || difficulty;
        const xpText = earnedXp ? `\n⭐ XP: +${earnedXp}` : '';
        const message = `${header}\nErfiðleikastig: ${diffText}${xpText}\n\nÉg leysti þraut dagsins!\ndulur.is 🔥`;
        try {
            await Share.share({ message });
        } catch (error) {
            console.error('Error sharing', error);
        }
    };

    const flyStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: xpAnimY.value }],
            opacity: xpAnimOpacity.value,
        };
    });

    const shakeOffset = useSharedValue(0);
    const shakeStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: shakeOffset.value }]
    }));

    useEffect(() => {
        async function init(diff: string) {
            setGameState('loading');
            try {
                const today = new Date().toISOString().split('T')[0];
                
                const sessionPromise = supabase.auth.getSession();
                const apiPromise = fetch(`${API_URL}/api/mobile/sudoku/init?difficulty=${diff}`).then(res => res.json());

                const { data: { session } } = await sessionPromise;
                const user = session?.user;

                // Fire DB queries only if user exists
                const dbPromises = user ? Promise.all([
                    supabase.from('profiles').select('xp').eq('id', user.id).maybeSingle(),
                    supabase.from('game_results').select('won').eq('user_id', user.id).eq('game_type', `sudoku_${diff}`).gte('played_at', `${today}T00:00:00Z`).order('played_at', { ascending: false }).limit(1).maybeSingle(),
                    supabase.from('game_states').select('state_json, updated_at').eq('user_id', user.id).eq('game_type', `sudoku_${diff}`).maybeSingle()
                ]) : Promise.resolve([{ data: null }, { data: null }, { data: null }]);

                const [data, [profileRes, resDataRes, stateDataRes]] = await Promise.all([
                    apiPromise,
                    dbPromises
                ]);
                
                const curPuz: SudokuPuzzle = data.puzzle[diff] || data.puzzle.easy;
                setPuzzle(curPuz);
                setDifficulty(data.difficulty);
                setNotes({});

                if (!user) {
                    setUserGrid(curPuz.initial.map((row: any) => [...row]));
                    setGameState('playing');
                    return; 
                }

                const profile = profileRes.data;
                const resData = resDataRes.data;
                const stateData = stateDataRes.data;
                
                if (profile) setXpAvailable(profile.xp || 0);

                if (stateData && stateData.updated_at.startsWith(today)) {
                    setUserGrid(stateData.state_json.currentGrid || curPuz.initial.map((row: any) => [...row]));
                    setNotes(stateData.state_json.notes || {});
                } else {
                    setUserGrid(curPuz.initial.map((row: any) => [...row]));
                    setNotes({});
                    if (stateData) {
                        // Removed game_states deletion to preserve state for replay visualization
                    }
                }

                if (resData) {
                    setGameState('won');
                } else {
                    // Timer will start on first interaction
                    setGameState('playing');
                }
            } catch (err) {
                setGameState('error');
            }
        }
        init(difficulty);
    }, [difficulty]);

    const handleHint = async () => {
        if (gameState !== 'playing' || selectedRow === null || selectedCol === null) return;
        DeviceEventEmitter.emit('start-timer');
        if (xpAvailable < 20) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }
        const correctVal = puzzle!.solution[selectedRow][selectedCol];
        if (userGrid[selectedRow][selectedCol] !== 0) return; // Only hint empty squares

        setXpAvailable(prev => prev - 20);
        
        applyNumber(selectedRow, selectedCol, correctVal);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.rpc('increment_xp', { user_id_param: user.id, xp_amount: -20, p_locale: 'is' });
            DeviceEventEmitter.emit('xp-earned', -20);
        }
    };

    const triggerShake = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        shakeOffset.value = withSequence(
            withTiming(-5, { duration: 40 }),
            withRepeat(withTiming(5, { duration: 80 }), 3, true),
            withTiming(0, { duration: 40 })
        );
    };

    const handleLevelChange = (diff: string) => {
        if (difficulty === diff) return;
        setGameState('loading');
        setUserGrid([]);
        setNotes({});
        setDifficulty(diff);
    };

    const handleCellTap = (r: number, c: number) => {
        if (gameState !== 'playing') return;
        DeviceEventEmitter.emit('start-timer');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedRow(r);
        setSelectedCol(c);
    };

    const isNumberCompleted = (num: number) => {
        if (!userGrid || userGrid.length === 0) return false;
        let count = 0;
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (userGrid[r][c] === num) count++;
            }
        }
        return count >= 9;
    };

    const handleNumPad = (num: number) => {
        if (gameState !== 'playing') return;
        DeviceEventEmitter.emit('start-timer');
        if (selectedRow === null || selectedCol === null) return;
        if (puzzle!.initial[selectedRow][selectedCol] !== 0) return; // Cannot edit initial
        if (userGrid[selectedRow][selectedCol] !== 0) return; // Already solved correctly

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (isNotesMode) {
            const key = `${selectedRow}-${selectedCol}`;
            const cellNotes = notes[key] || [];
            let newCellNotes;
            if (cellNotes.includes(num)) {
                newCellNotes = cellNotes.filter(n => n !== num);
            } else {
                newCellNotes = [...cellNotes, num].sort();
            }
            const newNotes = { ...notes, [key]: newCellNotes };
            setNotes(newNotes);
            syncGameState(userGrid, newNotes);
            return;
        }

        applyNumber(selectedRow, selectedCol, num);
    };

    const handleClear = () => {
        if (gameState !== 'playing' || selectedRow === null || selectedCol === null) return;
        DeviceEventEmitter.emit('start-timer');
        if (puzzle!.initial[selectedRow][selectedCol] !== 0) return;
        if (userGrid[selectedRow][selectedCol] !== 0) return;

        const key = `${selectedRow}-${selectedCol}`;
        if (notes[key]) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const newNotes = { ...notes };
            delete newNotes[key];
            setNotes(newNotes);
            syncGameState(userGrid, newNotes);
        }
    };

    const applyNumber = async (r: number, c: number, num: number) => {
        const conflicts = checkConflict(r, c, num);

        if (conflicts || puzzle!.solution[r][c] !== num) {
            triggerShake();
            // Strictly enforce correctness for the native app UX
            const newGrid = [...userGrid];
            newGrid[r][c] = num;
            setUserGrid(newGrid);
            setTimeout(() => {
                const revertGrid = [...newGrid];
                revertGrid[r][c] = 0;
                setUserGrid([...revertGrid]);
            }, 800);
            return;
        }

        Haptics.selectionAsync();
        const newGrid = [...userGrid];
        newGrid[r][c] = num;
        setUserGrid(newGrid);
        
        // Auto clear notes
        const newNotes = { ...notes };
        const blockStartR = Math.floor(r / 3) * 3;
        const blockStartC = Math.floor(c / 3) * 3;

        for (let i = 0; i < 9; i++) {
            if (newNotes[`${r}-${i}`]) {
                newNotes[`${r}-${i}`] = newNotes[`${r}-${i}`].filter(n => n !== num);
                if (newNotes[`${r}-${i}`].length === 0) delete newNotes[`${r}-${i}`];
            }
            if (newNotes[`${i}-${c}`]) {
                newNotes[`${i}-${c}`] = newNotes[`${i}-${c}`].filter(n => n !== num);
                if (newNotes[`${i}-${c}`].length === 0) delete newNotes[`${i}-${c}`];
            }
        }
        for (let br = 0; br < 3; br++) {
            for (let bc = 0; bc < 3; bc++) {
                const checkR = blockStartR + br;
                const checkC = blockStartC + bc;
                if (newNotes[`${checkR}-${checkC}`]) {
                    newNotes[`${checkR}-${checkC}`] = newNotes[`${checkR}-${checkC}`].filter(n => n !== num);
                    if (newNotes[`${checkR}-${checkC}`].length === 0) delete newNotes[`${checkR}-${checkC}`];
                }
            }
        }

        delete newNotes[`${r}-${c}`];
        setNotes(newNotes);
        syncGameState(newGrid, newNotes);
        
        await checkWin(newGrid);
    };

    const checkConflict = (r: number, c: number, num: number) => {
        for (let x = 0; x < 9; x++) {
            if (userGrid[r][x] === num || userGrid[x][c] === num) return true;
        }
        const startRow = r - r % 3;
        const startCol = c - c % 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (userGrid[startRow + i][startCol + j] === num) return true;
            }
        }
        return false;
    };

    const checkWin = async (currentGrid: number[][]) => {
        syncGameState(currentGrid);
        for(let r=0; r<9; r++) {
            for(let c=0; c<9; c++) {
                if(currentGrid[r][c] !== puzzle!.solution[r][c]) return;
            }
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        DeviceEventEmitter.emit('stop-timer');
        setGameState('won');
        setEarnedXp(100);
        setTimeout(() => setIsFreshGameOver(true), 1000);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from('game_results').insert({
            time_taken_seconds: 300,
            user_id: user.id,
            game_type: `sudoku_${difficulty}`,
            score: 100, // Easy default
            won: true,
            metadata: { difficulty }
        });

        await supabase.rpc('increment_xp', { user_id_param: user.id, xp_amount: 100, p_locale: 'is' });
        await supabase.rpc('process_daily_streak', { user_id_param: user.id });
    };

    const syncGameState = async (currentGrid: number[][], currentNotes: Record<string, number[]> = notes) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !puzzle) return;
        supabase.from('game_states').upsert({
            user_id: user.id,
            game_type: `sudoku_${difficulty}`,
            state_json: { currentGrid, notes: currentNotes },
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, game_type' }).then();
    };

    const isHighlighted = (r: number, c: number) => {
        if (selectedRow === null || selectedCol === null) return false;
        if (r === selectedRow && c === selectedCol) return false; // Handled separately
        if (r === selectedRow || c === selectedCol) return true;
        const startR = selectedRow - selectedRow % 3;
        const startC = selectedCol - selectedCol % 3;
        if (r >= startR && r < startR + 3 && c >= startC && c < startC + 3) return true;
        return false;
    };

    const isSameNumber = (val: number) => {
        if (val === 0) return false;
        if (selectedRow !== null && selectedCol !== null) {
            const selVal = userGrid[selectedRow]?.[selectedCol];
            if (selVal !== 0 && selVal === val) return true;
        }
        return false;
    };

    if (gameState === 'loading' || !puzzle || userGrid.length === 0) {
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
                    <Text className="text-gray-500 font-medium text-center mb-6 leading-6">Þessi erfiðleikastig krefst Dulur+ áskriftar eða netþjónn niðri.</Text>
                    <TouchableOpacity onPress={() => router.back()} className="bg-[#1A1A1B] w-full py-4 rounded-full shadow-md items-center">
                        <Text className="text-white font-bold text-lg">Til baka í Leiki</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const BOARD_SIZE = width - 36;
    const CELL_SIZE = BOARD_SIZE / 9;

    return (
        <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />
            <MobileGameLayout onBack={() => router.back()} gameId={`sudoku_${difficulty}`} gameTitle="Sudoku">
                <View className="flex-1 w-full">
                
                <View className="items-center justify-center w-full px-4 pt-2 -mb-2 self-center z-10">
                <View className="flex-row items-center gap-1 bg-[#F0F0F0] rounded-full p-1 border border-[#D3D6DA] mb-4">
                    {[{id: 'easy', lbl: 'Létt'}, {id: 'medium', lbl: 'Miðlungs'}, {id: 'hard', lbl: 'Erfitt'}].map(mode => (
                        <TouchableOpacity 
                            key={mode.id} 
                            onPress={() => handleLevelChange(mode.id)} 
                            className={`px-4 py-2.5 rounded-full flex-row items-center justify-center min-w-[90px] gap-1 ${difficulty === mode.id ? 'bg-white shadow-sm' : ''}`}
                            activeOpacity={0.7}
                        >
                            <Text className={`font-bold text-sm ${difficulty === mode.id ? 'text-[#1A1A1B]' : 'text-gray-500'}`}>{mode.lbl}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <View className="flex-row items-center justify-between w-full max-w-[400px] px-2 mb-4">
                    <TouchableOpacity onPress={handleHint} className="flex-row items-center justify-center gap-2 px-6 py-2 bg-white rounded-full border border-gray-300 shadow-sm opacity-90">
                        <Ionicons name="bulb" size={20} color="#EAB308" />
                        <Text className="font-bold text-xs text-gray-600 tracking-widest">-20 XP</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity onPress={() => {
                        Haptics.impactAsync();
                        setIsNotesMode(!isNotesMode);
                    }} className={`flex-row items-center justify-center gap-2 px-6 py-2 rounded-full border shadow-sm ${isNotesMode ? 'bg-[#3B82F6] border-[#3B82F6]' : 'bg-white border-gray-300'}`}>
                        <Ionicons name="pencil" size={20} color={isNotesMode ? 'white' : '#1A1A1B'} />
                        <Text className={`font-bold text-xs uppercase tracking-widest ${isNotesMode ? 'text-white' : 'text-[#1A1A1B]'}`}>{isNotesMode ? 'Skrifa' : 'Krot'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <NativeGameEndModal
                gameTitle="Sudoku"
                visible={gameState === 'won' && isFreshGameOver}
                gameState="won"
                xpEarned={earnedXp}
                winTitle="Vel gert!"
                winDesc="Þú leystir Sudoku þrautina."
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

            {!isFreshGameOver && gameState === 'won' && (
                <View className="bg-emerald-600 mb-6 mx-6 rounded-2xl py-3 justify-center items-center shadow-lg shadow-emerald-600/30">
                    <Text className="text-white font-black uppercase tracking-widest text-lg">Þraut Leyst!</Text>
                </View>
            )}

            <Animated.View style={[shakeStyle, { width: BOARD_SIZE, height: BOARD_SIZE, alignSelf: 'center', backgroundColor: '#FAFAFA', borderWidth: 2, borderColor: '#1A1A1B', borderRadius: 8, overflow: 'hidden' }]}>
                {userGrid.map((row, rIdx) => (
                    <View key={rIdx} className="flex-row">
                        {row.map((cell, cIdx) => {
                            const isInitial = puzzle.initial[rIdx][cIdx] !== 0;
                            const isSelected = selectedRow === rIdx && selectedCol === cIdx;
                            const lit = isHighlighted(rIdx, cIdx);
                            const sameNum = isSameNumber(cell);
                            const cellNotes = notes[`${rIdx}-${cIdx}`] || [];
                            const activeVal = selectedRow !== null && selectedCol !== null ? userGrid[selectedRow][selectedCol] : 0;

                            let bgColor = 'transparent';
                            if (isSelected) bgColor = 'rgba(59, 130, 246, 0.4)'; // blue-500
                            else if (sameNum) bgColor = 'rgba(59, 130, 246, 0.25)';
                            else if (lit) bgColor = 'rgba(0, 0, 0, 0.05)';

                            let textColor = isInitial ? '#1A1A1B' : '#3B82F6'; // Initial Black, User Blue
                            if (cell === 0) textColor = 'transparent';

                            return (
                                <TouchableOpacity
                                    key={cIdx}
                                    activeOpacity={1}
                                    onPress={() => handleCellTap(rIdx, cIdx)}
                                    style={{
                                        width: CELL_SIZE,
                                        height: CELL_SIZE,
                                        backgroundColor: bgColor,
                                        borderWidth: 0.5,
                                        borderColor: '#D3D6DA',
                                        borderBottomWidth: rIdx % 3 === 2 && rIdx !== 8 ? 2 : 0.5,
                                        borderRightWidth: cIdx % 3 === 2 && cIdx !== 8 ? 2 : 0.5,
                                        borderBottomColor: rIdx % 3 === 2 ? '#1A1A1B' : '#D3D6DA',
                                        borderRightColor: cIdx % 3 === 2 ? '#1A1A1B' : '#D3D6DA',
                                        justifyContent: 'center',
                                        alignItems: 'center'
                                    }}
                                >
                                    {cell !== 0 ? (
                                        <Text style={{ color: textColor, fontWeight: isInitial ? '900' : '600', fontSize: 22, fontFamily: 'serif' }}>
                                            {cell}
                                        </Text>
                                    ) : cellNotes.length > 0 ? (
                                        <View className="absolute inset-0 flex-row flex-wrap items-center justify-center p-0.5">
                                            {[1,2,3,4,5,6,7,8,9].map(n => {
                                                const isNoteHighlighted = activeVal === n && cellNotes.includes(n);
                                                return (
                                                    <View key={n} style={{ width: '33.33%', height: '33.33%', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Text style={{ fontSize: isNoteHighlighted ? 12 : 9, color: isNoteHighlighted ? '#3B82F6' : '#6B7280', fontWeight: 'bold' }}>
                                                            {cellNotes.includes(n) ? n : ''}
                                                        </Text>
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    ) : null}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}
            </Animated.View>

            <View className="flex-1 justify-end mt-6 pb-12 px-6">
                <View className="flex-row justify-between mb-4 mt-2">
                    {[1,2,3,4,5].map(num => {
                        const isCompleted = isNumberCompleted(num);
                        return (
                        <TouchableOpacity 
                            key={num}
                            activeOpacity={0.7}
                            disabled={isCompleted}
                            onPress={() => handleNumPad(num)}
                            style={{ width: (width - 64) / 5.5, height: 60, backgroundColor: '#E5E7EB', opacity: isCompleted ? 0.3 : 1, justifyContent: 'center', alignItems: 'center', borderRadius: 12 }}
                        >
                            <Text style={{ color: '#1A1A1B', fontSize: 24, fontWeight: 'bold' }}>{num}</Text>
                        </TouchableOpacity>
                        );
                    })}
                </View>
                <View className="flex-row justify-between">
                    {[6,7,8,9].map(num => {
                        const isCompleted = isNumberCompleted(num);
                        return (
                        <TouchableOpacity 
                            key={num}
                            activeOpacity={0.7}
                            disabled={isCompleted}
                            onPress={() => handleNumPad(num)}
                            style={{ width: (width - 64) / 5.5, height: 60, backgroundColor: '#E5E7EB', opacity: isCompleted ? 0.3 : 1, justifyContent: 'center', alignItems: 'center', borderRadius: 12 }}
                        >
                            <Text style={{ color: '#1A1A1B', fontSize: 24, fontWeight: 'bold' }}>{num}</Text>
                        </TouchableOpacity>
                        );
                    })}
                    <TouchableOpacity 
                        activeOpacity={0.7}
                        onPress={handleClear}
                        style={{ width: (width - 64) / 5.5, height: 60, backgroundColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center', borderRadius: 12 }}
                    >
                        <Ionicons name="backspace-outline" size={28} color="#1A1A1B" />
                    </TouchableOpacity>
                </View>
            </View>
            </View>
            </MobileGameLayout>
        </SafeAreaView>
    );
}
