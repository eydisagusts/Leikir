import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';

export default function EventsScreen() {
    const router = useRouter();
    const [activeEvent, setActiveEvent] = useState<any | null>(null);
    const [upcomingEvent, setUpcomingEvent] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEvents = async () => {
            const now = new Date().toISOString();

            // Fetch Active Event
            let { data: activeData } = await supabase
                .from('special_events')
                .select('*')
                .eq('event_type', 'monthly')
                .lte('start_date', now)
                .gte('end_date', now)
                .order('start_date', { ascending: false });

            // Fetch Upcoming Event
            let { data: upcomingData } = await supabase
                .from('special_events')
                .select('*')
                .eq('event_type', 'monthly')
                .gt('start_date', now)
                .order('start_date', { ascending: true });

            // Filter for locales (defaulting to 'is' matching Web Logic)
            const activeEventMatched = activeData?.find(e => (e.modifiers?._locale || 'is') === 'is') || activeData?.[0] || null;
            const upcomingEventMatched = upcomingData?.find(e => (e.modifiers?._locale || 'is') === 'is') || upcomingData?.[0] || null;

            setActiveEvent(activeEventMatched);
            setUpcomingEvent(upcomingEventMatched);
            setLoading(false);
        };
        fetchEvents();
    }, []);

    return (
        <SafeAreaView className="flex-1 bg-[#FAFAFA]" edges={['top']}>
            <View className="absolute inset-0 pointer-events-none">
                <View className="absolute top-[-5%] left-[-20%] w-[300px] h-[300px] bg-indigo-500/15 rounded-full" />
                <View className="absolute top-[15%] right-[-20%] w-[400px] h-[400px] bg-purple-500/15 rounded-full" />
                <BlurView intensity={100} tint="light" className="absolute inset-0" />
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                
                {/* Header */}
                <View className="px-6 pt-16 pb-8 items-center justify-center relative z-10">
                    <Text className="text-[52px] leading-[1.1] font-black font-serif tracking-tighter text-[#1e1b4b] text-center uppercase">Viðburðir</Text>
                    <Text className="text-[18px] font-medium font-serif italic text-slate-500 mt-2 tracking-wide text-center px-4">Mánaðarlegar áskoranir. Tvöfalt erfiðari, tvöfalt fleiri stig við sigur!</Text>
                </View>

                {loading ? (
                    <View className="flex-1 items-center justify-center pt-20">
                        <ActivityIndicator size="large" color="#1e1b4b" />
                    </View>
                ) : (
                    <View className="px-5 w-full self-center max-w-[600px] relative z-10 gap-6">
                        
                        {/* Current Event Card */}
                        {activeEvent ? (
                            <View className="bg-white border border-white/60 rounded-[32px] p-8 overflow-hidden" style={{ elevation: 10, shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20 }}>
                                <View className="flex-row items-center justify-between mb-6">
                                    <View className="w-14 h-14 bg-indigo-50/80 rounded-2xl items-center justify-center border border-indigo-100">
                                        <Ionicons name="star" size={28} color="#6366f1" />
                                    </View>
                                    <View className="bg-indigo-100 px-3 py-1.5 rounded-full">
                                        <Text className="text-indigo-700 font-bold text-[12px] uppercase tracking-widest">Í gangi núna!</Text>
                                    </View>
                                </View>
                                
                                <Text className="font-serif font-black text-3xl text-[#1e1b4b] mb-3 tracking-tight">{activeEvent.title}</Text>
                                <Text className="text-slate-500 font-medium text-[16px] mb-8 leading-6">{activeEvent.description}</Text>
                                
                                <View className="bg-indigo-50 border border-indigo-100/50 px-5 py-4 rounded-[20px] flex-row items-center">
                                    <Ionicons name="time-outline" size={22} color="#4f46e5" />
                                    <Text className="ml-3 font-bold text-indigo-900 text-[15px]">
                                        Lýkur {new Date(activeEvent.end_date).toLocaleDateString('is-IS')}
                                    </Text>
                                </View>

                                <TouchableOpacity 
                                    className="w-full bg-indigo-600 rounded-2xl py-4 mt-6 flex-row items-center justify-center shadow-lg shadow-indigo-600/30"
                                    onPress={() => router.push({ pathname: '/game/[id]', params: { id: activeEvent.id, isEvent: 'true' } as any })}
                                >
                                    <Text className="text-white font-black uppercase tracking-widest text-[15px]">Spila áskorun</Text>
                                    <Ionicons name="arrow-forward" size={18} color="white" className="ml-2" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View className="bg-white/50 border border-[#D3D6DA]/30 rounded-[32px] p-8 items-center">
                                <Text className="text-slate-400 font-bold text-center">Enginn viðburður í gangi í augnablikinu.</Text>
                            </View>
                        )}

                        {/* Upcoming Event Card */}
                        {upcomingEvent && (
                            <View className="bg-white/80 border border-[#D3D6DA]/50 rounded-[32px] p-8 mt-2 opacity-95" style={{ shadowColor: '#a855f7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 }}>
                                <View className="flex-row items-center justify-between mb-6">
                                    <View className="w-14 h-14 bg-purple-50/80 rounded-2xl items-center justify-center border border-purple-100">
                                        <Ionicons name="calendar-clear" size={28} color="#a855f7" />
                                    </View>
                                    <View className="bg-purple-100 px-3 py-1.5 rounded-full">
                                        <Text className="text-purple-700 font-bold text-[12px] uppercase tracking-widest">Næsti viðburður</Text>
                                    </View>
                                </View>
                                
                                <Text className="font-serif font-black text-2xl text-[#1e1b4b] mb-3 tracking-tight opacity-90">{upcomingEvent.title}</Text>
                                <Text className="text-slate-500 font-medium text-[15px] mb-8 leading-6 opacity-80">{upcomingEvent.description}</Text>
                                
                                <View className="bg-slate-50 border border-slate-200/60 px-5 py-4 rounded-[20px] flex-row items-center">
                                    <Ionicons name="calendar-outline" size={22} color="#64748b" />
                                    <Text className="ml-3 font-bold text-slate-700 text-[15px]">
                                        Byrjar {new Date(upcomingEvent.start_date).toLocaleDateString('is-IS')}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
