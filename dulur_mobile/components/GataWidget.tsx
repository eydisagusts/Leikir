import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';

interface Gata {
    id: number;
    text: string;
    answers: string[];
}

export function GataWidget() {
    const [gata, setGata] = useState<Gata | null>(null);
    const [loading, setLoading] = useState(true);
    const [guess, setGuess] = useState('');
    const [solved, setSolved] = useState(false);
    const [shakeAnimation] = useState(new Animated.Value(0));

    const todayDateStr = new Date().toISOString().split('T')[0];
    const storageKey = `dulur_gata_solved_${todayDateStr}`;

    useEffect(() => {
        const fetchGata = async () => {
            try {
                // Check if already solved today
                const isSolvedLocal = await AsyncStorage.getItem(storageKey);
                if (isSolvedLocal === 'true') {
                    setSolved(true);
                }

                // Fetch riddle from server
                const res = await fetch(`${API_URL}/api/mobile/gatur?locale=is`);
                if (res.ok) {
                    const data = await res.json();
                    setGata(data);
                }
            } catch (err) {
                console.error("Failed to fetch daily gata", err);
            } finally {
                setLoading(false);
            }
        };

        fetchGata();
    }, [storageKey]);

    const handleShake = () => {
        Animated.sequence([
            Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true })
        ]).start();
    };

    const handleSubmit = async () => {
        if (!guess.trim() || solved || !gata) return;

        const normalizedGuess = guess.toLowerCase().trim();
        const isCorrect = gata.answers.some(ans => ans.toLowerCase() === normalizedGuess);

        if (isCorrect) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setSolved(true);
            await AsyncStorage.setItem(storageKey, 'true');
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            handleShake();
        }
    };

    if (loading || !gata) {
        return null;
    }

    return (
        <View className="bg-white border border-slate-200 rounded-xl shadow-sm p-3 w-full max-w-[220px] self-center my-3 relative overflow-hidden" style={{ elevation: 2 }}>
            <View className="flex-row items-center gap-1.5 mb-1.5 z-10 w-full justify-center opacity-70">
                <Ionicons name="sparkles" size={10} color="#1E293B" />
                <Text className="text-[10px] uppercase font-black tracking-widest text-slate-800" style={{ fontFamily: 'Georgia' }}>Gáta dagsins</Text>
            </View>

            <Text className="text-[13px] text-slate-900 text-center mb-3 font-medium" style={{ fontFamily: 'Georgia', lineHeight: 18 }}>
                {gata.text}
            </Text>

            {solved ? (
                <View className="flex-row justify-center items-center bg-green-50 py-1.5 rounded-lg border border-green-200 gap-1.5">
                    <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
                    <Text className="text-[#16A34A] text-[10px] font-bold capitalize">{gata.answers[0]}</Text>
                </View>
            ) : (
                <Animated.View style={{ transform: [{ translateX: shakeAnimation }] }} className="flex-row w-full">
                    <TextInput
                        value={guess}
                        onChangeText={setGuess}
                        placeholder="Svarið..."
                        placeholderTextColor="#94A3B8"
                        className="flex-1 bg-white border border-slate-300 rounded-l-lg px-2.5 h-[34px] text-slate-900 font-medium text-xs"
                        autoCorrect={false}
                        autoCapitalize="sentences"
                    />
                    <TouchableOpacity 
                        onPress={handleSubmit}
                        activeOpacity={0.8}
                        className="bg-slate-900 h-[34px] px-3 items-center justify-center rounded-r-lg border border-l-0 border-slate-900"
                    >
                        <Ionicons name="chevron-forward" size={14} color="white" />
                    </TouchableOpacity>
                </Animated.View>
            )}
        </View>
    );
}
