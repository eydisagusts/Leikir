'use client';

import { useEffect, useState } from 'react';
import { getLeaderboard } from '@/services/leaderboard';
import type { User } from '@/types/auth';

export default function LeaderboardPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchLeaderboard = async () => {
            try {
                const data = await getLeaderboard();
                if (isMounted) {
                    setUsers(data);
                    setError(null);
                }
            } catch (err) {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchLeaderboard();
        const interval = setInterval(fetchLeaderboard, 30000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
                <div className="max-w-md w-full mx-auto p-4">
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-sm">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">Villa kom upp</h3>
                                <p className="text-sm text-red-700 mt-1">{error}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (users.length === 0) {
        return (
            <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
                <div className="max-w-md w-full mx-auto p-4">
                    <div className="bg-gray-50 rounded-lg p-6 text-center shadow-sm">
                        <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Engin notandi hefur enn spilað leik</h3>
                        <p className="mt-1 text-sm text-gray-500">Byrjaðu að spila til að sjá stigatafluna!</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-8">
            <div className="w-full max-w-2xl mx-auto px-4">
                <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-6">
                        <h2 className="text-2xl font-bold text-white text-center">Stigatafla</h2>
                        <p className="text-blue-100 text-center mt-1 text-sm">Top 10 leikmenn</p>
                    </div>
                    
                    <div className="divide-y divide-gray-100">
                        {users.map((user, index) => (
                            <div
                                key={user.id}
                                className="group hover:bg-gray-50 transition-all duration-200"
                            >
                                <div className="px-4 py-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-base font-bold
                                                ${index === 0 ? 'bg-yellow-100 text-yellow-800' :
                                                index === 1 ? 'bg-gray-100 text-gray-800' :
                                                index === 2 ? 'bg-orange-100 text-orange-800' :
                                                'bg-blue-100 text-blue-800'}`}
                                            >
                                                {index + 1}
                                            </div>
                                            <div>
                                                <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                                                    {user.name}
                                                </h3>
                                                <p className="text-xs text-gray-500">@{user.username}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="text-right">
                                            <div className="text-xl font-bold text-blue-600">
                                                {user.totalScore.toLocaleString()}
                                            </div>
                                            <div className="flex items-center justify-end space-x-2 text-xs text-gray-500">
                                                <span className="flex items-center">
                                                    <svg className="w-3 h-3 text-green-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    {user.totalWins}
                                                </span>
                                                <span className="text-gray-300">|</span>
                                                <span>{user.totalGames} leikir</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}