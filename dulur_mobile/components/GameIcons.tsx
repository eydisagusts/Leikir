import React from 'react';
import { View, Text } from 'react-native';

export const OrdlaIcon = () => (
    <View className="flex-1 bg-[#FAFAFA] items-center justify-center p-4">
        <View className="w-[45%] max-w-[120px] aspect-[5/6] flex-row flex-wrap justify-center">
             {['S','P','I','L','A'].map((l, i) => (
                 <View key={`r1-${i}`} className="w-[18%] aspect-square m-[1%] bg-[#3A3A3C] rounded-sm items-center justify-center">
                     <Text className="text-white font-bold text-[8px]">{l}</Text>
                 </View>
             ))}
             {['O','R','Ð','L','A'].map((l, i) => (
                 <View key={`r2-${i}`} className="w-[18%] aspect-square m-[1%] bg-[#538D4E] rounded-sm items-center justify-center">
                     <Text className="text-white font-bold text-[8px]">{l}</Text>
                 </View>
             ))}
             {Array.from({length: 15}).map((_, i) => (
                 <View key={`b-${i}`} className="w-[18%] aspect-square m-[1%] bg-white border border-[#D3D6DA] rounded-sm opacity-50" />
             ))}
        </View>
    </View>
);

export const StafaruglIcon = () => {
    const letters = ['R','Ú','B','S','A','O','P','V','Ð','I','M','N','E','L','A','F'];
    return (
        <View className="flex-1 bg-[#F2F2F2] justify-center items-center">
            <View className="w-[55%] aspect-square bg-white rounded-md shadow-sm border border-black/5 p-2 flex-row flex-wrap">
                {letters.map((l, i) => {
                    const isFocus = [3, 6, 10, 9, 12].includes(i);
                    return (
                        <View key={i} className="w-[25%] h-[25%] items-center justify-center">
                            <Text style={{ color: isFocus ? '#1A2B4C' : '#A0A0A0', fontWeight: isFocus ? '900' : 'bold', fontSize: 10 }}>{l}</Text>
                        </View>
                    )
                })}
            </View>
        </View>
    )
};

export const TengingarIcon = () => (
    <View className="flex-1 bg-[#E8E6E3] items-center justify-center">
        <View className="w-[70%] max-w-[180px] gap-1.5">
             {['#F2C960', '#A0C35A', '#B1C4E0', '#BA81C5'].map((color, i) => (
                 <View key={i} className="w-full h-6 rounded shadow-sm flex-row items-center justify-center gap-1.5" style={{ backgroundColor: color }}>
                     <View className="w-1.5 h-1.5 bg-black/10 rounded-full" />
                     <View className="w-1.5 h-1.5 bg-black/10 rounded-full" />
                     <View className="w-1.5 h-1.5 bg-black/10 rounded-full" />
                 </View>
             ))}
        </View>
    </View>
);

export const KrossgataIcon = () => (
    <View className="flex-1 bg-[#EAEAEA] items-center justify-center">
        <View className="w-[60%] aspect-square max-w-[150px] border-2 border-black bg-black flex-row flex-wrap">
             {Array.from({length: 25}).map((_, i) => {
                 const isBlack = [3, 10, 14, 21].includes(i);
                 const isHighlight = i === 12;
                 const num = [0,1,2,4,5,8,11,15,17,19,20].indexOf(i) + 1;
                 return (
                     <View key={i} className="w-[20%] h-[20%] border-[0.5px] border-black bg-white items-center justify-center relative" style={{ backgroundColor: isBlack ? 'black' : isHighlight ? '#FFF4B3' : 'white' }}>
                          {!isBlack && num > 0 && <Text className="absolute top-0.5 left-0.5 text-[6px] font-sans">{num}</Text>}
                          {isHighlight && <Text className="font-serif font-black text-sm">K</Text>}
                     </View>
                 )
             })}
        </View>
    </View>
);

// Fallbacks for non-featured ones
export const HengimadurIcon = () => <View className="flex-1 bg-[#E1E7EE] items-center justify-center"><Text className="text-4xl text-[#1A2B4C]">H</Text></View>;
export const SudokuIcon = () => <View className="flex-1 bg-[#EAEAEA] items-center justify-center"><View className="w-[50%] aspect-square bg-white border-[3px] border-[#333]" /></View>;
export const StraumurIcon = () => <View className="flex-1 bg-[#E5F1F1] items-center justify-center"><Text className="text-3xl text-teal-700 font-bold">~</Text></View>;
export const SprengjuleitIcon = () => <View className="flex-1 bg-[#F5F5F5] items-center justify-center"><Text className="text-3xl">💣</Text></View>;
export const KvissIcon = () => <View className="flex-1 bg-[#ECE8F2] items-center justify-center"><Text className="text-4xl text-[#4A148C] font-serif font-bold">?</Text></View>;
export const LitakodiIcon = () => <View className="flex-1 bg-[#F5F5F5] items-center justify-center"><View className="flex-row gap-2"><View className="w-5 h-5 bg-[#E57373] rounded-full" /><View className="w-5 h-5 bg-[#64B5F6] rounded-full" /></View></View>;
export const MinnisspilIcon = () => <View className="flex-1 bg-[#F4F6F4] items-center justify-center"><View className="w-[50%] aspect-square bg-[#2D4A3E]" /></View>;
