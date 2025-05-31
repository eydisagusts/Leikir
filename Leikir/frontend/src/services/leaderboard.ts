import { API_BASE_URL } from './api';
import type { User } from '@/types/auth';

export async function getLeaderboard(): Promise<User[]> {
    const response = await fetch(`${API_BASE_URL}/users/leaderboard`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch leaderboard');
    }

    const data = await response.json();
    return data.map((user: any) => ({
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        totalScore: user.totalScore,
        totalGames: user.totalGames,
        totalWins: user.totalWins,
        totalLosses: user.totalLosses
    }));
} 