'use client';

import React from 'react';
import WordleCell from './WordleCell';
import type { GameGridProps } from '@/types/wordle';

export default function WordleGrid({
    rows,
    currentRowIndex,
    currentColIndex,
    maxAttempts,
    wordLength,
    isGameOver,
    isWon,
    revealedRows
}: GameGridProps) {
    return (
        <div className="grid place-items-center">
            <div className="grid">
                {Array(maxAttempts).fill(null).map((_, rowIndex) => {
                    const row = rows[rowIndex] || { letters: Array(wordLength).fill(''), states: Array(wordLength).fill(null) };
                    const isCurrentRow = rowIndex === currentRowIndex;
                    const isRevealed = revealedRows.includes(rowIndex);
                    const isPreviousRow = rowIndex < currentRowIndex;

                    return (
                        <div key={`row-${rowIndex}`} className="flex gap-2 mb-2">
                            {Array(wordLength).fill(null).map((_, colIndex) => {
                                const cellState = isPreviousRow ? row.states[colIndex] : null;
                                const shouldReveal = isRevealed && !isPreviousRow;

                                return (
                                    <WordleCell
                                        key={`cell-${rowIndex}-${colIndex}`}
                                        letter={row.letters[colIndex] || ''}
                                        state={shouldReveal ? row.states[colIndex] : cellState}
                                        isCurrent={isCurrentRow && colIndex < currentColIndex}
                                        isRevealed={shouldReveal}
                                        animationIndex={colIndex}
                                    />
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}