import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, ScrollView, TextInput, DeviceEventEmitter, Share, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { MobileGameLayout } from '@/components/MobileGameLayout';
import { NativeGameEndModal } from '@/components/NativeGameEndModal';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';
const { width } = Dimensions.get('window');

type ClueDirection = 'across' | 'down';

type CrosswordClue = {
    num: number;
    question: string;
    answer: string;
    row: number;
    col: number;
};

type CrosswordPuzzle = {
    id: number;
    rows: number;
    cols: number;
    across: CrosswordClue[];
    down: CrosswordClue[];
};

type CellData = {
    row: number;
    col: number;
    answerChar: string;
    userChar?: string;
    clueNum?: number;
    isPartOfAcrossBtn?: CrosswordClue;
    isPartOfDownBtn?: CrosswordClue;
};



export default function NativeKrossgata() {
    const [puzzle, setPuzzle] = useState<CrosswordPuzzle | null>(null);
    const [grid, setGrid] = useState<(CellData | null)[][]>([]);
    const [gameState, setGameState] = useState<'playing' | 'won' | 'loading'>('loading');
    
    // Focus State
    const [activeDirection, setActiveDirection] = useState<ClueDirection>('across');
    const [activeRow, setActiveRow] = useState(0);
    const [activeCol, setActiveCol] = useState(0);

    const scrollViewRef = useRef<ScrollView>(null);
    const hiddenInputRef = useRef<TextInput>(null);

    // End Game tracking parity
    const [earnedXp, setEarnedXp] = useState<number | null>(null);
    const [showFlyXp, setShowFlyXp] = useState(false);
    const [isFreshGameOver, setIsFreshGameOver] = useState(false);

    const xpAnimY = useSharedValue(500);
    const xpAnimOpacity = useSharedValue(0);

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
        const header = `Dulur: Krossgáta 📝`;
        const xpText = earnedXp ? `\n⭐ XP: +${earnedXp}` : '';
        const message = `${header}\n${xpText}\n\nÉg leysti krossgátu dagsins!\ndulur.is 🔥`;
        try {
            await Share.share({ message });
        } catch (error) {
            console.error('Error sharing', error);
        }
    };

    useEffect(() => {
        async function init() {
            try {
                const today = new Date().toISOString().split('T')[0];

                const sessionPromise = supabase.auth.getSession();
                const apiPromise = fetch(`${API_URL}/api/mobile/krossgata/init`).then(res => res.json());

                const [{ data: { session } }, data] = await Promise.all([sessionPromise, apiPromise]);
                const user = session?.user;

                const dbPromises = user ? Promise.all([
                    supabase.from('game_results').select('won').eq('user_id', user.id).eq('game_type', 'krossgata').gte('played_at', `${today}T00:00:00Z`).order('played_at', { ascending: false }).limit(1).maybeSingle(),
                    supabase.from('game_states').select('state_json, updated_at').eq('user_id', user.id).eq('game_type', `krossgata_${data.id}`).maybeSingle()
                ]) : Promise.resolve([{ data: null }, { data: null }]);

                const [resDataRes, stateDataRes] = await dbPromises;
                
                // Build Matrix
                const matrix: (CellData | null)[][] = Array(data.rows).fill(null).map(() => Array(data.cols).fill(null));

                const assignClues = (clues: CrosswordClue[], dir: ClueDirection) => {
                    clues.forEach(clue => {
                        let r = clue.row;
                        let c = clue.col;
                        
                        // Set number indicator at the start
                        if (!matrix[r][c]) {
                            matrix[r][c] = { row: r, col: c, answerChar: clue.answer[0], clueNum: clue.num };
                        } else {
                            matrix[r][c]!.clueNum = clue.num;
                        }

                        // Lay down letters
                        for (let i = 0; i < clue.answer.length; i++) {
                            const curR = dir === 'across' ? r : r + i;
                            const curC = dir === 'across' ? c + i : c;
                            
                            if (!matrix[curR][curC]) {
                                matrix[curR][curC] = { row: curR, col: curC, answerChar: clue.answer[i] };
                            }
                            if (dir === 'across') matrix[curR][curC]!.isPartOfAcrossBtn = clue;
                            if (dir === 'down') matrix[curR][curC]!.isPartOfDownBtn = clue;
                        }
                    });
                };

                assignClues(data.across, 'across');
                assignClues(data.down, 'down');

                setPuzzle(data);
                
                if (!user) {
                    setGrid(matrix);
                    setGameState('playing');
                    findFirstValidCell(matrix, data);
                    return; 
                }

                const resData = resDataRes.data;
                const stateData = stateDataRes.data;

                if (resData) {
                    setGameState('won');
                    // Fill all answers
                    for(let r=0; r<data.rows; r++){
                        for(let c=0; c<data.cols; c++){
                            if(matrix[r][c]) matrix[r][c]!.userChar = matrix[r][c]!.answerChar;
                        }
                    }
                    setGrid(matrix);
                } else {
                    let hasExistingGuesses = false;
                    if (stateData && stateData.state_json.userGrid) {
                        for(let r=0; r<data.rows; r++){
                            for(let c=0; c<data.cols; c++){
                                if(matrix[r][c] && stateData.state_json.userGrid[`${r},${c}`]) {
                                    matrix[r][c]!.userChar = stateData.state_json.userGrid[`${r},${c}`];
                                    hasExistingGuesses = true;
                                }
                            }
                        }
                    }
                    setGrid([...matrix]);
                    setGameState('playing');
                    findFirstValidCell(matrix, data);
                    if (hasExistingGuesses) {
                        setTimeout(() => DeviceEventEmitter.emit('start-timer'), 500);
                    }
                }
            } catch (err) {
                setGameState('playing');
            }
        }
        init();
    }, []);

    const findFirstValidCell = (matrix: (CellData|null)[][], puz: CrosswordPuzzle) => {
        if (puz.across.length > 0) {
            setActiveRow(puz.across[0].row);
            setActiveCol(puz.across[0].col);
            setActiveDirection('across');
        } else if (puz.down.length > 0) {
            setActiveRow(puz.down[0].row);
            setActiveCol(puz.down[0].col);
            setActiveDirection('down');
        }
    };

    const handleCellTap = (r: number, c: number) => {
        if (gameState !== 'playing') return;
        const cell = grid[r][c];
        if (!cell) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (activeRow === r && activeCol === c) {
            // Swap direction if cell supports both
            if (activeDirection === 'across' && cell.isPartOfDownBtn) setActiveDirection('down');
            else if (activeDirection === 'down' && cell.isPartOfAcrossBtn) setActiveDirection('across');
        } else {
            setActiveRow(r);
            setActiveCol(c);
            
            // Prefer current direction if cell supports it, else switch
            if (activeDirection === 'across' && !cell.isPartOfAcrossBtn && cell.isPartOfDownBtn) {
                setActiveDirection('down');
            } else if (activeDirection === 'down' && !cell.isPartOfDownBtn && cell.isPartOfAcrossBtn) {
                setActiveDirection('across');
            }
        }
        
        // Summon native keyboard
        setTimeout(() => {
            hiddenInputRef.current?.focus();
        }, 50);
    };

    const isClueSolved = (clue: CrosswordClue) => {
        if (!clue || !grid.length) return false;
        const isAcross = puzzle?.across.includes(clue);
        for (let i = 0; i < clue.answer.length; i++) {
            const r = isAcross ? clue.row : clue.row + i;
            const c = isAcross ? clue.col + i : clue.col;
            if (grid[r]?.[c]?.userChar !== clue.answer[i]) return false;
        }
        return true;
    };

    const isCellInSolvedClue = (r: number, c: number) => {
        const cell = grid[r]?.[c];
        if (!cell) return false;
        if (cell.isPartOfAcrossBtn && isClueSolved(cell.isPartOfAcrossBtn)) return true;
        if (cell.isPartOfDownBtn && isClueSolved(cell.isPartOfDownBtn)) return true;
        return false;
    };

    const handleKeyPress = async (letter: string) => {
        if (gameState !== 'playing') return;
        if (isCellInSolvedClue(activeRow, activeCol)) return; // Locked!

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        DeviceEventEmitter.emit('start-timer');

        const newGrid = [...grid];
        newGrid[activeRow][activeCol] = { ...newGrid[activeRow][activeCol]!, userChar: letter };
        setGrid(newGrid);

        // Advance
        advanceCursor();
        await checkWin(newGrid);
    };

    const handleBackspace = () => {
        if (gameState !== 'playing') return;

        const cell = grid[activeRow][activeCol]!;

        if (cell.userChar && !isCellInSolvedClue(activeRow, activeCol)) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const newGrid = [...grid];
            newGrid[activeRow][activeCol] = { ...cell, userChar: undefined };
            setGrid(newGrid);
            syncGameState(newGrid);
        } else {
            retreatCursor(grid);
        }
    };

    const advanceCursor = () => {
        const cell = grid[activeRow][activeCol]!;
        const clue = activeDirection === 'across' ? cell.isPartOfAcrossBtn : cell.isPartOfDownBtn;
        if (!clue) return;

        let nr = activeRow;
        let nc = activeCol;

        if (activeDirection === 'across') nc++;
        else nr++;

        // Ensure within word bounds
        if (activeDirection === 'across' && nc < clue.col + clue.answer.length) {
            if (!isCellInSolvedClue(activeRow, nc)) setActiveCol(nc); // Skip natively locked
        } else if (activeDirection === 'down' && nr < clue.row + clue.answer.length) {
            if (!isCellInSolvedClue(nr, activeCol)) setActiveRow(nr);
        }
    };

    const retreatCursor = (currentGrid: (CellData|null)[][]) => {
        const cell = currentGrid[activeRow][activeCol]!;
        const clue = activeDirection === 'across' ? cell.isPartOfAcrossBtn : cell.isPartOfDownBtn;
        if (!clue) return;

        let nr = activeRow;
        let nc = activeCol;

        if (activeDirection === 'across' && nc > clue.col) {
            nc--;
            setActiveCol(nc);
        } else if (activeDirection === 'down' && nr > clue.row) {
            nr--;
            setActiveRow(nr);
        }

        const prevCell = currentGrid[nr][nc]!;
        if (!isCellInSolvedClue(nr, nc)) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            currentGrid[nr][nc] = { ...prevCell, userChar: undefined };
            setGrid([...currentGrid]);
            syncGameState(currentGrid);
        }
    };

    const checkWin = async (currentGrid: (CellData|null)[][]) => {
        syncGameState(currentGrid);

        for (let r = 0; r < puzzle!.rows; r++) {
            for (let c = 0; c < puzzle!.cols; c++) {
                const cell = currentGrid[r][c];
                if (cell && cell.userChar !== cell.answerChar) return;
            }
        }

        setGameState('won');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        setEarnedXp(100);
        setTimeout(() => setIsFreshGameOver(true), 1000);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from('game_results').insert({
            time_taken_seconds: 120, // stub
            user_id: user.id,
            game_type: 'krossgata',
            score: 100,
            won: true,
            metadata: { difficulty: 'large' }
        });

        await supabase.rpc('increment_xp', { user_id_param: user.id, xp_amount: 300, p_locale: 'is' });
        await supabase.rpc('process_daily_streak', { user_id_param: user.id });
    };

    const syncGameState = async (currentGrid: (CellData|null)[][]) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !puzzle) return;

        const compactGrid: Record<string, string> = {};
        for(let r=0; r<puzzle.rows; r++){
            for(let c=0; c<puzzle.cols; c++){
                if(currentGrid[r][c]?.userChar) compactGrid[`${r},${c}`] = currentGrid[r][c]!.userChar!;
            }
        }

        supabase.from('game_states').upsert({
            user_id: user.id,
            game_type: `krossgata_${puzzle.id}`,
            state_json: { userGrid: compactGrid },
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, game_type' }).then();
    };

    const isCellHighlighted = (r: number, c: number) => {
        if (!puzzle || !grid[r][c]) return false;
        const cell = grid[activeRow][activeCol];
        if (!cell) return false;

        if (activeDirection === 'across' && cell.isPartOfAcrossBtn) {
            const clue = cell.isPartOfAcrossBtn;
            return r === clue.row && c >= clue.col && c < clue.col + clue.answer.length;
        } else if (activeDirection === 'down' && cell.isPartOfDownBtn) {
            const clue = cell.isPartOfDownBtn;
            return c === clue.col && r >= clue.row && r < clue.row + clue.answer.length;
        }
        return false;
    };

    // Current Clue string
    const activeClueInfo = useMemo(() => {
        if (!grid.length || !puzzle) return null;
        const cell = grid[activeRow]?.[activeCol];
        if (!cell) return null;

        const clue = activeDirection === 'across' ? cell.isPartOfAcrossBtn : cell.isPartOfDownBtn;
        return clue;
    }, [grid, activeRow, activeCol, activeDirection, puzzle]);


    if (gameState === 'loading') {
        return (
            <SafeAreaView className="flex-1 bg-[#FAFAFA] items-center justify-center">
                <ActivityIndicator size="large" color="#1A1A1B" />
            </SafeAreaView>
        );
    }

    // Optimize Cell Size to fit the grid perfectly horizontally without clipping off the edge unless it's intensely enormous.
    const CELL_SIZE = Math.min((width - 16) / puzzle!.cols, 42);

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top', 'bottom']}>
                <Stack.Screen options={{ headerShown: false }} />
                <MobileGameLayout 
                gameId="krossgata"
                gameTitle="Krossgáta"
                isGameOver={gameState !== 'playing'}
                scrollEnabled={true}
                onBack={() => router.back()}
            >

                <NativeGameEndModal
                gameTitle="Krossgátu"
                    visible={gameState === 'won' && isFreshGameOver}
                    gameState="won"
                    xpEarned={earnedXp}
                    winTitle="Vel gert!"
                    winDesc="Krossgáta leyst."
                    onContinue={handleCloseModal}
                    primaryButtonText="Deila niðurstöðu"
                    onPrimaryAction={handleShare}
                />

                {/* Clue Banner */}
                {gameState === 'playing' ? (
                    <View className="bg-blue-50 w-full px-4 py-3 border-2 border-blue-200 rounded-xl mb-4 min-h-[60px] justify-center items-center shadow-sm">
                        {activeClueInfo ? (
                            <>
                                <Text className="font-bold text-[10px] text-blue-900/60 mb-0.5 tracking-wider uppercase">
                                    {activeDirection === 'across' ? 'Lárétt' : 'Lóðrétt'} {activeClueInfo.num}
                                </Text>
                                <Text className="font-medium text-blue-900 text-sm md:text-base leading-5 text-center">
                                    {activeClueInfo.question}
                                </Text>
                            </>
                        ) : (
                            <Text className="text-gray-400 italic text-sm md:text-base leading-5 text-center">
                                Veldu reit til að byrja
                            </Text>
                        )}
                    </View>
                ) : (
                    <View className="bg-emerald-500 w-full px-4 py-4 rounded-xl mb-4 min-h-[60px] justify-center items-center shadow-md">
                        <Text className="text-white font-black text-center text-lg uppercase tracking-widest">Krossgáta Leyst! 🎉</Text>
                    </View>
                )}

                {/* Panning Box-Bound Grid */}
                <View style={{ flex: 1, width: '100%' }}>
                    <ScrollView 
                        contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-start', alignItems: 'center', paddingBottom: 350, paddingTop: 8 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        bounces={false}
                    >
                        <ScrollView 
                            horizontal
                            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'flex-start' }}
                            showsHorizontalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            bounces={false}
                        >
                <View 
                    style={{ 
                        width: puzzle!.cols * CELL_SIZE, 
                        height: puzzle!.rows * CELL_SIZE, 
                        backgroundColor: '#000' 
                    }}
                >
                    {grid.map((row, rIdx) => (
                        <View key={rIdx} className="flex-row">
                            {row.map((cell, cIdx) => {
                                if (!cell) {
                                    // Blocked grid square
                                    return <View key={cIdx} style={{ width: CELL_SIZE, height: CELL_SIZE, backgroundColor: '#000' }} />
                                }

                                const isActive = rIdx === activeRow && cIdx === activeCol;
                                const isHighlighted = isCellHighlighted(rIdx, cIdx);
                                let bgColor = '#ffffff';
                                if (isActive) bgColor = '#FCD34D'; // Yellow primary
                                else if (isHighlighted) bgColor = '#DBEAFE'; // Light blue secondary highlight

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
                                            borderColor: '#52525B', // zinc-600
                                            justifyContent: 'center',
                                            alignItems: 'center'
                                        }}
                                    >
                                        {cell.clueNum && (
                                            <Text className="absolute top-0.5 left-1 text-[8px] font-bold text-black">{cell.clueNum}</Text>
                                        )}
                                        <Text className={`font-black font-serif text-lg ${(cell.userChar === cell.answerChar && gameState==='won') || isCellInSolvedClue(rIdx, cIdx) ? 'text-green-600' : 'text-black'}`}>
                                            {cell.userChar || ''}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ))}
                </View>
                        </ScrollView>

                        {/* Clues List Companion */}
                        <View className="w-full px-4 pt-6 pb-20 max-w-[600px] self-center">
                            {/* Across List */}
                            <View className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden mb-6">
                                <View className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
                                    <Text className="font-black text-slate-800 uppercase tracking-widest text-xs">Lárétt</Text>
                                </View>
                                <View className="p-2">
                                    {puzzle?.across.map(clue => {
                                        const isSolved = isClueSolved(clue);
                                        const isActive = activeDirection === 'across' && grid[activeRow]?.[activeCol]?.isPartOfAcrossBtn === clue;
                                        return (
                                            <TouchableOpacity 
                                                key={`a-${clue.num}`}
                                                onPress={() => {
                                                    setActiveDirection('across');
                                                    setActiveRow(clue.row);
                                                    setActiveCol(clue.col);
                                                    setTimeout(() => hiddenInputRef.current?.focus(), 50);
                                                }}
                                                className={`flex-row px-3 py-2.5 rounded-lg mb-1 ${isActive ? 'bg-blue-50 border border-blue-200' : 'bg-transparent border border-transparent'}`}
                                            >
                                                <Text className={`font-black w-8 ${isSolved ? 'text-green-600' : 'text-slate-500'}`}>{clue.num}.</Text>
                                                <Text className={`flex-1 text-sm ${isSolved ? 'text-green-700 opacity-60 line-through' : 'text-slate-700'} ${isActive ? 'font-bold text-blue-900' : ''}`}>{clue.question}</Text>
                                            </TouchableOpacity>
                                        )
                                    })}
                                </View>
                            </View>

                            {/* Down List */}
                            <View className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
                                <View className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
                                    <Text className="font-black text-slate-800 uppercase tracking-widest text-xs">Lóðrétt</Text>
                                </View>
                                <View className="p-2">
                                    {puzzle?.down.map(clue => {
                                        const isSolved = isClueSolved(clue);
                                        const isActive = activeDirection === 'down' && grid[activeRow]?.[activeCol]?.isPartOfDownBtn === clue;
                                        return (
                                            <TouchableOpacity 
                                                key={`d-${clue.num}`}
                                                onPress={() => {
                                                    setActiveDirection('down');
                                                    setActiveRow(clue.row);
                                                    setActiveCol(clue.col);
                                                    setTimeout(() => hiddenInputRef.current?.focus(), 50);
                                                }}
                                                className={`flex-row px-3 py-2.5 rounded-lg mb-1 ${isActive ? 'bg-blue-50 border border-blue-200' : 'bg-transparent border border-transparent'}`}
                                            >
                                                <Text className={`font-black w-8 ${isSolved ? 'text-green-600' : 'text-slate-500'}`}>{clue.num}.</Text>
                                                <Text className={`flex-1 text-sm ${isSolved ? 'text-green-700 opacity-60 line-through' : 'text-slate-700'} ${isActive ? 'font-bold text-blue-900' : ''}`}>{clue.question}</Text>
                                            </TouchableOpacity>
                                        )
                                    })}
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                </View>

                {/* Hidden Input for Native Keyboard */}
                <TextInput
                    ref={hiddenInputRef}
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    spellCheck={false}
                    keyboardType="default"
                    value=""
                    onChangeText={(t) => {
                        if (t.length > 0) handleKeyPress(t[t.length - 1].toUpperCase());
                    }}
                    onKeyPress={(e) => {
                        if (e.nativeEvent.key === 'Backspace') handleBackspace();
                    }}
                />

                {showFlyXp && earnedXp !== null && earnedXp > 0 && (
                    <Animated.View style={[{ position: 'absolute', top: '40%', alignSelf: 'center', zIndex: 60, pointerEvents: 'none' }, flyStyle]}>
                        <View className="bg-[#EAB308] flex-row items-center gap-1.5 px-4 py-2 rounded-full shadow-lg border border-[#FDE047]">
                            <Ionicons name="star" size={16} color="white" />
                            <Text className="text-white font-black text-xl tracking-widest">+{earnedXp}</Text>
                        </View>
                    </Animated.View>
                )}
            </MobileGameLayout>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}
