import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface Props {
    visible: boolean;
    onClose: () => void;
    currentDate: string;
    gameTypeBase: string;
    onSelectDate: (date: string) => void;
}

export function NativeGameArchiveCalendar({ visible, onClose, currentDate, gameTypeBase, onSelectDate }: Props) {
    const [playedDates, setPlayedDates] = useState<Record<string, { won: boolean }>>({});

    // Generate the last 14 days
    const pastDays = useMemo(() => {
        return Array.from({ length: 14 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        });
    }, []);

    useEffect(() => {
        async function fetchHistory() {
            if (!visible) return;
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

            const { data } = await supabase
                .from('game_results')
                .select('metadata, won')
                .eq('user_id', user.id)
                .like('game_type', `${gameTypeBase}%`)
                .gte('played_at', fourteenDaysAgo.toISOString());

            if (data) {
                const pd: Record<string, { won: boolean }> = {};
                data.forEach(row => {
                    const md = row.metadata as any;
                    const puzzleDateStr = md?.puzzleDate || md?.date;
                    if (puzzleDateStr) {
                        pd[puzzleDateStr] = { won: !!row.won };
                    }
                });
                setPlayedDates(pd);
            }
        }
        fetchHistory();
    }, [visible, gameTypeBase]);

    const handleSelectDate = (date: string) => {
        onClose();
        onSelectDate(date);
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/60 justify-end">
                <View className="bg-white rounded-t-3xl p-6 w-full max-h-[80%] shadow-2xl">
                    <View className="flex-row items-center justify-between mb-4 pb-4 border-b border-slate-100">
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="calendar" size={24} color="#4338CA" />
                            <Text className="text-2xl font-black font-serif text-slate-800">Fyrri leikir</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="p-2 bg-slate-100 rounded-full" activeOpacity={0.7}>
                            <Ionicons name="close" size={20} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    <Text className="text-base text-slate-500 font-medium mb-6">Veldu dagsetningu til að spila leiki sem þú misstir af. Það er aðeins hægt að spila 14 daga aftur í tímann og aðeins óspilaða leiki.</Text>

                    <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
                        <View className="flex-row flex-wrap gap-3 justify-center">
                            {pastDays.map((date, index) => {
                                const isSelected = date === currentDate;
                                const dateObj = new Date(date);
                                const dayNum = dateObj.getDate();
                                const monthName = dateObj.toLocaleDateString('is-IS', { month: 'short' });
                                const dayName = dateObj.toLocaleDateString('is-IS', { weekday: 'short' });
                                const isToday = index === 0;
                                const playStatus = playedDates[date];
                                const isLocked = !!playStatus && !isToday; // Prevent replay if already played

                                let cardStyle = 'bg-white border-slate-100';
                                let dayNameStyle = 'text-slate-400';
                                let dayNumStyle = 'text-slate-800';
                                let bottomTextStyle = 'text-slate-400';
                                let bottomTextContent = monthName;

                                if (isSelected && !playStatus) {
                                    cardStyle = 'bg-[#4338CA] border-[#4338CA] shadow-md shadow-indigo-200';
                                    dayNameStyle = 'text-indigo-100';
                                    dayNumStyle = 'text-white';
                                    bottomTextStyle = 'text-indigo-200';
                                } else if (playStatus) {
                                    if (playStatus.won) {
                                        cardStyle = isSelected ? 'bg-emerald-500 border-emerald-600 shadow-md shadow-emerald-200' : 'bg-emerald-50 border-emerald-200 opacity-90';
                                        dayNameStyle = isSelected ? 'text-emerald-100' : 'text-emerald-600';
                                        dayNumStyle = isSelected ? 'text-white' : 'text-emerald-700';
                                        bottomTextStyle = isSelected ? 'text-emerald-200' : 'text-emerald-600';
                                        bottomTextContent = '✅ Sigur';
                                    } else {
                                        cardStyle = isSelected ? 'bg-rose-500 border-rose-600 shadow-md shadow-rose-200' : 'bg-rose-50 border-rose-200 opacity-90';
                                        dayNameStyle = isSelected ? 'text-rose-100' : 'text-rose-600';
                                        dayNumStyle = isSelected ? 'text-white' : 'text-rose-700';
                                        bottomTextStyle = isSelected ? 'text-rose-200' : 'text-rose-600';
                                        bottomTextContent = '❌ Tap';
                                    }
                                } else if (isToday) {
                                    cardStyle = 'bg-indigo-50 border-indigo-200';
                                } else if (isLocked) {
                                    cardStyle = 'bg-slate-50 border-slate-200 opacity-60';
                                }

                                return (
                                    <TouchableOpacity
                                        key={date}
                                        activeOpacity={isLocked ? 1 : 0.7}
                                        onPress={() => {
                                            if (!isLocked) handleSelectDate(date);
                                        }}
                                        className={`w-[30%] aspect-square rounded-2xl items-center justify-center border-2 ${cardStyle}`}
                                    >
                                        <Text className={`text-xs font-bold uppercase mb-1 ${dayNameStyle}`}>
                                            {isToday ? 'Í dag' : dayName}
                                        </Text>
                                        <Text className={`text-2xl font-black ${dayNumStyle}`}>
                                            {dayNum}
                                        </Text>
                                        <Text className={`text-[10px] font-bold uppercase mt-0.5 ${bottomTextStyle}`}>
                                            {bottomTextContent}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}


