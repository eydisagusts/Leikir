'use client';

import React from 'react';
import { LetterState } from '@/types/wordle';

interface WordleKeyboardProps {
    onKeyPress: (key: string) => void;
    letterStates: Record<string, LetterState>;
    disabled?: boolean;
}

export default function WordleKeyboard({ onKeyPress, letterStates, disabled = false }: WordleKeyboardProps) {
    const keyboardRows = [
        ['q', 'w', 'e', 'é', 'r', 't', 'u', 'ú', 'i', 'í', 'o', 'ó', 'p'],
        ['a', 'á', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'æ', 'ö', 'ð'],
        ['Enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'y', 'ý', 'þ', '⌫']
    ];

    const getKeyStyles = (key: string): string => {
        // Base styles for all keys
        let styles = `
            rounded-lg font-bold uppercase flex items-center justify-center
            transition-colors duration-200 border-2 h-14 m-1 cursor-pointer
            shadow-sm border-gray-300 border hover:shadow-lg
        `;

        // Width for special keys vs regular keys
        styles += key === 'Enter' || key === '⌫' ? ' w-20' : ' w-12';

        // Special keys colors
        if (key === 'Enter') {
            return `${styles} bg-green-500 hover:bg-green-600 text-white border-green-600`;
        }
        if (key === '⌫') {
            return `${styles} bg-red-500 hover:bg-red-600 text-white border-red-600`;
        }

        // Status-based colors for regular keys
        const status = letterStates[key.toLowerCase()];
        switch (status) {
            case LetterState.Correct:
                return `${styles} bg-green-500 hover:bg-green-600 text-white border-green-600`;
            case LetterState.Present:
                return `${styles} bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-600`;
            case LetterState.Absent:
                return `${styles} bg-gray-500 hover:bg-gray-600 text-white border-gray-600`;
            default:
                return `${styles} bg-gray-100 hover:bg-gray-300 text-gray-800 border-gray-150`;
        }
    };

    return (
        <div className="min-h-screen items-center justify-center transform w-full p-4">
            <div className="space-y-2">
                {keyboardRows.map((row, i) => (
                    <div key={i} className="flex justify-center">
                        {row.map((key) => (
                            <button
                                key={key}
                                onClick={() => !disabled && onKeyPress(key === 'Enter' ? 'Enter' : key)}
                                className={`${getKeyStyles(key)} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={disabled}
                            >
                                {key}
                            </button>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}