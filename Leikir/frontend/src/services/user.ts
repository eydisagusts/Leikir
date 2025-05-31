import { API_BASE_URL } from './api';

export async function getUserProfile(userId: number) {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to fetch user profile');
    }

    const data = await response.json();
    return {
        id: data.userId,
        name: data.name,
        username: data.username,
        email: data.email,
        totalScore: data.totalScore,
        totalGames: data.totalGames,
        totalWins: data.totalWins,
        totalLosses: data.totalLosses
    };
}