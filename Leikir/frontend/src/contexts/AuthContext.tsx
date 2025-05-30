'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@/types/auth';
import { getUserProfile } from '@/services/api';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    login: (user: User) => Promise<void>;
    logout: () => void;
    clearError: () => void;
    updateUserScore: (newScore: number) => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    error: null,
    login: async () => {},
    logout: () => {},
    clearError: () => {},
    updateUserScore: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const initializeAuth = async () => {
            const userId = localStorage.getItem('userId');
            const token = localStorage.getItem('token');

            if (userId && token) {
                try {
                    const userData = await getUserProfile(parseInt(userId));
                    setUser(userData);
                } catch (err) {
                    console.error('Failed to fetch user data:', err);
                    // Clear invalid auth data
                    localStorage.removeItem('token');
                    localStorage.removeItem('userId');
                }
            }
            setLoading(false);
        };

        initializeAuth();
    }, []);

    const login = async (user: User) => {
        setUser(user);
        localStorage.setItem('userId', user.id.toString());
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
    };

    const clearError = () => {
        setError(null);
    };

    const updateUserScore = (newScore: number) => {
        if (user) {
            setUser({
                ...user,
                totalScore: newScore
            });
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, error, login, logout, clearError, updateUserScore }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}