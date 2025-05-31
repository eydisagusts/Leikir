'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const { user, logout } = useAuth();
    const [mounted, setMounted] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Handle hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isActive = (path: string): boolean => {
        if (!mounted) return false;
        return pathname === path;
    };

    const handleLogout = (): void => {
        logout();
        setIsDropdownOpen(false);
        setShowLogoutConfirm(false);
        router.push('/');
    };

    return (
        <header className="bg-white shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="absolute left-5 ">
                        <Link href="/" className="text-2xl font-bold text-black hover:text-blue-600 transition-colors">
                            Leikir
                        </Link>
                    </div>

                    <div className="hidden md:flex flex-1 justify-center">
                        <nav className="flex space-x-8 ">
                            <Link
                                href="/"
                                className={`px-3 py-2 rounded-md text-lg font-medium transition-colors ${
                                    isActive('/') ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'
                                }`}
                            >
                                Heim
                            </Link>
                    
                            <Link
                                href="/stigatafla"
                                className={`px-3 py-2 rounded-md text-lg font-medium transition-colors ${
                                    isActive('/stigatafla') ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'
                                }`}
                            >
                                Stigatafla
                            </Link>
                            <Link
                                href="/um-okkur"
                                className={`px-3 py-2 rounded-md text-lg font-medium transition-colors ${
                                    isActive('/um-okkur') ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'
                                }`}
                            >
                                Um okkur
                            </Link>
                            <Link
                                href="/hafa-samband"
                                className={`px-3 py-2 rounded-md text-lg font-medium transition-colors ${
                                    isActive('/hafa-samband') ? 'text-blue-600' : 'text-gray-700 hover:text-blue-600'
                                }`}
                            >
                                Hafa samband
                            </Link>
                        </nav>
                    </div>

                    <div className="absolute right-5">
                        {user ? (
                            <div className="flex items-center space-x-4" ref={dropdownRef}>
                                <div className="hidden md:flex items-center space-x-2">
                                    <span className="text-gray-700 font-medium">{user.username}</span>
                                    <div className="flex items-center space-x-1 bg-gray-100 px-3 py-1 rounded-full">
                                        <span className="text-gray-600">Stig:</span>
                                        <span className="font-bold text-blue-600">{user.totalScore || 0}</span>
                                    </div>
                                </div>
                                
                                <div className="relative">
                                    <button
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        className="px-4 py-1 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors space-x-1 cursor-pointer"
                                    >
                                        <span className="hidden md:inline ">Minn aðgangur</span>
                                        <span className="md:hidden">Mín</span>
                                        <svg
                                            className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    <AnimatePresence>
                                        {isDropdownOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                transition={{ duration: 0.2 }}
                                                className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50"
                                            >
                                                <div className="py-1">
                                                    <Link
                                                        href="/adgangur"
                                                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                                                        onClick={() => setIsDropdownOpen(false)}
                                                    >
                                                        Skoða/Breyta aðgangi
                                                    </Link>
                                                    <button
                                                        onClick={() => {
                                                            setShowLogoutConfirm(true);
                                                            setIsDropdownOpen(false);
                                                        }}
                                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                                                    >
                                                        Útskrá
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        ) : (
                            <div className="flex space-x-4">
                                <Link
                                    href="/nyskraning"
                                    className="px-4 py-2 rounded-md text-lg font-medium text-gray-700 hover:text-blue-600 transition-colors"
                                >
                                    Nýskráning
                                </Link>
                                <Link
                                    href="/innskraning"
                                    className="px-4 py-2 rounded-md text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                                >
                                    Innskráning
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Logout Confirmation Modal */}
            <AnimatePresence>
                {showLogoutConfirm && (
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
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Útskrá</h3>
                            <p className="text-sm text-gray-500 mb-6">
                                Ertu viss um að þú viljir skrá þig út?
                            </p>
                            <div className="flex justify-end space-x-4">
                                <button
                                    onClick={() => setShowLogoutConfirm(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 cursor-pointer"
                                >
                                    Hætta við
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                                >
                                    Útskrá
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}