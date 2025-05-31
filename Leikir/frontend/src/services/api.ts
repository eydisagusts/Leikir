import { useAuth } from '@/contexts/AuthContext';

export const API_BASE_URL = 'http://localhost:5010/api';

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const token = localStorage.getItem('token');
    
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        if (response.status === 401) {
            // Clear token if unauthorized
            localStorage.removeItem('token');
        }
        const error = await response.text();
        throw new Error(error || 'Request failed');
    }

    return response.json();
}

export async function getUserProfile(userId: number) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('Error fetching user profile:', error);
        throw new Error(error || 'Failed to fetch user profile');
    }

    const data = await response.json();
    
    // Map the backend response to match our frontend User type
    const mappedData = {
        id: data.userId,
        name: data.name,
        username: data.username,
        email: data.email,
        totalScore: data.totalScore || 0,
        totalGames: data.totalGames || 0,
        totalWins: data.totalWins || 0,
        totalLosses: data.totalLosses || 0
    };
    return mappedData;
} 