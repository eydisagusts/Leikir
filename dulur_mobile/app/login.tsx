import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import { FontAwesome5 } from '@expo/vector-icons';

// Essential for iOS/Android WebView return resolution
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setError] = useState<string|null>(null);
    const [debugUrl, setDebugUrl] = useState<string>('');
    const router = useRouter();

    React.useEffect(() => {
        setDebugUrl(Linking.createURL('auth'));
    }, []);

    const handleLogin = async () => {
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        setLoading(false);
    };

    const handleOAuthLogin = async (provider: 'google' | 'facebook') => {
        setLoading(true);
        setError(null);
        
        try {
            // Force the router link path natively 
            const redirectUrl = Linking.createURL('auth');
            
            // NOTE TO DEV: This is the EXACT URL that must be added to Supabase. 
            // Often "exp://*" fails to catch inner slashes.
            console.log("Supabase Auth Redirect URL generated: ", redirectUrl);

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: provider,
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true,
                },
            });

            if (error) throw error;

            if (data?.url) {
                const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
                
                if (res.type === 'success' && res.url) {
                    const rawUrl = res.url.replace('#', '?');
                    const accessTokenMatch = rawUrl.match(/access_token=([^&]+)/);
                    const refreshTokenMatch = rawUrl.match(/refresh_token=([^&]+)/);
                    
                    if (accessTokenMatch && refreshTokenMatch) {
                        const { error: sessionErr } = await supabase.auth.setSession({ 
                            access_token: accessTokenMatch[1], 
                            refresh_token: refreshTokenMatch[1] 
                        });
                        if (sessionErr) throw sessionErr;
                    }
                }
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
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

            <View className="flex-row items-center w-full my-8">
                <View className="flex-1 h-[1px] bg-slate-200" />
                <Text className="text-slate-500 font-sans font-semibold px-4 text-sm">eða skrá inn með</Text>
                <View className="flex-1 h-[1px] bg-slate-200" />
            </View>

            <View className="flex-row items-center justify-between w-full gap-4">
                <TouchableOpacity 
                   className="flex-1 bg-white border border-slate-200 p-4 rounded-xl flex-row justify-center items-center shadow-sm"
                   onPress={() => handleOAuthLogin('google')}
                   disabled={loading}
                >
                   <FontAwesome5 name="google" size={18} color="#db4437" />
                   <Text className="text-slate-700 font-bold ml-2 text-[15px]">Google</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                   className="flex-1 bg-white border border-slate-200 p-4 rounded-xl flex-row justify-center items-center shadow-sm"
                   onPress={() => handleOAuthLogin('facebook')}
                   disabled={loading}
                >
                   <FontAwesome5 name="facebook" size={18} color="#1877f2" />
                   <Text className="text-slate-700 font-bold ml-2 text-[15px]">Facebook</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
