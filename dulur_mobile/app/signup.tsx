import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignupScreen() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [ageAccepted, setAgeAccepted] = useState(false);
    
    const [loading, setLoading] = useState(false);
    const [errorMsg, setError] = useState<string | null>(null);
    const router = useRouter();

    const openLink = async (url: string) => {
        await WebBrowser.openBrowserAsync(url);
    };

    const handleSignup = async () => {
        if (!termsAccepted || !ageAccepted) {
            setError('Þú verður að samþykkja skilmála og staðfesta aldur.');
            return;
        }
        if (!username || !email || !password) {
            setError('Vinsamlegast fylltu út alla reiti.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';
            const response = await fetch(`${API_URL}/api/mobile/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    username,
                    password,
                    confirmPassword: password,
                    termsAccepted,
                    ageAccepted
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Nýskráning mistókst. Vinsamlegast reyndu aftur.');
            }

            Alert.alert(
                'Nýskráning tókst!',
                'Vinsamlegast athugaðu netfangið þitt til að staðfesta aðganginn áður en þú skráir þig inn.',
                [{ text: 'Í lagi', onPress: () => router.replace('/login') }]
            );
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 24 }} keyboardShouldPersistTaps="handled">
                <TouchableOpacity onPress={() => router.back()} className="absolute top-4 left-4 z-10 p-2">
                    <Ionicons name="arrow-back" size={24} color="#1e1b4b" />
                </TouchableOpacity>

                <Text className="text-4xl font-serif font-black mb-2 text-foreground text-center">Nýskráning</Text>
                <Text className="text-slate-500 font-sans text-center mb-8">Búðu til aðgang til að spila og safna stigum.</Text>
                
                {errorMsg && <Text className="text-red-500 mb-4 text-center font-bold">{errorMsg}</Text>}
                
                <TextInput 
                   placeholder="Notendanafn"
                   placeholderTextColor="#94a3b8"
                   value={username}
                   onChangeText={setUsername}
                   className="w-full bg-white border border-slate-200 rounded-2xl h-14 px-4 mb-4 font-sans text-lg font-semibold shadow-sm text-[#1e1b4b]"
                   style={{ paddingVertical: 0, margin: 0, includeFontPadding: false }}
                   autoCapitalize="none"
                />

                <TextInput 
                   placeholder="Netfang"
                   placeholderTextColor="#94a3b8"
                   value={email}
                   onChangeText={setEmail}
                   className="w-full bg-white border border-slate-200 rounded-2xl h-14 px-4 mb-4 font-sans text-lg font-semibold shadow-sm text-[#1e1b4b]"
                   style={{ paddingVertical: 0, margin: 0, includeFontPadding: false }}
                   autoCapitalize="none"
                   keyboardType="email-address"
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

                {/* Checkboxes */}
                <View className="w-full flex-col gap-4 mb-8">
                    <View className="flex-row items-center pr-4">
                        <TouchableOpacity 
                            onPress={() => setTermsAccepted(!termsAccepted)}
                            className={`w-6 h-6 rounded border flex items-center justify-center mr-3 ${termsAccepted ? 'bg-[#1e1b4b] border-[#1e1b4b]' : 'bg-white border-slate-300'}`}
                        >
                            {termsAccepted && <Ionicons name="checkmark" size={16} color="white" />}
                        </TouchableOpacity>
                        <Text className="text-slate-600 font-sans text-sm flex-1 flex-wrap leading-tight">
                            Ég hef lesið og samþykki {' '}
                            <Text className="text-[#1e1b4b] font-bold underline" onPress={() => openLink('https://dulur.is/is/skilmalar')}>skilmála</Text>
                            {' '}og{' '}
                            <Text className="text-[#1e1b4b] font-bold underline" onPress={() => openLink('https://dulur.is/is/personuvernd')}>persónuverndarstefnu</Text>.
                        </Text>
                    </View>

                    <View className="flex-row items-center pr-4">
                        <TouchableOpacity 
                            onPress={() => setAgeAccepted(!ageAccepted)}
                            className={`w-6 h-6 rounded border flex items-center justify-center mr-3 ${ageAccepted ? 'bg-[#1e1b4b] border-[#1e1b4b]' : 'bg-white border-slate-300'}`}
                        >
                            {ageAccepted && <Ionicons name="checkmark" size={16} color="white" />}
                        </TouchableOpacity>
                        <Text className="text-slate-600 font-sans text-sm flex-1 flex-wrap leading-tight">
                            Ég staðfesti að ég er 13 ára eða eldri.
                        </Text>
                    </View>
                </View>

                <TouchableOpacity 
                   className={`w-full p-4 rounded-xl items-center shadow-lg ${(termsAccepted && ageAccepted) ? 'bg-[#1c1917]' : 'bg-slate-300'}`}
                   onPress={handleSignup}
                   disabled={loading || !termsAccepted || !ageAccepted}
                >
                   {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-lg font-sans">Nýskráning</Text>}
                </TouchableOpacity>
                
                <View className="mt-8 flex-row justify-center items-center">
                    <Text className="text-slate-500 font-sans text-[15px]">Ertu nú þegar með aðgang? </Text>
                    <TouchableOpacity onPress={() => router.back()}>
                        <Text className="text-[#1e1b4b] font-bold font-sans text-[15px] underline">Skrá inn</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}
