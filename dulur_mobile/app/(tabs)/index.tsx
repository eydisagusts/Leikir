import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, DeviceEventEmitter, Alert, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import Svg, { Path, Circle, Polyline, Rect, Text as SvgText, G } from 'react-native-svg';
import { GataWidget } from '@/components/GataWidget';

const { width } = Dimensions.get('window');

const isDulmalNew = new Date() < new Date('2026-06-04');

const BASE_GAMES = [
    { id: 'ordla', name: 'Orðla', desc: 'Finndu orð dagsins í minna en sex tilraunum.', iconType: 'ordla', badge: null },
    { id: 'hengimadur', name: 'Hengimaður', desc: 'Bjargaðu karlinum úr snörunni með því að giska á stafina í orðinu.', iconType: 'hengimadur', badge: null },
    { id: 'sudoku', name: 'Sudoku', desc: 'Settu tölustafina í réttan reit.', iconType: 'sudoku', badge: null },
    { id: 'samhengi', name: 'Samhengi', desc: 'Finndu leyniorðið með því að giska á orð sem tengjast því í samhengi.', iconType: 'samhengi', badge: 'ÁSKRIFT' },
    { id: 'krossreikningur', name: 'Krossreikningur', desc: 'Leystu stærðfræðiþrautir í kross.', iconType: 'krossreikningur', badge: 'ÁSKRIFT' },
    { id: 'dulmal', name: 'Dulmál', desc: 'Dulkóðaður málsháttur.', iconType: 'dulmal', badge: isDulmalNew ? 'NÝTT' : 'ÁSKRIFT' },
    { id: 'tengingar', name: 'Tengingar', desc: 'Finndu fjóra flokka með fjórum orðum sem tengjast.', iconType: 'tengingar', badge: 'ÁSKRIFT' },
    { id: 'myndagata', name: 'Myndagáta', desc: 'Teiknaðu myndina með því að fylla út í reitina samkvæmt tölunum.', iconType: 'myndagata', badge: 'ÁSKRIFT' },
    { id: 'straumur', name: 'Straumur', desc: 'Dragðu yfir stafina til að finna orðin. Líkt stafarugli en hver stafur tilheyrir orði.', iconType: 'straumur', badge: 'ÁSKRIFT' },
    { id: 'sprengjuleit', name: 'Sprengjuleit', desc: 'Finndu földu sprengjurnar.', iconType: 'sprengjuleit', badge: 'ÁSKRIFT' },
    { id: 'krossgata', name: 'Krossgáta', desc: 'Klassísk krossgáta', iconType: 'krossgata', badge: 'ÁSKRIFT' },
    { id: 'stafarugl', name: 'Stafarugl', desc: 'Finndu orðin í stafaruglinu.', iconType: 'stafarugl', badge: 'ÁSKRIFT' },
    { id: 'kviss', name: 'Kviss', desc: 'Svaraðu fimm spennandi spurningum dagsins.', iconType: 'kviss', badge: 'ÁSKRIFT' },
    { id: 'litakodi', name: 'Litakóði', desc: 'Reyndu að finna réttan litakóða í 6 eða færri tilraunum.', iconType: 'litakodi', badge: 'ÁSKRIFT' },
    { id: 'minnisspil', name: 'Minnisspil', desc: 'Finndu öll pörin í sem fæstum tilraunum.', iconType: 'minnisspil', badge: null }
];

const GAMES = BASE_GAMES;

const GAME_IMAGES: Record<string, any> = {
    'ordla': require('../../assets/images/games/dulur-ordla.png'),
    'hengimadur': require('../../assets/images/games/dulur_hengimadur.png'),
    'sudoku': require('../../assets/images/games/dulur_sudoku.png'),
    'samhengi': require('../../assets/images/games/dulur_samhengi.png'),
    'krossreikningur': require('../../assets/images/games/dulur_krossreikningur.png'),
    'tengingar': require('../../assets/images/games/dulur_tengingar.png'),
    'myndagata': require('../../assets/images/games/dulur_myndagata.png'),
    'straumur': require('../../assets/images/games/dulur_straumur.png'),
    'sprengjuleit': require('../../assets/images/games/dulur_sprengjuleit.png'),
    'krossgata': require('../../assets/images/games/dulur_krossgata.png'),
    'stafarugl': require('../../assets/images/games/dulur-stafarugl.png'),
    'kviss': require('../../assets/images/games/dulur_kviss.png'),
    'litakodi': require('../../assets/images/games/dulur_litakodi.png'),
    'minnisspil': require('../../assets/images/games/dulur_minnisspil.png'),
    'dulmal': require('../../assets/images/games/dulur_dulmal.png'),
};



const GameGraphic = React.memo(({ type }: { type: string }) => {
    const imgSrc = GAME_IMAGES[type];
    
    if (imgSrc) {
        return (
            <View className="absolute inset-0 bg-white items-center justify-center overflow-hidden">
                <Image source={imgSrc} style={{ height: '92%', aspectRatio: 1, resizeMode: 'cover', borderRadius: 28 }} />
            </View>
        );
    }

    if (type === 'ordla') {
        const row1 = [
            { char: 'S', color: '#3A3A3C' }, { char: 'P', color: '#3A3A3C' },
            { char: 'I', color: '#3A3A3C' }, { char: 'L', color: '#538D4E' },
            { char: 'A', color: '#538D4E' }
        ];
        const row2 = ['O', 'R', 'Ð', 'L', 'A'];
        return (
            <View className="absolute inset-0 bg-[#FAFAFA] items-center justify-center">
                <View className="w-[45%] aspect-[5/6] max-w-[80px] flex-row flex-wrap justify-between" style={{ gap: 2 }}>
                    {row1.map((c, i) => (
                        <View key={`r1-${i}`} style={{ backgroundColor: c.color, width: '18%', aspectRatio: 1, borderRadius: 2, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 10 }}>{c.char}</Text>
                        </View>
                    ))}
                    {row2.map((c, i) => (
                        <View key={`r2-${i}`} style={{ backgroundColor: '#538D4E', width: '18%', aspectRatio: 1, borderRadius: 2, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 10 }}>{c}</Text>
                        </View>
                    ))}
                    {Array.from({ length: 20 }).map((_, i) => (
                        <View key={`b-${i}`} style={{ backgroundColor: 'white', width: '18%', aspectRatio: 1, borderRadius: 2, borderColor: '#D3D6DA', borderWidth: 1.5, opacity: 0.4, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 10 }}> </Text>
                        </View>
                    ))}
                </View>
            </View>
        );
    }

    if (type === 'hengimadur') {
        return (
            <View className="absolute inset-0 bg-[#EBF0F5] items-center justify-center">
                <Svg viewBox="0 0 100 100" width="60%" height="60%" style={{ overflow: 'visible' }}>
                    <Path d="M20 90 L80 90 M30 90 L30 20 L60 20 L60 35" fill="none" stroke="#1A2B4C" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                    <Circle cx="60" cy="45" r="10" fill="none" stroke="#1A2B4C" strokeWidth="6" />
                </Svg>
            </View>
        );
    }

    if (type === 'stafarugl') {
        const letters = ['R', 'Ú', 'B', 'S', 'A', 'O', 'P', 'V', 'Ð', 'I', 'M', 'N', 'E', 'L', 'A', 'F'];
        const highs = [12, 9, 6, 3];
        return (
            <View className="absolute inset-0 bg-[#F2F2F2] items-center justify-center">
                <View className="w-[65%] aspect-square max-w-[105px] bg-white rounded-lg shadow-sm flex-row flex-wrap border border-black/5 overflow-hidden" style={{ elevation: 2 }}>
                    <Svg style={{ position: 'absolute', zIndex: 0 }} className="w-full h-full" viewBox="0 0 100 100">
                        <Path d="M12.5 87.5 L87.5 12.5" fill="none" stroke="#E3E3E3" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    {letters.map((l, i) => (
                        <View key={i} style={{ width: '25%', height: '25%', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                            <Text style={{ fontFamily: 'serif', fontWeight: 'bold', fontSize: 13, color: highs.includes(i) ? '#1A2B4C' : '#A0A0A0' }}>{l}</Text>
                        </View>
                    ))}
                </View>
            </View>
        );
    }

    if (type === 'samhengi') {
        return (
            <View className="absolute inset-0 bg-[#FAFAFA] flex-col items-center justify-center p-4">
                <View className="w-full max-w-[80%] h-6 bg-white border-2 border-[#1E8E3E]/20 rounded-full flex-row items-center px-3 mb-2">
                    <View className="w-4 h-4 rounded-full bg-[#1E8E3E]/40" />
                </View>
                <View className="w-full max-w-[80%] h-4 bg-green-500/20 rounded-sm overflow-hidden flex-row mb-2">
                    <View className="w-[90%] bg-green-500 h-full" />
                </View>
                <View className="w-full max-w-[80%] h-4 bg-yellow-500/20 rounded-sm overflow-hidden flex-row mb-2">
                    <View className="w-[40%] bg-yellow-500 h-full" />
                </View>
                <View className="w-full max-w-[80%] h-4 bg-red-500/20 rounded-sm overflow-hidden flex-row">
                    <View className="w-[15%] bg-red-500 h-full" />
                </View>
            </View>
        );
    }

    if (type === 'myndagata') {
        return (
            <View className="absolute inset-0 bg-[#F3F4F6] items-center justify-center p-4 overflow-hidden">
                <View className="w-[75%] aspect-square max-w-[140px] flex-row" style={{ transform: [{ translateX: -12 }, { translateY: -12 }] }}>
                    {/* Left Numbers */}
                    <View className="w-[25%] flex-col pr-1.5">
                        <View className="h-[25%]" />
                        <View className="h-[75%] flex-col">
                            <View className="flex-1 items-end justify-center"><Text style={{ fontSize: 7, fontWeight: 'bold', color: '#4B5563' }}>3</Text></View>
                            <View className="flex-1 items-end justify-center flex-row gap-[1px]"><Text style={{ fontSize: 7, fontWeight: 'bold', color: '#4B5563' }}>1</Text><Text style={{ fontSize: 7, fontWeight: 'bold', color: '#4B5563' }}>1</Text></View>
                            <View className="flex-1 items-end justify-center"><Text style={{ fontSize: 7, fontWeight: 'bold', color: '#4B5563' }}>4</Text></View>
                            <View className="flex-1 items-end justify-center"><Text style={{ fontSize: 7, fontWeight: 'bold', color: '#4B5563' }}>2</Text></View>
                        </View>
                    </View>
                    <View className="w-[75%] flex-col">
                        {/* Top Numbers */}
                        <View className="h-[25%] flex-row items-end pl-1 pb-1">
                            <View className="w-1/4 items-center flex-col"><Text style={{ fontSize: 7, fontWeight: 'bold', color: '#4B5563' }}>3</Text></View>
                            <View className="w-1/4 items-center flex-col"><Text style={{ fontSize: 7, fontWeight: 'bold', color: '#4B5563' }}>1</Text><Text style={{ fontSize: 7, fontWeight: 'bold', color: '#4B5563' }}>2</Text></View>
                            <View className="w-1/4 items-center flex-col"><Text style={{ fontSize: 7, fontWeight: 'bold', color: '#4B5563' }}>1</Text><Text style={{ fontSize: 7, fontWeight: 'bold', color: '#4B5563' }}>2</Text></View>
                            <View className="w-1/4 items-center flex-col"><Text style={{ fontSize: 7, fontWeight: 'bold', color: '#4B5563' }}>2</Text></View>
                        </View>
                        {/* Grid */}
                        <View className="h-[75%] flex-row flex-wrap bg-white border-2 border-gray-800">
                            {/* Row 1 */}
                            <View className="w-1/4 h-1/4 bg-[#2D4A3E] border-[0.5px] border-gray-300" /><View className="w-1/4 h-1/4 bg-[#2D4A3E] border-[0.5px] border-gray-300" /><View className="w-1/4 h-1/4 bg-[#2D4A3E] border-[0.5px] border-gray-300" /><View className="w-1/4 h-1/4 border-[0.5px] border-gray-300" />
                            {/* Row 2 */}
                            <View className="w-1/4 h-1/4 bg-[#2D4A3E] border-[0.5px] border-gray-300" /><View className="w-1/4 h-1/4 border-[0.5px] border-gray-300 items-center justify-center"><Text style={{ fontSize: 6, color: '#D1D5DB', fontWeight: 'bold' }}>X</Text></View><View className="w-1/4 h-1/4 border-[0.5px] border-gray-300 items-center justify-center"><Text style={{ fontSize: 6, color: '#D1D5DB', fontWeight: 'bold' }}>X</Text></View><View className="w-1/4 h-1/4 bg-[#2D4A3E] border-[0.5px] border-gray-300" />
                            {/* Row 3 */}
                            <View className="w-1/4 h-1/4 bg-[#2D4A3E] border-[0.5px] border-gray-300" /><View className="w-1/4 h-1/4 bg-[#2D4A3E] border-[0.5px] border-gray-300" /><View className="w-1/4 h-1/4 bg-[#2D4A3E] border-[0.5px] border-gray-300" /><View className="w-1/4 h-1/4 bg-[#2D4A3E] border-[0.5px] border-gray-300" />
                            {/* Row 4 */}
                            <View className="w-1/4 h-1/4 border-[0.5px] border-gray-300" /><View className="w-1/4 h-1/4 bg-[#2D4A3E] border-[0.5px] border-gray-300" /><View className="w-1/4 h-1/4 bg-[#2D4A3E] border-[0.5px] border-gray-300" /><View className="w-1/4 h-1/4 border-[0.5px] border-gray-300" />
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    if (type === 'tengingar') {
        return (
            <View className="absolute inset-0 bg-[#E8E6E3] items-center justify-center">
                <View className="w-[70%] max-w-[100px] justify-between h-[60%] py-2">
                    {['#F2C960', '#A0C35A', '#B1C4E0', '#BA81C5'].map((color, i) => (
                        <View key={i} style={{ backgroundColor: color, height: '21%', borderRadius: 4, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.1)', marginHorizontal: 2 }} />
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.1)', marginHorizontal: 2 }} />
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.1)', marginHorizontal: 2 }} />
                        </View>
                    ))}
                </View>
            </View>
        );
    }

    if (type === 'sudoku') {
        const realGrid = [
            [5, 3, 0, 0, 7, 0, 0, 0, 0], [6, 0, 0, 1, 9, 5, 0, 0, 0], [0, 9, 8, 0, 0, 0, 0, 6, 0],
            [8, 0, 0, 0, 6, 0, 0, 0, 3], [4, 0, 0, 8, 0, 3, 0, 0, 1], [7, 0, 0, 0, 2, 0, 0, 0, 6],
            [0, 6, 0, 0, 0, 0, 2, 8, 0], [0, 0, 0, 4, 1, 9, 0, 0, 5], [0, 0, 0, 0, 8, 0, 0, 7, 9]
        ];
        return (
            <View className="absolute inset-0 bg-[#EAEAEA] items-center justify-center">
                <View className="h-[85%] aspect-square max-w-[130px] bg-[#FAFAFA] flex-col border-[1.5px] border-[#1A1A1B]" style={{ elevation: 2 }}>
                    {realGrid.map((row, r) => (
                        <View key={`r-${r}`} style={{ flex: 1, flexDirection: 'row' }}>
                            {row.map((num, c) => {
                                const isBottomThick = r % 3 === 2 && r !== 8;
                                const isRightThick = c % 3 === 2 && c !== 8;
                                return (
                                    <View
                                        key={`c-${c}`}
                                        style={{
                                            flex: 1,
                                            borderBottomWidth: isBottomThick ? 1.5 : (r !== 8 ? 0.5 : 0),
                                            borderRightWidth: isRightThick ? 1.5 : (c !== 8 ? 0.5 : 0),
                                            borderBottomColor: isBottomThick ? '#1A1A1B' : '#D3D6DA',
                                            borderRightColor: isRightThick ? '#1A1A1B' : '#D3D6DA',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        {num > 0 && <Text style={{ fontSize: 6, fontWeight: '900', fontFamily: 'serif', color: '#1A1A1B' }}>{num}</Text>}
                                    </View>
                                );
                            })}
                        </View>
                    ))}
                </View>
            </View>
        );
    }

    if (type === 'krossgata') {
        return (
            <View className="absolute inset-0 bg-[#EAEAEA] items-center justify-center">
                <View className="w-[85%] max-w-[130px] aspect-[7/5] bg-[#EAEAEA] border-[1.5px] border-black shadow flex-row flex-wrap justify-between" style={{ alignContent: 'space-between' }}>
                    {Array.from({ length: 35 }).map((_, i) => {
                        const isBlack = [3, 6, 12, 17, 21, 27, 33].includes(i);
                        const isYellow = i === 18;
                        const label = { 0: '1', 1: '2', 2: '3', 4: '4', 5: '5', 8: '6', 11: '7', 15: '8', 19: '9', 23: '10', 26: '11', 30: '12' };
                        return (
                            <View key={i} style={{ width: '14%', height: '19%', backgroundColor: isBlack ? 'black' : isYellow ? '#FFF4B3' : 'white', borderWidth: 0.5, borderColor: '#555', position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
                                {/* @ts-ignore */}
                                {!isBlack && label[i] && <Text style={{ position: 'absolute', top: 1, left: 1, fontSize: 4, color: '#333' }}>{label[i]}</Text>}
                                {isYellow && <Text style={{ fontFamily: 'serif', fontWeight: '900', color: 'black', fontSize: 10 }}>K</Text>}
                            </View>
                        );
                    })}
                </View>
            </View>
        );
    }

    if (type === 'straumur') {
        const letters = ['L', 'E', 'Þ', 'F', 'N', 'I', 'K', 'T', 'O', 'M', 'U', 'R', 'B', 'Á', 'S', 'E'];
        const highs = [0, 1, 5, 6, 10, 11];
        return (
            <View className="absolute inset-0 bg-[#E5F1F1] items-center justify-center">
                <View className="w-[65%] aspect-square max-w-[105px] bg-white rounded-xl shadow border border-black/5 flex-row flex-wrap overflow-hidden" style={{ elevation: 2 }}>
                    <Svg style={{ position: 'absolute', zIndex: 0 }} className="w-full h-full" viewBox="0 0 100 100">
                        <Path d="M12.5 12.5 L37.5 12.5 L37.5 37.5 L62.5 37.5 L62.5 62.5 L87.5 62.5" fill="none" stroke="#BFE5E3" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    {letters.map((l, i) => (
                        <View key={i} style={{ width: '25%', height: '25%', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                            <Text style={{ fontWeight: 'black', fontSize: 13, color: highs.includes(i) ? '#1E3F32' : '#88AFA0' }}>{l}</Text>
                        </View>
                    ))}
                </View>
            </View>
        );
    }

    if (type === 'sprengjuleit') {
        return (
            <View className="absolute inset-0 bg-[#F5F5F5] items-center justify-center">
                <View className="w-[60%] aspect-square max-w-[100px] bg-[#E0E0E0] border border-[#B0B0B0] flex-row flex-wrap shadow-sm">
                    {Array.from({ length: 25 }).map((_, i) => {
                        const isRedMine = i === 12;
                        const isRevMine = i === 3 || i === 24;
                        const isRevBlank = [6, 7, 8, 11, 13, 16, 17, 18].includes(i);
                        let num = ''; if (i === 7) num = '1'; if (i === 8) num = '2'; if (i === 11) num = '3'; if (i === 13) num = '2'; if (i === 17) num = '1';

                        let style: any = { width: '20%', height: '20%', borderWidth: 0.5, borderColor: '#aaa', alignItems: 'center', justifyContent: 'center' };
                        if (isRedMine) { style.backgroundColor = '#ef4444'; }
                        else if (isRevMine || isRevBlank) { style.backgroundColor = '#F0F0F0'; style.borderColor = 'rgba(0,0,0,0.1)'; }
                        else {
                            style.backgroundColor = '#D0D0D0';
                            style.borderTopWidth = 1.5; style.borderLeftWidth = 1.5; style.borderTopColor = 'white'; style.borderLeftColor = 'white';
                        }
                        return (
                            <View key={i} style={style}>
                                {(isRedMine || isRevMine) && <Text style={{ fontSize: 9 }}>💣</Text>}
                                {num !== '' && <Text style={{ fontSize: 9, fontWeight: 'bold', color: num === '1' ? '#1A73E8' : num === '2' ? '#1E8E3E' : '#D93025' }}>{num}</Text>}
                            </View>
                        );
                    })}
                </View>
            </View>
        );
    }

    if (type === 'kviss') {
        return (
            <View className="absolute inset-0 bg-[#F4F2F7] items-center justify-center">
                <View className="w-[60%] max-w-[100px] aspect-[3/2] bg-white rounded-lg shadow border border-black/5 items-center justify-center" style={{ elevation: 2 }}>
                    <Text className="text-3xl font-serif font-black text-[#4A148C]">?</Text>
                </View>
            </View>
        );
    }

    if (type === 'litakodi') {
        const colors = ['#ef4444', '#3b82f6', '#10b981', '#eab308'];
        return (
            <View className="absolute inset-0 bg-[#E5E5E5] items-center justify-center">
                <View className="w-[70%] max-w-[110px] aspect-[2/1] bg-white rounded-lg shadow-sm border border-black/5 flex-row items-center justify-evenly" style={{ elevation: 2 }}>
                    {colors.map((c, i) => (
                        <View key={i} style={{ backgroundColor: c, width: '18%', aspectRatio: 1, borderRadius: 100, elevation: 1 }} />
                    ))}
                </View>
            </View>
        );
    }

    if (type === 'minnisspil') {
        return (
            <View className="absolute inset-0 bg-[#DDF4FD] items-center justify-center">
                <View className="w-[60%] max-w-[100px] aspect-square flex-row flex-wrap justify-between" style={{ alignContent: 'space-between' }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <View key={i} className="w-[45%] h-[45%] bg-white rounded flex items-center justify-center border border-black/5 shadow-sm" style={{ elevation: 1 }}>
                            {i === 1 || i === 2 ? <Ionicons name="star" size={16} color="#0EA5E9" /> : null}
                        </View>
                    ))}
                </View>
            </View>
        );
    }

    if (type === '2048') {
        return (
            <View className="absolute inset-0 bg-[#bbada0] items-center justify-center">
                <View className="w-[65%] aspect-square flex-row flex-wrap justify-between p-1 bg-[#a6998d] rounded-md" style={{ gap: 2 }}>
                    {[2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 0, 0, 0, 0, 0].map((val, i) => (
                        <View key={i} className="rounded-[2px] items-center justify-center" style={{ width: '22%', aspectRatio: 1, backgroundColor: val > 0 ? '#f2b179' : '#cdc1b4' }}>
                            {val > 0 && <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 6 }}>{val}</Text>}
                        </View>
                    ))}
                </View>
            </View>
        );
    }

    if (type === 'flaedi') {
        return (
            <View className="absolute inset-0 bg-[#0f172a] items-center justify-center">
                <View className="w-[65%] aspect-square flex-row flex-wrap justify-between p-1 bg-[#1e293b] rounded-md border-2 border-[#334155]" style={{ gap: 1 }}>
                    {Array.from({ length: 16 }).map((_, i) => (
                        <View key={i} className="border border-[#334155]/50" style={{ width: '23%', aspectRatio: 1 }} />
                    ))}
                </View>
            </View>
        );
    }

    if (type === 'krossreikningur') {
        const C = 34; // Cell size
        return (
            <View className="absolute inset-0 bg-[#E8F0FE] items-center justify-center">
                <View className="shadow-lg" style={{ transform: [{ rotate: '-2deg' }], width: C*5, height: C*3 }}>
                    <Svg width="100%" height="100%" viewBox={`0 0 ${C*5} ${C*3}`}>
                        <G>
                            {/* Row 1 */}
                            <Rect x={0} y={0} width={C} height={C} fill="white" stroke="#1e293b" strokeWidth={1} />
                            <SvgText x={C/2} y={C/2 + 5} fontSize={14} fontWeight="bold" fill="#10b981" textAnchor="middle">8</SvgText>
                            
                            <Rect x={C} y={0} width={C} height={C} fill="#FFF8E7" stroke="#1e293b" strokeWidth={1} />
                            <SvgText x={C + C/2} y={C/2 + 5} fontSize={14} fontWeight="bold" fill="#0f172a" textAnchor="middle">+</SvgText>
                            
                            <Rect x={C*2} y={0} width={C} height={C} fill="white" stroke="#1e293b" strokeWidth={1} />
                            <SvgText x={C*2 + C/2} y={C/2 + 5} fontSize={14} fontWeight="bold" fill="#10b981" textAnchor="middle">4</SvgText>
                            
                            <Rect x={C*3} y={0} width={C} height={C} fill="#FFF8E7" stroke="#1e293b" strokeWidth={1} />
                            <SvgText x={C*3 + C/2} y={C/2 + 5} fontSize={14} fontWeight="bold" fill="#0f172a" textAnchor="middle">=</SvgText>
                            
                            <Rect x={C*4} y={0} width={C} height={C} fill="#FFF8E7" stroke="#1e293b" strokeWidth={1} />
                            <SvgText x={C*4 + C/2} y={C/2 + 5} fontSize={14} fontWeight="bold" fill="#0f172a" textAnchor="middle">12</SvgText>

                            {/* Row 2 */}
                            <Rect x={0} y={C} width={C} height={C} fill="#FFF8E7" stroke="#1e293b" strokeWidth={1} />
                            <SvgText x={C/2} y={C + C/2 + 5} fontSize={14} fontWeight="bold" fill="#0f172a" textAnchor="middle">-</SvgText>
                            
                            <Rect x={C*2} y={C} width={C} height={C} fill="#FFF8E7" stroke="#1e293b" strokeWidth={1} />
                            <SvgText x={C*2 + C/2} y={C + C/2 + 5} fontSize={14} fontWeight="bold" fill="#0f172a" textAnchor="middle">-</SvgText>

                            {/* Row 3 */}
                            <Rect x={0} y={C*2} width={C} height={C} fill="white" stroke="#1e293b" strokeWidth={1} />
                            <SvgText x={C/2} y={C*2 + C/2 + 5} fontSize={14} fontWeight="bold" fill="#10b981" textAnchor="middle">3</SvgText>
                            
                            <Rect x={C} y={C*2} width={C} height={C} fill="#FFF8E7" stroke="#1e293b" strokeWidth={1} />
                            <SvgText x={C + C/2} y={C*2 + C/2 + 5} fontSize={14} fontWeight="bold" fill="#0f172a" textAnchor="middle">=</SvgText>
                            
                            <Rect x={C*2} y={C*2} width={C} height={C} fill="white" stroke="#1e293b" strokeWidth={1} />
                            <SvgText x={C*2 + C/2} y={C*2 + C/2 + 5} fontSize={14} fontWeight="bold" fill="#10b981" textAnchor="middle">2</SvgText>
                        </G>
                    </Svg>
                </View>
            </View>
        );
    }

    if (type === 'dulmal') {
        return (
            <View className="absolute inset-0 bg-[#2A3441] items-center justify-center">
                <View className="w-[70%] aspect-[4/3] max-w-[110px] bg-[#fdfbf7] rounded-md shadow border-2 border-[#1E2631]/20 flex-col items-center justify-center p-2 gap-1.5">
                    <View className="flex-row gap-1">
                        <View className="items-center"><Text className="text-[7px] font-mono text-[#4A148C] font-bold">14</Text><View className="w-4 h-5 bg-white border border-gray-300 shadow-sm items-center justify-center rounded-sm"><Text className="text-[10px] font-bold font-serif">H</Text></View></View>
                        <View className="items-center"><Text className="text-[7px] font-mono text-[#4A148C] font-bold">22</Text><View className="w-4 h-5 bg-white border border-gray-300 shadow-sm items-center justify-center rounded-sm"><Text className="text-[10px] font-bold font-serif">E</Text></View></View>
                        <View className="items-center"><Text className="text-[7px] font-mono text-gray-400 font-bold">07</Text><View className="w-4 h-5 bg-[#f0f0f0] border border-gray-300 shadow-sm items-center justify-center rounded-sm"><Text className="text-[10px] font-bold font-serif text-transparent">X</Text></View></View>
                    </View>
                    <View className="flex-row gap-1">
                        <View className="items-center"><Text className="text-[7px] font-mono text-gray-400 font-bold">07</Text><View className="w-4 h-5 bg-[#f0f0f0] border border-gray-300 shadow-sm items-center justify-center rounded-sm"><Text className="text-[10px] font-bold font-serif text-transparent">X</Text></View></View>
                        <View className="items-center"><Text className="text-[7px] font-mono text-[#4A148C] font-bold">22</Text><View className="w-4 h-5 bg-white border border-gray-300 shadow-sm items-center justify-center rounded-sm"><Text className="text-[10px] font-bold font-serif">E</Text></View></View>
                    </View>
                </View>
            </View>
        );
    }

    return <View className="absolute inset-0 bg-zinc-200" />;
});

// Extracted and Memoized card component prevents destructive list re-renders
const GameCard = React.memo(({
    game,
    isSubscribed,
    onPress
}: {
    game: typeof GAMES[0],
    isSubscribed: boolean,
    onPress: (id: string) => void
}) => {
    const showBadge = game.badge && (!isSubscribed || game.badge === 'VÆNTANLEGT');
    const cardWidth = width >= 768 ? '31%' : '48%';
    
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onPress(game.id)}
            className="mb-8"
            style={{ width: cardWidth }}
        >
            <View
                className="w-full aspect-[4/3] bg-white rounded-[28px] border border-slate-100 mb-3.5 overflow-hidden justify-center items-center"
                style={{ 
                    elevation: 8, 
                    shadowColor: '#1e1b4b', 
                    shadowOpacity: 0.08, 
                    shadowOffset: { width: 0, height: 12 }, 
                    shadowRadius: 24 
                }}
            >
                <GameGraphic type={game.iconType} />

                {showBadge && (
                    <View className={`absolute top-3 right-3 px-2.5 py-1.5 rounded-xl flex-row items-center gap-1.5 ${game.badge === 'VÆNTANLEGT' ? 'bg-white/95 border border-slate-100' : (game.badge === 'NÝTT' ? 'bg-rose-500' : 'bg-indigo-950/90')}`} style={{ elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }}>
                        {game.badge !== 'VÆNTANLEGT' && game.badge !== 'NÝTT' && <Ionicons name="lock-closed" size={10} color="#EAB308" />}
                        {game.badge === 'NÝTT' && <Ionicons name="sparkles" size={10} color="white" />}
                        <Text className={`text-[9px] font-black uppercase tracking-widest leading-none ${game.badge === 'VÆNTANLEGT' ? 'text-indigo-600' : 'text-white'}`}>{game.badge}</Text>
                    </View>
                )}
            </View>

            <View className="px-2">
                <Text className="text-[19px] font-black font-serif tracking-tight text-[#0f172a] leading-tight">{game.name}</Text>
                <Text className="text-[13px] font-medium text-slate-500 tracking-normal leading-snug mt-1" numberOfLines={2}>{game.desc}</Text>
            </View>
        </TouchableOpacity>
    );
}, (prevProps, nextProps) => {
    return prevProps.game.id === nextProps.game.id && prevProps.isSubscribed === nextProps.isSubscribed;
});

let savedScrollOffset = 0;

export default function HomeHubScreen() {
    const insets = useSafeAreaInsets();
    const scrollRef = React.useRef<ScrollView>(null);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [xp, setXp] = useState(0);
    const [xpBounce, setXpBounce] = useState(false);

    useEffect(() => {
        async function fetchSub() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('is_subscribed, xp').eq('id', user.id).single();
                if (data?.is_subscribed) setIsSubscribed(true);
                if (data?.xp) setXp(data.xp);
            }
        }
        fetchSub();

        const sub = DeviceEventEmitter.addListener('xp-earned', (earned: number) => {
            setXp(prev => prev + earned);
            setXpBounce(true);
            setTimeout(() => setXpBounce(false), 800);
        });
        
        if (savedScrollOffset > 0) {
            setTimeout(() => {
                scrollRef.current?.scrollTo({ y: savedScrollOffset, animated: false });
            }, 50);
        }

        return () => sub.remove();
    }, []);

    const handleScroll = React.useCallback((event: any) => {
        savedScrollOffset = event.nativeEvent.contentOffset.y;
    }, []);

    const handleGamePress = React.useCallback((id: string) => {
        const game = GAMES.find(g => g.id === id);
        if (game?.badge === 'VÆNTANLEGT') {
            Alert.alert(
                'Væntanlegt',
                'Þessi leikur er ekki alveg tilbúinn ennþá. Kíktu aftur síðar!',
                [{ text: 'Loka', style: 'cancel' }]
            );
            return;
        }
        
        if (game?.badge === 'ÁSKRIFT' && !isSubscribed) {
            Alert.alert(
                'Áskrift nauðsynleg',
                'Þessi leikur er einungis fyrir áskrifendur Dulur.',
                [
                    { text: 'Skoða áskrift', onPress: () => router.push('/(tabs)/profile') },
                    { text: 'Loka', style: 'cancel' }
                ]
            );
            return;
        }
        
        // Also restrict "NÝTT" games that require sub (e.g. dulmal)
        if (game?.badge === 'NÝTT' && !isSubscribed && game?.id !== 'ordla' && game?.id !== 'hengimadur' && game?.id !== 'sudoku' && game?.id !== 'minnisspil') {
            Alert.alert(
                'Áskrift nauðsynleg',
                'Þessi leikur er einungis fyrir áskrifendur Dulur.',
                [
                    { text: 'Skoða áskrift', onPress: () => router.push('/(tabs)/profile') },
                    { text: 'Loka', style: 'cancel' }
                ]
            );
            return;
        }

        router.push(`/game/native/${id}` as any);
    }, [isSubscribed]);

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['top']}>
            <ScrollView 
                ref={scrollRef}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                className="flex-1 bg-[#FAFAFA]" 
                contentContainerStyle={{ paddingBottom: 120, alignItems: 'center' }} 
                showsVerticalScrollIndicator={false}
            >
                <View className="w-full max-w-[600px]">
                    {/* Header & Motto (Centered 2026 Home Page Style) */}
                <View className="w-full relative px-6 pt-12 pb-10 flex-col items-center justify-center">
                    {/* XP absolutely positioned but matching the visual line of the title */}
                    <View className="absolute top-16 right-6 z-10">
                        {xp > 0 && (
                            <View className={`flex-row items-center gap-1.5 bg-[#EAB308] border ${xpBounce ? 'border-[#FDE047]' : 'border-[#CA8A04]'} px-3 py-1.5 rounded-[12px] shadow-sm`} style={{ transform: [{ scale: xpBounce ? 1.05 : 1 }] }}>
                                <Ionicons name="star" size={14} color="white" />
                                <Text className="text-white font-black text-[13px]">{xp}</Text>
                            </View>
                        )}
                    </View>

                    <Text
                        className="text-[52px] leading-[1.1] font-black font-serif tracking-tighter text-[#1e1b4b] text-center mb-2"
                    >
                        Dulur.
                    </Text>
                    
                    <View className="flex-row items-center justify-center gap-4 flex-wrap w-full">
                        <Text className="text-[22px] font-bold font-serif italic text-slate-800 tracking-wide text-center">Mundu að leika.</Text>
                        <GataWidget />
                    </View>
                </View>

                {/* Allir Leikir Divider */}
                <View className="px-6 mb-6 flex-row items-center gap-3">
                    <Text className="text-[22px] font-black font-serif text-[#1e1b4b] tracking-tight">Allir Leikir</Text>
                    <View className="flex-1 h-[2px] bg-indigo-900/5 rounded-full" />
                </View>

                {/* 2026 Grid Aesthetics for Games */}
                <View className="px-5 flex-row flex-wrap justify-between">
                    {GAMES.map((game) => (
                        <GameCard
                            key={game.id}
                            game={game}
                            isSubscribed={isSubscribed}
                            onPress={handleGamePress}
                        />
                    ))}
                    {Array.from({ length: width >= 768 ? (3 - (GAMES.length % 3)) % 3 : (2 - (GAMES.length % 2)) % 2 }).map((_, i) => (
                        <View key={`dummy-${i}`} style={{ width: width >= 768 ? '31%' : '48%' }} className="pointer-events-none" />
                    ))}
                </View>

                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
