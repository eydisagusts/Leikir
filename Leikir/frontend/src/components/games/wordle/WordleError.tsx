'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface WordleErrorProps {
    message: string;
    onClose: () => void;
    duration?: number; // Duration in milliseconds
}

export default function WordleError({ 
    message, 
    onClose,
    duration = 2000 // Default to 2 seconds
}: WordleErrorProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [onClose, duration]);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-500 text-white px-3 py-1.5 rounded text-sm font-medium shadow-lg z-50"
            >
                {message}
            </motion.div>
        </AnimatePresence>
    );
} 