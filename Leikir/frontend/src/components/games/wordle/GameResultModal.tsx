import React, { useEffect, useRef } from 'react';

interface GameResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    onNewGame: () => void;
    isWon: boolean;
    score?: number;
    targetWord?: string;
}

export default function GameResultModal({
    isOpen,
    onClose,
    onNewGame,
    isWon,
    score,
    targetWord
}: GameResultModalProps) {
    const prevProps = useRef({ isOpen, isWon, score, targetWord });

    useEffect(() => {
        prevProps.current = { isOpen, isWon, score, targetWord };
    }, [isOpen, isWon, score, targetWord]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full flex flex-col items-center relative animate-fade-in">
                <button
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors text-2xl font-bold focus:outline-none cursor-pointer"
                    onClick={onClose}
                    aria-label="Loka"
                >
                    ×
                </button>
                {isWon ? (
                    <>
                        <div className="text-6xl mb-4 text-yellow-400">
                            <span role="img" aria-label="Trophy">🏆</span>
                        </div>
                        <h2 className="text-3xl font-extrabold text-green-600 mb-2 text-center drop-shadow">Vel Gert!</h2>
                        <p className="text-lg text-gray-700 mb-2 text-center">Þú fannst orðið og fékkst:</p>
                        <div className="flex flex-col items-center mb-6">
                            <span className="text-5xl font-bold bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent animate-pulse">
                                {score}
                            </span>
                            <span className="text-xl font-medium text-gray-600 tracking-wider">STIG</span>
                        </div>
                        <button
                            className="mt-2 px-6 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold text-lg shadow-md transition-colors duration-200 cursor-pointer"
                            onClick={onNewGame}
                        >
                            Nýr leikur
                        </button>
                    </>
                ) : (
                    <>
                        <div className="text-6xl mb-4 text-red-400">
                            <span role="img" aria-label="Sad">😢</span>
                        </div>
                        <h2 className="text-3xl font-extrabold text-red-600 mb-2 text-center drop-shadow">Kemur betur næst</h2>
                        <p className="text-lg text-gray-700 mb-4 text-center">Rétta orðið var <span className="font-bold text-gray-900">{targetWord}</span>.</p>
                        <button
                            className="mt-2 px-6 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold text-lg shadow-md transition-colors duration-200 cursor-pointer"
                            onClick={onNewGame}
                        >
                            Reyna aftur
                        </button>
                    </>
                )}
            </div>
        </div>
    );
} 