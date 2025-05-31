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
    refreshUserData: () => Promise<void>;
    updateProfile: (userData: { name: string; username: string; email: string; password?: string }) => Promise<void>;
    setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    error: null,
    login: async () => {},
    logout: () => {},
    clearError: () => {},
    refreshUserData: async () => {},
    updateProfile: async () => {},
    setUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshUserData = async () => {
        if (!user) return;
        try {
            const userData = await getUserProfile(user.id);
            
            const updatedUser = {
                ...user,  // Keep existing user data
                totalScore: userData.totalScore || 0,
                totalGames: userData.totalGames || 0,
                totalWins: userData.totalWins || 0,
                totalLosses: userData.totalLosses || 0
            };
            setUser(updatedUser);
        } catch (err) {
            console.error('Failed to refresh user data:', err);
            // If we get a 401, clear the auth data
            if (err instanceof Error && err.message.includes('401')) {
                localStorage.removeItem('token');
                localStorage.removeItem('userId');
                setUser(null);
            }
        }
    };

    useEffect(() => {
        const initializeAuth = async () => {
            const userId = localStorage.getItem('userId');
            const token = localStorage.getItem('token');

            if (userId && token) {
                try {
                    const userData = await getUserProfile(parseInt(userId));
                    setUser({
                        id: userData.id,
                        name: userData.name,
                        username: userData.username,
                        email: userData.email,
                        totalScore: userData.totalScore,
                        totalGames: userData.totalGames,
                        totalWins: userData.totalWins,
                        totalLosses: userData.totalLosses
                    });
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
        <AuthContext.Provider value={{ user, loading, error, login, logout, clearError, refreshUserData, updateProfile, setUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}