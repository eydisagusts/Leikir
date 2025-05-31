'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import WordleGrid from '@/components/games/wordle/WordleGrid';
import WordleKeyboard from '@/components/games/wordle/WordleKeyboard';
import GameResultModal from '@/components/games/wordle/GameResultModal';
import { startNewGame, getGameState, makeGuess } from '@/services/wordle';
import type { WordleGameState, Row } from '@/types/wordle';
import { LetterState } from '@/types/wordle';
import { useRouter } from 'next/navigation';
import WordleInstructions from '@/components/games/wordle/WordleInstructions';
import WordleError from '@/components/games/wordle/WordleError';
import NewGameConfirmationModal from '@/components/games/wordle/NewGameConfirmationModal';

const WORD_LENGTH = 5;
const MAX_ATTEMPTS = 6;

// Map of base letters to their accented versions
const ACCENT_MAP: Record<string, string> = {
    'a': 'á',
    'e': 'é',
    'i': 'í',
    'o': 'ó',
    'u': 'ú',
    'y': 'ý',
};

export default function WordleGame() {
    const { user, loading: authLoading, refreshUserData } = useAuth();
    const router = useRouter();
    const [gameState, setGameState] = useState<WordleGameState | null>(null);
    const [rows, setRows] = useState<Row[]>([]);
    const [currentRowIndex, setCurrentRowIndex] = useState(0);
    const [currentColIndex, setCurrentColIndex] = useState(0);
    const [letterStates, setLetterStates] = useState<Record<string, LetterState>>({});
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showResultModal, setShowResultModal] = useState(false);
    const [lastScore, setLastScore] = useState<number | undefined>();
    const [revealedRows, setRevealedRows] = useState<number[]>([]);
    const [isRevealing, setIsRevealing] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);
    const [waitingForAccent, setWaitingForAccent] = useState(false);
    const [hasInitialized, setHasInitialized] = useState(false);
    const [showNewGameConfirmation, setShowNewGameConfirmation] = useState(false);

    // Handle keyboard input
    const handleKeyPress = useCallback(async (key: string) => {
        if (!user || !gameState || isLoading || gameState.isGameOver || isRevealing) return;

        if (key === 'Enter') {
            if (currentColIndex !== WORD_LENGTH) {
                setError('Orðið verður að vera 5 stafir');
                return;
            }

            setIsLoading(true);
            setIsRevealing(true);
            try {
                const guess = rows[currentRowIndex].letters.join('');
                const response = await makeGuess(user.id, guess, parseInt(gameState.gameId));

                // Update rows with letter states
                const newRows = [...rows];
                newRows[currentRowIndex] = {
                    letters: guess.split(''),
                    states: response.letterStates
                };
                setRows(newRows);

                // Add current row to revealed rows
                setRevealedRows(prev => [...prev, currentRowIndex]);

                // Wait for all letters to be revealed before updating keyboard
                setTimeout(() => {
                    // Update letter states for keyboard
                    const newLetterStates = { ...letterStates };
                    response.letterStates.forEach((state: LetterState, i: number) => {
                        const letter = guess[i].toLowerCase();
                        // Only update if the new state is better (Correct > Present > Absent)
                        if (!newLetterStates[letter] || 
                            (state === LetterState.Correct) || 
                            (state === LetterState.Present && newLetterStates[letter] === LetterState.Absent)) {
                            newLetterStates[letter] = state;
                        }
                    });
                    setLetterStates(newLetterStates);
                    setIsRevealing(false);

                    if (response.isCorrect) {
                        setLastScore(response.score);
                        // Refresh user data to get updated statistics
                        refreshUserData();
                        const newGameState = {
                            gameId: gameState.gameId,
                            isGameOver: true,
                            isWon: true,
                            score: response.score,
                            targetWord: response.targetWord
                        };
                        setGameState(newGameState);
                        setShowResultModal(true);
                        return; // Prevent any further state updates
                    } else if (response.isGameOver) {
                        // Refresh user data to get updated statistics
                        refreshUserData();
                        const newGameState = {
                            gameId: gameState.gameId,
                            isGameOver: true,
                            isWon: false,
                            score: response.score,
                            targetWord: response.targetWord
                        };
                        setGameState(newGameState);
                        setShowResultModal(true);
                        return; // Prevent any further state updates
                    } else {
                        setCurrentRowIndex(prev => prev + 1);
                        setCurrentColIndex(0);
                    }
                }, WORD_LENGTH * 400); // Wait for all letters to be revealed

            } catch (err) {
                setError('Ógilt orð');
                setIsRevealing(false);
            } finally {
                setIsLoading(false);
            }
        } else if (key === '⌫') {
            if (currentColIndex > 0) {
                const newRows = [...rows];
                newRows[currentRowIndex].letters[currentColIndex - 1] = '';
                setRows(newRows);
                setCurrentColIndex(prev => prev - 1);
            }
        } else if (currentColIndex < WORD_LENGTH) {
            // Check if the letter is valid (Icelandic alphabet)
            if (!/^[a-záæðéíóúýþö]$/i.test(key)) {
                setError('Einungis íslenskir stafir eru leyfðir');
                return;
            }

            const newRows = [...rows];
            if (!newRows[currentRowIndex]) {
                newRows[currentRowIndex] = {
                    letters: Array(WORD_LENGTH).fill(''),
                    states: Array(WORD_LENGTH).fill(null)
                };
            }
            newRows[currentRowIndex].letters[currentColIndex] = key;
            setRows(newRows);
            setCurrentColIndex(prev => prev + 1);
        }
    }, [user, gameState, isLoading, currentRowIndex, currentColIndex, rows, letterStates, isRevealing, refreshUserData]);

    // Add new game handler
    const handleNewGame = useCallback(async () => {
        if (!user || isLoading) return;
        
        setIsLoading(true);
        try {
            const response = await startNewGame(user.id);
            setGameState({
                gameId: response.gameId,
                isGameOver: false,
                isWon: false,
                score: 0,
                targetWord: response.targetWord
            });
            setCurrentRowIndex(0);
            setCurrentColIndex(0);
            setRows(Array(MAX_ATTEMPTS).fill(null).map(() => ({
                letters: Array(WORD_LENGTH).fill(''),
                states: Array(WORD_LENGTH).fill(null)
            })));
            setRevealedRows([]);
            setLetterStates({});
            setError(null);
            setShowResultModal(false);
        } catch (err) {
            setError('Villa kom upp við að byrja nýtt leik. Vinsamlegast reyndu aftur.');
        } finally {
            setIsLoading(false);
        }
    }, [user, isLoading]);

    // Handle auth state
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/innskraning');
        }
    }, [authLoading, user, router]);

    // Initialize game only once when component mounts
    useEffect(() => {
        if (!user || hasInitialized) return;
        const initGame = async () => {
            try {
                setIsLoading(true);
                const response = await startNewGame(user.id);
                setGameState({
                    gameId: response.gameId,
                    isGameOver: false,
                    isWon: false,
                    score: 0,
                    targetWord: response.targetWord
                });
                setRows(Array(MAX_ATTEMPTS).fill(null).map(() => ({
                    letters: Array(WORD_LENGTH).fill(''),
                    states: Array(WORD_LENGTH).fill(null)
                })));
                setCurrentRowIndex(0);
                setCurrentColIndex(0);
                setLetterStates({});
                setRevealedRows([]);
                setHasInitialized(true);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Villa kom upp við að byrja leik');
            } finally {
                setIsLoading(false);
            }
        };
        initGame();
    }, [user, hasInitialized]);

    // Handle physical keyboard
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.metaKey || event.ctrlKey || isLoading || gameState?.isGameOver) return;

            const key = event.key.toLowerCase();

            // Handle accent key (checking multiple possible key values)
            if (key === '´' || key === '`' || key === "'" || event.code === 'Backquote' || event.code === 'Quote') {
                event.preventDefault(); // Prevent default behavior
                setWaitingForAccent(true);
                return;
            }

            // If waiting for accent and a valid letter is pressed
            if (waitingForAccent) {
                if (ACCENT_MAP[key]) {
                    event.preventDefault(); // Prevent default behavior
                    handleKeyPress(ACCENT_MAP[key]);
                    setWaitingForAccent(false);
                    return;
                } else {
                    // If not a valid letter for accent, reset and handle as normal
                    setWaitingForAccent(false);
                }
            }

            // Handle regular keys
            if (key === 'enter') {
                handleKeyPress('Enter');
            } else if (key === 'backspace') {
                handleKeyPress('⌫');
            } else if (/^[a-záæðéíóúýþö]$/.test(key)) {
                handleKeyPress(key);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyPress, isLoading, gameState, waitingForAccent]);

    if (authLoading) {
        return <div className="flex items-center justify-center min-h-screen">Hleð...</div>;
    }

    if (!user) {
        return null; // Will redirect in the useEffect
    }

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <div className="h-16" />

            <button
                className="absolute left-4 top-20 text-lg px-4 py-2 rounded-lg bg-gray-500 hover:bg-gray-600 transition-colors duration-200 cursor-pointer"
                onClick={() => router.push('/')}
            >
                Heim
            </button>

            <main className="flex-1 flex flex-col items-center px-4 max-w-4xl mx-auto w-full">
                {isLoading && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
                        <div className="text-lg">Hleð...</div>
                    </div>
                )}

                <div className="w-full max-w-lg mx-auto relative">
                    <div className="absolute -left-24 top-1/4 -translate-y-1/2 flex flex-col gap-3">
                        <button
                            className="text-sm px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors duration-200 cursor-pointer text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            onClick={() => setShowInstructions(true)}
                        >
                            Leikreglur
                        </button>
                        <button
                            className="text-sm px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors duration-200 cursor-pointer text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => setShowNewGameConfirmation(true)}
                            disabled={isLoading}
                        >
                            Nýr Leikur
                        </button>
                    </div>

                    <h1 className="font-serif text-4xl text-center mb-6 text-gray-900">
                        Orðla
                    </h1>

                    <div className="w-full relative">
                        {error && (
                            <WordleError
                                message={error}
                                onClose={() => setError(null)}
                            />
                        )}
                        <WordleGrid
                            rows={rows}
                            currentRowIndex={currentRowIndex}
                            currentColIndex={currentColIndex}
                            maxAttempts={MAX_ATTEMPTS}
                            wordLength={WORD_LENGTH}
                            isGameOver={gameState?.isGameOver || false}
                            isWon={gameState?.isWon || false}
                            revealedRows={revealedRows}
                        />
                    </div>
                </div>

                <div className="w-full max-w-2xl mx-auto mt-auto mb-8">
                    <WordleKeyboard
                        onKeyPress={handleKeyPress}
                        letterStates={letterStates}
                        disabled={isLoading || gameState?.isGameOver || isRevealing}
                    />
                </div>
            </main>

            <GameResultModal
                isOpen={showResultModal}
                onClose={() => setShowResultModal(false)}
                onNewGame={handleNewGame}
                isWon={gameState?.isWon || false}
                score={lastScore}
                targetWord={gameState?.targetWord}
            />

            <WordleInstructions
                isOpen={showInstructions}
                onClose={() => setShowInstructions(false)}
            />

            <NewGameConfirmationModal
                isOpen={showNewGameConfirmation}
                onClose={() => setShowNewGameConfirmation(false)}
                onConfirm={() => {
                    setShowNewGameConfirmation(false);
                    handleNewGame();
                }}
            />
        </div>
    );
}