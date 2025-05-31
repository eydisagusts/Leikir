'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { updateUser, deleteUser } from '@/services/auth';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';


export default function AccountPage() {
    const { user, loading: authLoading, updateProfile, logout } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'profile' | 'stats' | 'settings'>('profile');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        username: user?.username || ''
    });
    
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Update form data when user changes
    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name,
                email: user.email,
                username: user.username
            });
        }
    }, [user]);

    // Handle auth state
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/innskraning');
        }
    }, [authLoading, user, router]);


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

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');
        
        if (newPassword !== confirmPassword) {
            setPasswordError('Lykilorðin passa ekki saman');
            return;
        }

        // Check password requirements
        const hasUpperCase = /[A-Z]/.test(newPassword);
        const hasLowerCase = /[a-z]/.test(newPassword);
        const hasNumber = /\d/.test(newPassword);
        const isLongEnough = newPassword.length >= 8;

        if (!hasUpperCase || !hasLowerCase || !hasNumber || !isLongEnough) {
            setPasswordError('Lykilorðið verður að innihalda að minnsta kosti 8 stafi, einn hástaf, einn lágstaf og einn tölustaf');
            return;
        }

        try {
            if (!user) {
                throw new Error('Notandi fannst ekki');
            }

            const updateData = {
                name: user.name,
                username: user.username,
                email: user.email,
                password: newPassword,
                currentPassword: currentPassword
            };
            await updateUser(user.id, updateData);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setPasswordError('');
            setPasswordSuccess('Lykilorði hefur verið breytt');
            // Clear success message after 3 seconds
            setTimeout(() => {
                setPasswordSuccess('');
            }, 3000);
        } catch (error: any) {
            if (error.message === 'Rangt núverandi lykilorð') {
                setPasswordError('Villa kom upp við að staðfesta lykilorð');
            } else {
                setPasswordError('Villa kom upp við að breyta lykilorði');
            }
        }
    };

    const handleDeleteAccount = async () => {
        if (!user) return;
        
        setIsDeleting(true);
        try {
            await deleteUser(user.id);
            logout();
            router.push('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Villa kom upp við að eyða aðgangi');
            setShowDeleteConfirm(false);
        } finally {
            setIsDeleting(false);
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
                                    <h2 className="text-xl font-semibold text-gray-900">Tölfræði</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="bg-gray-50 rounded-lg p-6">
                                            <h3 className="text-lg font-medium text-gray-900 mb-4">Orðla</h3>
                                            <div className="space-y-3">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Heildarstig</span>
                                                    <span className="font-bold text-blue-500">{user.totalScore ?? 0}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Leikir</span>
                                                    <span className="font-bold text-gray-900">{user.totalGames ?? 0}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-green-500">Sigrar</span>
                                                    <span className="font-bold text-gray-900">{user.totalWins ?? 0}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-red-500">Töp</span>
                                                    <span className="font-bold text-gray-900">{user.totalLosses ?? 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-6">
                                            <h3 className="text-lg font-medium text-gray-900 mb-4">Hengiman</h3>
                                            <div className="space-y-3">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Heildarstig</span>
                                                    <span className="font-bold text-gray-900">0</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Leikir</span>
                                                    <span className="font-bold text-gray-900">0</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-green-500">Sigrar</span>
                                                    <span className="font-bold text-gray-900">0</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-red-500">Töp</span>
                                                    <span className="font-bold text-gray-900">0</span>
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
                                                    <form onSubmit={handlePasswordChange} className="space-y-4">
                                                        <div>
                                                            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                                                                Núverandi lykilorð
                                                            </label>
                                                            <input
                                                                type="password"
                                                                id="currentPassword"
                                                                value={currentPassword}
                                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                                className="mt-1 block w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                                required
                                                            />
                                                        </div>
                                                        <div>
                                                            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                                                                Nýtt lykilorð
                                                            </label>
                                                            <input
                                                                type="password"
                                                                id="newPassword"
                                                                value={newPassword}
                                                                onChange={(e) => setNewPassword(e.target.value)}
                                                                className="mt-1 block w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                                required
                                                            />
                                                            <p className="mt-2 text-sm text-gray-500">
                                                                Lykilorð verður að innihalda að minnsta kosti 8 stafi, einn hástaf, einn lágstaf og einn tölustaf
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                                                                Staðfesta nýtt lykilorð
                                                            </label>
                                                            <input
                                                                type="password"
                                                                id="confirmPassword"
                                                                value={confirmPassword}
                                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                                className="mt-1 block w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                                required
                                                            />
                                                        </div>
                                                        <button
                                                            type="submit"
                                                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                                                        >
                                                            Breyta lykilorði
                                                        </button>
                                                    </form>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                            <div className="p-6">
                                                <button 
                                                    onClick={() => setShowDeleteConfirm(true)}
                                                    className="px-6 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 ease-in-out cursor-pointer"
                                                >
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

            {/* Delete Account Confirmation Modal */}
            <AnimatePresence>
                {showDeleteConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 backdrop-blur-sm bg-white/30 flex items-center justify-center p-4 z-50"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl"
                        >
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Eyða aðgangi</h3>
                            <p className="text-sm text-gray-500 mb-6">
                                Ertu viss um að þú viljir eyða aðgangnum þínum? Ef þú eyðir aðgangnum þínum þá verður ekki hægt að endurheimta hann. Allar upplýsingar og tölfræði tengdar þínum aðgangi verða eytt.
                            </p>
                            <div className="flex justify-end space-x-4">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 cursor-pointer"
                                    disabled={isDeleting}
                                >
                                    Hætta við
                                </button>
                                <button
                                    onClick={handleDeleteAccount}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 cursor-pointer"
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? 'Eyði...' : 'Eyða aðgangi'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
