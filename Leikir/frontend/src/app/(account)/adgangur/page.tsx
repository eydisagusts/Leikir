'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface PasswordFormData {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}

export default function AccountPage() {
    const { user, loading: authLoading, updateProfile } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'profile' | 'stats' | 'settings'>('profile');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        username: user?.username || ''
    });
    const [passwordFormData, setPasswordFormData] = useState<PasswordFormData>({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

    // Update form data when user changes
    React.useEffect(() => {
        if (user) {
            setFormData({
                name: user.name,
                email: user.email,
                username: user.username
            });
        }
    }, [user]);

    // Handle auth state
    React.useEffect(() => {
        if (!authLoading && !user) {
            router.push('/innskraning');
        }
    }, [authLoading, user, router]);

    const validatePassword = (password: string): boolean => {
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);
        const isLongEnough = password.length >= 8;

        return hasUpperCase && hasLowerCase && hasNumber && isLongEnough;
    };

    const handleSave = async () => {
        setError(null);
        setIsSaving(true);
        try {
            await updateProfile(formData);
            setIsEditing(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Villa kom upp við að uppfæra prófíl');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePasswordChange = async () => {
        setPasswordError(null);
        setPasswordSuccess(null);
        
        // Validate new password
        if (!validatePassword(passwordFormData.newPassword)) {
            setPasswordError('Lykilorð verður að innihalda að minnsta kosti 8 stafi, einn hástaf, einn lágstaf og einn tölustaf');
            return;
        }

        // Check if passwords match
        if (passwordFormData.newPassword !== passwordFormData.confirmPassword) {
            setPasswordError('Lykilorðin passa ekki saman');
            return;
        }

        setIsChangingPassword(true);
        try {
            await updateProfile({
                ...formData,
                password: passwordFormData.newPassword
            });
            setPasswordFormData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
            setPasswordSuccess('Lykilorði hefur verið breytt');
            // Clear success message after 3 seconds
            setTimeout(() => {
                setPasswordSuccess(null);
            }, 3000);
        } catch (err) {
            setPasswordError(err instanceof Error ? err.message : 'Villa kom upp við að uppfæra lykilorð');
        } finally {
            setIsChangingPassword(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-lg">Hleð...</div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="h-16" />
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-8">
                        <div className="flex items-center space-x-4">
                            <div className="h-20 w-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold text-white">
                                {user.username[0].toUpperCase()}
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">{user.name}</h1>
                                <p className="text-blue-100">@{user.username}</p>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="border-b border-gray-200">
                        <nav className="flex space-x-8 px-6" aria-label="Tabs">
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`py-4 px-1 border-b-2 font-medium text-sm cursor-pointer ${
                                    activeTab === 'profile'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                Minn Aðgangur
                            </button>
                            <button
                                onClick={() => setActiveTab('stats')}
                                className={`py-4 px-1 border-b-2 font-medium text-sm cursor-pointer ${
                                    activeTab === 'stats'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                Tölfræði
                            </button>
                            <button
                                onClick={() => setActiveTab('settings')}
                                className={`py-4 px-1 border-b-2 font-medium text-sm cursor-pointer ${
                                    activeTab === 'settings'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                Stillingar
                            </button>
                        </nav>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        <AnimatePresence mode="wait">
                            {activeTab === 'profile' && (
                                <motion.div
                                    key="profile"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="space-y-6"
                                >
                                    <div className="flex justify-between items-center">
                                        <h2 className="text-xl font-semibold text-gray-900">Mínar upplýsingar</h2>
                                        <button
                                            onClick={() => {
                                                if (isEditing) {
                                                    setFormData({
                                                        name: user.name,
                                                        email: user.email,
                                                        username: user.username
                                                    });
                                                }
                                                setIsEditing(!isEditing);
                                            }}
                                            className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                                        >
                                            {isEditing ? 'Hætta við' : 'Breyta'}
                                        </button>
                                    </div>

                                    {error && (
                                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                                            {error}
                                        </div>
                                    )}

                                    <div className="space-y-6">
                                        <div className="relative group">
                                            <label
                                                htmlFor="name"
                                                className="block text-sm font-medium text-gray-700 mb-1"
                                            >
                                                Nafn
                                            </label>
                                            <input
                                                type="text"
                                                id="name"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                disabled={!isEditing}
                                                className="w-full px-4 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 transition-all duration-200 ease-in-out"
                                            />
                                        </div>

                                        <div className="relative group">
                                            <label
                                                htmlFor="email"
                                                className="block text-sm font-medium text-gray-700 mb-1"
                                            >
                                                Netfang
                                            </label>
                                            <input
                                                type="email"
                                                id="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                disabled={!isEditing}
                                                className="w-full px-4 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 transition-all duration-200 ease-in-out"
                                            />
                                        </div>

                                        <div className="relative group">
                                            <label
                                                htmlFor="username"
                                                className="block text-sm font-medium text-gray-700 mb-1"
                                            >
                                                Notendanafn
                                            </label>
                                            <input
                                                type="text"
                                                id="username"
                                                value={formData.username}
                                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                                disabled={!isEditing}
                                                className="w-full px-4 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 transition-all duration-200 ease-in-out"
                                            />
                                        </div>
                                    </div>

                                    {isEditing && (
                                        <div className="flex justify-end space-x-4">
                                            
                                            <button
                                                onClick={handleSave}
                                                disabled={isSaving}
                                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                            >
                                                {isSaving ? 'Vista...' : 'Vista breytingar'}
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {activeTab === 'stats' && (
                                <motion.div
                                    key="stats"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="space-y-6"
                                >
                                    <h2 className="text-xl font-semibold text-gray-900">Leikjastig</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-gray-50 rounded-lg p-6">
                                            <h3 className="text-lg font-medium text-gray-900 mb-4">Orðla</h3>
                                            <div className="space-y-3">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Heildarstig</span>
                                                    <span className="font-medium text-gray-900">{user.totalScore || 0}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Sigrar</span>
                                                    <span className="font-medium text-gray-900">0</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Leikir</span>
                                                    <span className="font-medium text-gray-900">0</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-6">
                                            <h3 className="text-lg font-medium text-gray-900 mb-4">Hengiman</h3>
                                            <div className="space-y-3">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Heildarstig</span>
                                                    <span className="font-medium text-gray-900">0</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Sigrar</span>
                                                    <span className="font-medium text-gray-900">0</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Leikir</span>
                                                    <span className="font-medium text-gray-900">0</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {activeTab === 'settings' && (
                                <motion.div
                                    key="settings"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="space-y-6"
                                >
                                    <h2 className="text-xl font-semibold text-gray-900">Stillingar</h2>
                                    <div className="space-y-6">
                                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                            <div className="p-6">
                                                <h3 className="text-lg font-medium text-gray-900 mb-6">Breyta lykilorði</h3>
                                                {passwordError && (
                                                    <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                                                        {passwordError}
                                                    </div>
                                                )}
                                                {passwordSuccess && (
                                                    <div className="mb-6 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md">
                                                        {passwordSuccess}
                                                    </div>
                                                )}
                                                <div className="space-y-6">
                                                    <div className="relative group">
                                                        <label
                                                            htmlFor="currentPassword"
                                                            className="block text-sm font-medium text-gray-700 mb-1"
                                                        >
                                                            Núverandi lykilorð
                                                        </label>
                                                        <input
                                                            type="password"
                                                            id="currentPassword"
                                                            value={passwordFormData.currentPassword}
                                                            onChange={(e) => setPasswordFormData({ ...passwordFormData, currentPassword: e.target.value })}
                                                            className="w-full px-4 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200 ease-in-out"
                                                        />
                                                    </div>

                                                    <div className="relative group">
                                                        <label
                                                            htmlFor="newPassword"
                                                            className="block text-sm font-medium text-gray-700 mb-1"
                                                        >
                                                            Nýtt lykilorð
                                                        </label>
                                                        <input
                                                            type="password"
                                                            id="newPassword"
                                                            value={passwordFormData.newPassword}
                                                            onChange={(e) => setPasswordFormData({ ...passwordFormData, newPassword: e.target.value })}
                                                            className="w-full px-4 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200 ease-in-out"
                                                        />
                                                        <p className="mt-2 text-sm text-gray-500">
                                                            Lykilorð verður að innihalda að minnsta kosti 8 stafi, einn hástaf, einn lágstaf og einn tölustaf
                                                        </p>
                                                    </div>

                                                    <div className="relative group">
                                                        <label
                                                            htmlFor="confirmPassword"
                                                            className="block text-sm font-medium text-gray-700 mb-1"
                                                        >
                                                            Staðfesta nýtt lykilorð
                                                        </label>
                                                        <input
                                                            type="password"
                                                            id="confirmPassword"
                                                            value={passwordFormData.confirmPassword}
                                                            onChange={(e) => setPasswordFormData({ ...passwordFormData, confirmPassword: e.target.value })}
                                                            className="w-full px-4 py-3 text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200 ease-in-out"
                                                        />
                                                    </div>

                                                    <div className="flex justify-end pt-4">
                                                        <button
                                                            onClick={handlePasswordChange}
                                                            disabled={isChangingPassword}
                                                            className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ease-in-out cursor-pointer"
                                                        >
                                                            {isChangingPassword ? 'Vistar...' : 'Vista lykilorð'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                            <div className="p-6">
                                                <h3 className="text-lg font-medium text-gray-900 mb-4">Eyða aðgangi</h3>
                                                <p className="text-sm text-gray-500 mb-6">
                                                    Þegar þú eyðir aðgangi þínum verður allt gagnasafn þitt eytt og ekki er hægt að endurheimta það.
                                                </p>
                                                <button className="px-6 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 ease-in-out">
                                                    Eyða aðgangi
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}
