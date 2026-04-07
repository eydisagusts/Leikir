import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setError] = useState<string|null>(null);
    const router = useRouter();

    const handleLogin = async () => {
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        setLoading(false);
    };

    return (
        <View className="flex-1 justify-center px-8 bg-background">
            <Text className="text-4xl font-serif font-black mb-8 text-foreground text-center">Dulur.</Text>
            {errorMsg && <Text className="text-red-500 mb-4 text-center font-bold">{errorMsg}</Text>}
            <TextInput 
               placeholder="Netfang"
               placeholderTextColor="#94a3b8"
               value={email}
               onChangeText={setEmail}
               className="w-full bg-white border border-slate-200 rounded-2xl h-14 px-4 mb-4 font-sans text-lg font-semibold shadow-sm text-[#1e1b4b]"
               style={{ paddingVertical: 0, margin: 0, includeFontPadding: false }}
               autoCapitalize="none"
            />
            <TextInput 
               placeholder="Lykilorð"
               placeholderTextColor="#94a3b8"
               value={password}
               onChangeText={setPassword}
               secureTextEntry
               className="w-full bg-white border border-slate-200 rounded-2xl h-14 px-4 mb-6 font-sans text-lg font-semibold shadow-sm text-[#1e1b4b]"
               style={{ paddingVertical: 0, margin: 0, includeFontPadding: false }}
            />
            <TouchableOpacity 
               className="w-full bg-[#1c1917] p-4 rounded-xl items-center shadow-lg"
               onPress={handleLogin}
               disabled={loading}
            >
               {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-lg font-sans">Skrá inn</Text>}
            </TouchableOpacity>
        </View>
    );
}
