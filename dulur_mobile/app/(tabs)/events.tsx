import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions, Animated as NativeAnimated, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';


const { width } = Dimensions.get('window');

export default function EventsScreen() {
    const router = useRouter();
    const [activeEvent, setActiveEvent] = useState<any | null>(null);
    const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [xp, setXp] = useState(0);
    const [xpBounce, setXpBounce] = useState(false);

    const fadeAnim = useState(new NativeAnimated.Value(0))[0];
    const slideAnim = useState(new NativeAnimated.Value(30))[0];

    const xpScale = React.useRef(new NativeAnimated.Value(1)).current;

    const xpStyle = {
        transform: [{ scale: xpScale }]
    };

    useEffect(() => {
        const loadData = async () => {
            const now = new Date().toISOString();

            const sessionPromise = supabase.auth.getSession();
            const eventsResPromise = supabase.from('special_events').select('*').eq('event_type', 'monthly').order('start_date', { ascending: true });

            const [{ data: { session } }, eventsRes] = await Promise.all([sessionPromise, eventsResPromise]);
            const user = session?.user;

            const profileRes = user ? await supabase.from('profiles').select('xp').eq('id', user.id).maybeSingle() : { data: null };

            const allEvents = eventsRes.data || [];

            const activeData = allEvents.filter(e => e.start_date <= now && e.end_date >= now);
            const upcomingData = allEvents.filter(e => e.start_date > now);

            const activeEventMatched = activeData?.find(e => (e.modifiers?._locale || 'is') === 'is') || activeData?.[0] || null;
            const upcomingMatched = upcomingData?.filter(e => (e.modifiers?._locale || 'is') === 'is') || upcomingData || [];

            setActiveEvent(activeEventMatched);
            setUpcomingEvents(upcomingMatched);
            if (profileRes.data && profileRes.data.xp) setXp(profileRes.data.xp);
            setLoading(false);

            NativeAnimated.parallel([
                NativeAnimated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
                NativeAnimated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true })
            ]).start();
        };

        loadData();

        // Listen for XP rewards specifically inside the tabs
        const sub = DeviceEventEmitter.addListener('xp-earned', (amount: number) => {
            setXp(prev => prev + amount);
            setXpBounce(true);

            NativeAnimated.sequence([
                NativeAnimated.timing(xpScale, { toValue: 1.3, duration: 150, useNativeDriver: true }),
                NativeAnimated.timing(xpScale, { toValue: 1, duration: 250, useNativeDriver: true })
            ]).start();

            setTimeout(() => setXpBounce(false), 800);
        });
        return () => sub.remove();
    }, []);

    const calculateProgress = (start: string, end: string) => {
        const startDate = new Date(start).getTime();
        const endDate = new Date(end).getTime();
        const now = new Date().getTime();
        const duration = endDate - startDate;
        const elapsed = now - startDate;
        let progress = Math.max(0, Math.min(100, (elapsed / duration) * 100));
        return progress;
    };



    return (
        <SafeAreaView className="flex-1 bg-black" edges={['top']}>
            <LinearGradient
                colors={['#0F172A', '#020617', '#000000']}
                className="absolute inset-0"
            />
            {/* Render XP pill inside the scrollview header directly for exact alignment */}

            <View className="absolute top-0 w-full h-[60%] opacity-40 mix-blend-screen" pointerEvents="none">
                <LinearGradient
                    colors={['#4338ca', 'transparent']}
                    className="absolute inset-0"
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                />
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
                <View className="w-full relative px-6 pt-12 pb-6 flex-col">
                    {xp > 0 && (
                        <View className="absolute top-12 right-6 z-10" pointerEvents="none">
                            <NativeAnimated.View style={[xpStyle]} className={`flex-row items-center gap-1.5 bg-[#EAB308] border ${xpBounce ? 'border-[#FDE047]' : 'border-[#CA8A04]'} px-3 py-1.5 rounded-[12px] shadow-sm`}>
                                <Ionicons name="star" size={14} color="white" />
                                <Text className="text-white font-black text-[13px]">{xp}</Text>
                            </NativeAnimated.View>
                        </View>
                    )}
                    <Text
                        className="text-[44px] leading-[1.1] font-white font-serif tracking-tighter text-white text-center mb-1"
                        style={{ textShadowColor: 'white', textShadowOffset: { width: 0.5, height: 0.5 }, textShadowRadius: 1 }}
                    >
                        Viðburðir.
                    </Text>
                    <Text className="text-indigo-200/60 font-bold tracking-wide text-center">Tvöfalt erfiðari áskoranir. Tvöfalt fleiri stig.</Text>
                </View>

                {loading ? (
                    <View className="flex-1 items-center justify-center pt-32">
                        <ActivityIndicator size="large" color="#818cf8" />
                    </View>
                ) : (
                    <View
                        className="px-5 w-full max-w-[600px] self-center mt-5"
                    >
                        {activeEvent ? (
                            <View className="rounded-[40px] overflow-hidden bg-slate-900 border border-white/10 shadow-2xl" style={{ shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 30, shadowOffset: { width: 0, height: 20 } }}>
                                <LinearGradient
                                    colors={['rgba(99, 102, 241, 0.25)', 'rgba(2, 6, 23, 0.95)']}
                                    className="absolute inset-0"
                                />

                                <View className="p-8">
                                    <View className="flex-row items-center justify-between mb-8">
                                        <View className="bg-indigo-500/20 p-3 rounded-2xl border border-indigo-400/30">
                                            <Ionicons name="flash" size={26} color="#c7d2fe" />
                                        </View>
                                        <View className="bg-indigo-500/90 px-4 py-1.5 rounded-full shadow-lg shadow-indigo-500/50 border border-indigo-400/50">
                                            <Text className="text-white font-black text-[11px] uppercase tracking-[2px]">Í Gangi Núna</Text>
                                        </View>
                                    </View>

                                    <Text className="font-serif font-black text-[44px] leading-[48px] text-white tracking-tighter mb-5 shadow-sm">
                                        {activeEvent.title}
                                    </Text>
                                    <Text className="text-slate-300 font-medium text-[16px] leading-7 mb-8 opacity-90">
                                        {activeEvent.description}
                                    </Text>

                                    <View className="mb-10 p-5 bg-black/40 rounded-3xl border border-white/5">
                                        <View className="flex-row justify-between mb-3">
                                            <Text className="text-slate-400 font-bold text-[11px] uppercase tracking-widest">Tími Eftir</Text>
                                            <Text className="text-indigo-300 font-bold text-[11px] uppercase tracking-widest">
                                                {new Date(activeEvent.end_date).toLocaleDateString('is-IS')}
                                            </Text>
                                        </View>
                                        <View className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                            <LinearGradient
                                                colors={['#818cf8', '#6366f1']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={{ width: `${calculateProgress(activeEvent.start_date, activeEvent.end_date)}%`, height: '100%', borderRadius: 999 }}
                                            />
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        activeOpacity={0.8}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                                            if (activeEvent && activeEvent.id) {
                                                router.push(`/game/${activeEvent.id}?isEvent=true` as any);
                                            }
                                        }}
                                    >
                                        <View className="w-full rounded-[20px] py-4 flex-row items-center justify-center bg-white shadow-xl shadow-black/20 mt-2">
                                            <Text className="text-[#0F172A] font-black text-lg mr-2">Spila</Text>
                                            <View className="bg-indigo-600 w-8 h-8 rounded-full items-center justify-center">
                                                <Ionicons name="play" size={14} color="white" style={{ marginLeft: 2 }} />
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <View className="rounded-[40px] bg-slate-900 border border-white/5 p-12 items-center justify-center mt-2 shadow-xl">
                                <View className="bg-slate-800 p-6 rounded-full border border-white/5 mb-6">
                                    <Ionicons name="moon" size={48} color="#475569" />
                                </View>
                                <Text className="text-slate-400 font-bold text-lg text-center leading-7">Engar áskoranir{'\n'}í gangi í augnablikinu.</Text>
                            </View>
                        )}

                        {upcomingEvents.length > 0 && (
                            <View className="mt-14 px-2">
                                <Text className="text-slate-500 font-black text-sm mb-6 uppercase tracking-[3px] pl-2">Næst Á Dagskrá</Text>
                                {upcomingEvents.slice(0, 1).map((event, idx) => (
                                    <View key={event.id} className="flex-row items-center bg-slate-900/60 border border-white/5 p-5 rounded-[28px] mb-4 shadow-lg">
                                        <View className="bg-slate-800/80 w-14 h-14 items-center justify-center rounded-[20px] mr-5 border border-white/5">
                                            <Ionicons name="calendar" size={24} color="#64748b" />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-slate-200 font-bold text-lg mb-1">{event.title}</Text>
                                            <Text className="text-indigo-400/80 font-bold text-sm uppercase tracking-wider">
                                                Byrjar {new Date(event.start_date).toLocaleDateString('is-IS')}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}

                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
