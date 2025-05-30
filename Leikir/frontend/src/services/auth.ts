import { API_BASE_URL } from './api';
import type { User } from '@/types/auth';

export async function loginUser(credentials: { username: string; password: string }): Promise<{ user: User; token: string }> {
    const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: credentials.username,
            password: credentials.password
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to login');
    }

    const data = await response.json();
    localStorage.setItem('token', data.token);
    localStorage.setItem('userId', data.id.toString());
    
    return {
        user: {
            id: data.id,
            name: data.name,
            username: data.username,
            email: data.email,
            totalScore: data.totalScore
        },
        token: data.token
    };
}

export async function registerUser(userData: { username: string; password: string; email: string; name: string }): Promise<{ user: User; token: string }> {
    const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to register');
    }

    const data = await response.json();
    localStorage.setItem('token', data.token);
    localStorage.setItem('userId', data.id.toString());
    
    return {
        user: {
            id: data.id,
            name: data.name,
            username: data.username,
            email: data.email,
            totalScore: data.totalScore
        },
        token: data.token
    };
}

export function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
}