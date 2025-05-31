'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@/types/auth';
import { getUserProfile } from '@/services/api';
import { updateUser } from '@/services/auth';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    login: (user: User) => Promise<void>;
    logout: () => void;
    clearError: () => void;
    updateUserScore: (newScore: number) => void;
    updateProfile: (userData: { name: string; username: string; email: string; password?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    error: null,
    login: async () => {},
    logout: () => {},
    clearError: () => {},
    updateUserScore: () => {},
    updateProfile: async () => {},
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

    const updateProfile = async (userData: { name: string; username: string; email: string; password?: string }) => {
        if (!user) return;
        
        try {
            const updatedUser = await updateUser(user.id, userData);
            setUser(updatedUser);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update profile');
            throw err;
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, error, login, logout, clearError, updateUserScore, updateProfile }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}