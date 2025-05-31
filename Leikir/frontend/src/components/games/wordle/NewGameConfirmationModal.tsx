import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NewGameConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export default function NewGameConfirmationModal({
    isOpen,
    onClose,
    onConfirm
}: NewGameConfirmationModalProps) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl"
                    >
                        <h2 className="text-xl font-bold text-center text-gray-900 mb-4">
                            Byrja nýjan leik?
                        </h2>
                        <div className="flex justify-center space-x-4">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors cursor-pointer"
                            >
                                Hætta við
                            </button>
                            <button
                                onClick={onConfirm}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium cursor-pointer"
                            >
                                Byrja nýjan leik
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
} 