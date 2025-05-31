'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface WordleInstructionsProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function WordleInstructions({ isOpen, onClose }: WordleInstructionsProps) {
    const [activeTab, setActiveTab] = useState<'rules' | 'scoring'>('rules');

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 bg-white/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white/95 rounded-lg shadow-xl max-w-md w-full p-4 relative border border-gray-100"
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <h2 className="text-xl font-bold text-center text-gray-900 mb-3">Leikreglur Orðlu</h2>
                        
                        <div className="flex border-b border-gray-200 mb-3">
                            <button
                                className={`px-4 py-2 text-sm font-medium cursor-pointer ${
                                    activeTab === 'rules'
                                        ? 'text-purple-600 border-b-2 border-purple-600'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                                onClick={() => setActiveTab('rules')}
                            >
                                Leikreglur
                            </button>
                            <button
                                className={`px-4 py-2 text-sm font-medium cursor-pointer ${
                                    activeTab === 'scoring'
                                        ? 'text-purple-600 border-b-2 border-purple-600'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                                onClick={() => setActiveTab('scoring')}
                            >
                                Stigagjöf
                            </button>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto pr-2">
                            {activeTab === 'rules' ? (
                                <div className="space-y-3 text-gray-700">
                                    <p className="text-sm">
                                        Markmið leiksins er að gíska á 5 stafa leyniorð í 6 tilraunum eða færri. Eftir hverja umferð gefur leikurinn þér vísbendingar sem hjálpar þér að komast nær því að finna orðið.
                                    </p>
                                    
                                    <div className="space-y-2">
                                        <h3 className="font-semibold text-sm">Vísbendingarnar virka svona:</h3>
                                        <ul className="list-disc pl-5 space-y-1 text-sm">
                                            <li>
                                                <span className="text-green-600 font-semibold">Grænn</span> þýðir að stafurinn er réttur og á réttum stað
                                            </li>
                                            <li>
                                                <span className="text-yellow-600 font-semibold">Gulur</span> þýðir að stafurinn er réttur en á röngum stað
                                            </li>
                                            <li>
                                                <span className="text-gray-600 font-semibold">Grár</span> þýðir að stafurinn er ekki í leyniorðinu
                                            </li>
                                        </ul>
                                    </div>
                                    <div>
                                        <h3 className='font-semibold text-sm'>Hefur þú það sem þarf til að komast í top 10 á stigalistanum?</h3>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3 text-gray-700">
                                    <p className="text-sm">
                                        Stigin eru reiknuð út frá tveimur þáttum: fjölda tilrauna og þann tíma sem það tekur að finna orðið.
                                    </p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <h4 className="font-medium text-sm text-gray-800">Fjöldi tilrauna:</h4>
                                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                                <li>1. tilraun: 100 stig</li>
                                                <li>2. tilraun: 80 stig</li>
                                                <li>3. tilraun: 60 stig</li>
                                                <li>4. tilraun: 40 stig</li>
                                                <li>5. tilraun: 30 stig</li>
                                                <li>6. tilraun: 15 stig</li>
                                            </ul>
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-sm text-gray-800">Tími:</h4>
                                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                                <li>Undir 1 mín: 100 stig</li>
                                                <li>1-3 mín: 80 stig</li>
                                                <li>3-5 mín: 60 stig</li>
                                                <li>5-8 mín: 40 stig</li>
                                                <li>8-10 mín: 30 stig</li>
                                                <li>Yfir 10 mín: 15 stig</li>
                                            </ul>
                                        </div>
                                    </div>
                                    <p className="text-sm italic">
                                        Fjöldi stiga eru svo reiknuð saman til að fá heildarstig fyrir leikinn.
                                    </p>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={onClose}
                            className="mt-4 w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors text-sm cursor-pointer"
                        >
                            Spila leik
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}