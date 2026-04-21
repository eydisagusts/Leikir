import React, { useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, Dimensions, Share, Animated as RNAnimated } from 'react-native';
import { Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface NativeGameEndModalProps {
    visible: boolean;
    gameState: 'won' | 'lost';
    xpEarned: number | null;
    timeTakenSeconds?: number;
    winTitle?: string;
    winDesc?: string;
    loseTitle?: string;
    loseDesc?: string;
    gameTitle?: string;
    onContinue: () => void;
}

export const NativeGameEndModal: React.FC<NativeGameEndModalProps> = ({
    visible,
    gameState,
    xpEarned,
    timeTakenSeconds,
    winTitle = 'Vel gert!',
    winDesc = 'Þú leystir þrautina',
    loseTitle = 'Næstum því!',
    loseDesc = 'Því miður tókst það ekki í þetta skiptið.',
    gameTitle,
    onContinue,
}) => {
    const scale = React.useRef(new Animated.Value(0.8)).current;
    const opacity = React.useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true })
            ]).start();
        } else {
            scale.setValue(0.8);
            opacity.setValue(0);
        }
    }, [visible]);

    const animatedStyle = {
        transform: [{ scale }],
        opacity,
    };

    if (!visible) return null;

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <Modal animationType="fade" transparent={true} visible={visible}>
            <View className="flex-1 justify-center items-center px-4 bg-black/80">
                <Animated.View style={animatedStyle} className="bg-white rounded-[32px] w-full max-w-[400px] p-8 shadow-2xl items-center border border-white/20">

                    <TouchableOpacity
                        onPress={onContinue}
                        className="absolute top-4 right-4 p-2 rounded-full z-10 bg-slate-50 border border-slate-100 shadow-sm"
                    >
                        <Ionicons name="close" size={20} color="#64748b" />
                    </TouchableOpacity>

                    {gameState === 'won' ? (
                        <>
                            <View className="mb-6 relative">
                                <View className="absolute inset-x-0 bottom-0 top-[20%] bg-green-200 opacity-40 rounded-full" />
                                <View className="w-20 h-20 rounded-full flex items-center justify-center bg-green-100 border border-green-200/50 shadow-sm z-10">
                                    <Ionicons name="star" size={36} color="#10b981" />
                                </View>
                            </View>
                            <Text className="text-[32px] font-black font-serif mb-2 text-[#0f172a] text-center tracking-tight">{winTitle}</Text>
                            <Text className="text-[#64748b] text-center mb-8 text-[15px] leading-relaxed font-medium">{winDesc}</Text>
                        </>
                    ) : (
                        <>
                            <View className="mb-6 relative">
                                <View className="absolute inset-x-0 bottom-0 top-[20%] bg-red-200 opacity-40 rounded-full" />
                                <View className="w-20 h-20 rounded-full flex items-center justify-center bg-red-50 border border-red-200/50 shadow-sm z-10">
                                    <Text className="text-[36px] text-center leading-[36px]">💥</Text>
                                </View>
                            </View>
                            <Text className="text-[32px] font-black font-serif mb-2 text-[#ef4444] text-center tracking-tight">{loseTitle}</Text>
                            <Text className="text-[#ef4444] text-center mb-8 text-[15px] opacity-90 font-medium">{loseDesc}</Text>
                        </>
                    )}

                    <View className="flex-col items-center gap-3 mb-8 w-full border-t border-slate-100 pt-6">
                        {xpEarned !== null && xpEarned > 0 ? (
                            <View className="flex-row items-center justify-center gap-2 bg-[#fef08a]/20 border border-[#eab308]/30 px-6 py-2.5 rounded-[16px] w-full shadow-sm">
                                <Ionicons name="star" size={18} color="#eab308" />
                                <Text className="text-[#ca8a04] text-[20px] font-black tracking-wide">+{xpEarned} XP</Text>
                            </View>
                        ) : (
                            <View className="bg-slate-50 border border-slate-100 px-6 py-2.5 rounded-[16px] w-full justify-center flex-row shadow-sm">
                                <Text className="text-slate-400 text-[18px] font-black tracking-wide">0 XP</Text>
                            </View>
                        )}

                        {timeTakenSeconds !== undefined && timeTakenSeconds > 0 && (
                            <View className="flex-row items-center bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100">
                                <Ionicons name="time-outline" size={14} color="#94a3b8" />
                                <Text className="text-[#64748b] font-bold text-[13px] uppercase tracking-widest ml-1 mb-0.5">
                                    {formatTime(timeTakenSeconds)}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View className="flex-row gap-3 w-full">
                        <TouchableOpacity
                            onPress={onContinue}
                            className="flex-1 bg-[#0f172a] py-4 rounded-[16px] items-center justify-center shadow-lg"
                        >
                            <Text className="text-white font-bold text-[16px]">Halda áfram</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => {
                                const statusTxt = gameState === 'won' ? 'leysti' : 'spreytti mig á';
                                const gameName = gameTitle ? gameTitle : 'þraut';
                                const xpTxt = xpEarned ? ` og fékk ${xpEarned} XP` : '';
                                Share.share({
                                    message: `Ég ${statusTxt} ${gameName} á Dulur${xpTxt}! 🏆\nSpilaðu líka á https://dulur.is`
                                });
                            }}
                            className="bg-indigo-50 border border-indigo-100 w-16 rounded-[16px] flex items-center justify-center"
                        >
                            <Ionicons name="share-social" size={24} color="#4f46e5" />
                        </TouchableOpacity>
                    </View>

                </Animated.View>
            </View>
        </Modal>
    );
};
