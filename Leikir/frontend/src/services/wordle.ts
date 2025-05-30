import { API_BASE_URL } from './api';
import type { WordleGameState } from '@/types/wordle';

export async function startNewGame(userId: number) {
    const response = await fetch(`${API_BASE_URL}/wordle/start?userId=${userId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to start new game');
    }

    const data = await response.json();
    return {
        gameId: data.gameId,
        isGameOver: false,
        isWon: false,
        score: 0
    };
}

export async function getGameState(userId: number, gameId: number) {
    const response = await fetch(`${API_BASE_URL}/wordle/state?userId=${userId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to get game state');
    }

    const data = await response.json();
    return {
        gameId: data.gameId,
        isGameOver: data.isGameOver,
        isWon: data.isWon,
        score: data.score
    };
}

export async function makeGuess(userId: number, guess: string, gameId: number): Promise<WordleGuessResponse> {
    if (!userId) {
        throw new Error('User ID is required to make a guess');
    }

    const url = `${API_BASE_URL}/wordle/guess?userId=${userId}&gameId=${gameId}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(guess.toUpperCase()),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
    }

    const data = await response.json();
    return data;
}