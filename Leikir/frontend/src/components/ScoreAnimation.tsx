'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ScoreAnimationProps {
    score: number;
    onComplete: () => void;
}

const ScoreAnimation: React.FC<ScoreAnimationProps> = ({ score, onComplete }) => {
    const [showPopup, setShowPopup] = useState(true);
    const [showFlyingScore, setShowFlyingScore] = useState(false);

    useEffect(() => {
        // Show the popup first
        setShowPopup(true);

        // After 2 seconds, start the flying animation
        const timer = setTimeout(() => {
            setShowPopup(false);
            setShowFlyingScore(true);
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <AnimatePresence>
            {showPopup && (
                <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="fixed inset-0 flex items-center justify-center z-50"
                >
                    <div className="bg-white rounded-lg p-8 shadow-xl text-center">
                        <h2 className="text-2xl font-bold mb-4">Til hamingju!</h2>
                        <p className="text-xl mb-4">Þú vannst {score} stig!</p>
                    </div>
                </motion.div>
            )}

            {showFlyingScore && (
                <motion.div
                    initial={{ scale: 1, opacity: 1, x: '50vw', y: '50vh' }}
                    animate={{ 
                        scale: 0.5, 
                        opacity: 0.5, 
                        x: 'calc(100vw - 200px)', // Position near the right edge
                        y: '20px' // Position near the top
                    }}
                    transition={{ 
                        duration: 1,
                        ease: "easeInOut"
                    }}
                    onAnimationComplete={onComplete}
                    className="fixed z-50 text-2xl font-bold text-green-600"
                >
                    +{score}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ScoreAnimation; 