'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LetterState } from '@/types/wordle';

interface WordleCellProps {
    letter: string;
    state: LetterState | null;
    isCurrent: boolean;
    isRevealed: boolean;
    animationIndex: number;
}

const letterVariants = {
    initial: {
        rotateX: 0,
    },
    flip: (custom: { index: number }) => ({
        rotateX: [0, 90, 0],
        transition: {
            duration: 0.6,
            delay: custom.index * 0.3,
            ease: [0.25, 0.8, 0.25, 1],
        },
    }),
    winning: (index: number) => ({
        scale: [1, 1.2, 1],
        transition: {
            duration: 2.5,
            delay: index * 0.1 + 2,
            ease: 'easeOut',
        },
    }),
};

function getFinalBackgroundColor(state: LetterState | null): string {
    switch (state) {
        case 0: // LetterState.Correct
            return 'bg-green-500';
        case 1: // LetterState.Present
            return 'bg-yellow-500';
        case 2: // LetterState.Absent
            return 'bg-gray-500';
        default:
            return 'bg-white';
    }
}

export default function WordleCell({
    letter,
    state,
    isCurrent,
    isRevealed,
    animationIndex,
    onFlipComplete,
}: WordleCellProps & { onFlipComplete?: () => void }) {
    const [hasRevealed, setHasRevealed] = useState(false);

    // Reset hasRevealed when isRevealed changes from true to false
    useEffect(() => {
        if (!isRevealed) {
            setHasRevealed(false);
        }
    }, [isRevealed]);

    // Handle the flip animation
    useEffect(() => {
        if (isRevealed && !hasRevealed) {
            const timer = setTimeout(() => {
                setHasRevealed(true);
                if (onFlipComplete) onFlipComplete();
            }, animationIndex * 300 + 300);
            return () => clearTimeout(timer);
        }
    }, [isRevealed, animationIndex, hasRevealed, onFlipComplete]);
    
    const animation = isRevealed && !hasRevealed
        ? 'flip'
        : 'initial';

    // Show colors if:
    // 1. The cell has been revealed through animation (hasRevealed)
    // 2. OR the cell has a state (meaning it's from a previous guess)
    const shouldShowColor = hasRevealed || (state !== null && !isRevealed);
    const backgroundColor = shouldShowColor
        ? getFinalBackgroundColor(state)
        : isCurrent
            ? 'bg-gray-200'
            : 'bg-white';

    const textColor = shouldShowColor ? 'text-white' : 'text-gray-900';

    return (
        <motion.div
            custom={{ index: animationIndex }}
            initial="initial"
            animate={animation}
            variants={letterVariants}
            className={`w-16 h-16
                flex items-center justify-center
                text-2xl font-bold
                rounded-lg
                border-2 border-gray-300
                shadow-md
                transition-colors duration-200
                backface-visibility-hidden
                will-change-transform
                transform-gpu
                ${backgroundColor}
                ${textColor}`}
        >
            {letter.toUpperCase()}
        </motion.div>
    );
}