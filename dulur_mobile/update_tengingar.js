const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app/game/native/tengingar.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix Category interface
content = content.replace(/title: string;/g, 'category: string;');
content = content.replace(/cat\.title/g, 'cat.category');

// 2. Add isFreshGameOver and handleCloseModal
if (!content.includes('isFreshGameOver')) {
    content = content.replace('const [showFlyXp, setShowFlyXp] = useState(false);', 
        "const [showFlyXp, setShowFlyXp] = useState(false);\n    const [isFreshGameOver, setIsFreshGameOver] = useState(false);");

    const handleShareFunc = `
    const handleCloseModal = () => {
        setIsFreshGameOver(false);
        if (earnedXp && earnedXp > 0) {
            setShowFlyXp(true);
            xpAnimY.value = 0;
            xpAnimOpacity.value = 1;
            xpAnimY.value = withTiming(-350, { duration: 1200 });
            xpAnimOpacity.value = withTiming(0, { duration: 1200 });
            setTimeout(() => {
                setShowFlyXp(false);
                DeviceEventEmitter.emit('xp-earned', earnedXp);
            }, 1300);
        }
    };

    const handleShare = async () => {
        const header = \`Dulur: Tengingar 🧩\`;
        const xpText = earnedXp ? \`\\n⭐ XP: +\${earnedXp}\` : '';
        const mText = \`Mistök: \${mistakes}/4\`;
        const message = \`\${header}\\n\${mText}\${xpText}\\n\\nÉg fann allar tengingarnar!\\ndulur.is 🔥\`;
        try {
            await import('react-native').then(m => m.Share.share({ message }));
        } catch (error) {
            console.error('Error sharing', error);
        }
    };
`;
    content = content.replace('const xpFloatingStyle', handleShareFunc + '\n    const xpFloatingStyle');
}

// 3. Update syncTrueResult to trigger modal instead of auto XP
content = content.replace(/if \(won\) {\n\s*setEarnedXp\(xpReward\);\n\s*setTimeout\(\(\) => {[\s\S]*?await supabase\.rpc\('process_daily_streak', { user_id_param: user.id }\);\n\s*}/m,
`if (won) {
            setEarnedXp(xpReward);
            setIsFreshGameOver(true);
            await supabase.rpc('increment_xp', { user_id_param: user.id, xp_amount: xpReward, p_locale: 'is' });
            await supabase.rpc('process_daily_streak', { user_id_param: user.id });
        } else {
            setIsFreshGameOver(true);
            setEarnedXp(0);
        }`);

// 4. Update the render blocks
content = content.replace(/\{showFlyXp && \([\s\S]*?\}\)/, 
`{showFlyXp && (
                <Animated.View style={[xpFloatingStyle, { position: 'absolute', top: '40%', left: '35%', zIndex: 100 }]} className="items-center pointer-events-none">
                    <View className="bg-[#EAB308] flex-row items-center gap-1.5 px-4 py-2 rounded-full shadow-lg border border-[#FDE047]">
                        <Ionicons name="star" size={16} color="white" />
                        <Text className="text-white font-black text-xl tracking-widest">+{earnedXp}</Text>
                    </View>
                </Animated.View>
            )}

            {gameState !== 'playing' && isFreshGameOver && (
                <View className="absolute top-1/4 self-center bg-white px-6 py-8 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] items-center z-40 w-[85%] max-w-[340px] border border-gray-200">
                    <View className="w-16 h-16 bg-indigo-50 rounded-full items-center justify-center mb-4">
                        <Ionicons name={gameState === 'won' ? "trophy" : "sad-outline"} size={32} color="#4f46e5" />
                    </View>
                    <Text className="text-2xl font-black font-serif text-[#1A1A1B] text-center mb-2">
                        {gameState === 'won' ? 'Vel gert!' : 'Leik lokið'}
                    </Text>
                    <Text className="text-gray-500 text-center mb-6 text-sm">
                        {gameState === 'won' ? 'Þú fannst allar tengingarnar!' : 'Þú hefur klárað allar tilraunir þínar.'}
                    </Text>

                    <View className="flex-row items-center justify-between w-full mb-6">
                        <View className="bg-gray-50 flex-1 py-3 rounded-2xl items-center border border-gray-100">
                            <Text className="text-gray-400 text-xs font-bold uppercase mb-1">Stig</Text>
                            <Text className="text-xl font-black text-[#1A1A1B]">{earnedXp || 0} XP</Text>
                        </View>
                    </View>

                    <View className="w-full gap-3">
                        <TouchableOpacity onPress={handleShare} className="w-full bg-[#1A1A1B] py-3.5 rounded-full items-center">
                            <Text className="text-white font-bold text-base">Deila niðurstöðu</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleCloseModal} className="w-full bg-gray-100 py-3.5 rounded-full items-center">
                            <Text className="text-[#1A1A1B] font-bold text-base">Áfram</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}`);

content = content.replace(/\{gameState === 'playing' \? \([\s\S]*?\) : \([\s\S]*?\}\)/, 
`{gameState === 'playing' ? (
                <View className="w-full max-w-[500px] px-0 pb-6" style={{ marginTop: 16, gap: 12 }}>
                    <View className="flex-row justify-center items-center gap-2 mb-0">
                        <Text className="text-gray-600 font-bold">Mistök eftir:</Text>
                        <View className="flex-row gap-1">
                            {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
                                <View key={i} className={\`w-3 h-3 rounded-full \${i < (MAX_MISTAKES - mistakes) ? 'bg-[#1A1A1B]' : 'bg-gray-300'}\`} />
                            ))}
                        </View>
                    </View>

                    <View className="flex-row justify-center gap-3">
                        <TouchableOpacity onPress={handleShuffle} className="px-6 py-3.5 rounded-full border border-[#D3D6DA] bg-white">
                            <Text className="font-bold text-[#1A1A1B]">Stokka</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleDeselect} className="px-6 py-3.5 rounded-full border border-[#D3D6DA] bg-white" disabled={selectedWords.length===0} style={{ opacity: selectedWords.length ? 1 : 0.5 }}>
                            <Text className="font-bold text-[#1A1A1B]">Hreinsa</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSubmit} className="px-6 py-3.5 rounded-full border border-[#1A1A1B] min-w-[100px] items-center" style={{ backgroundColor: selectedWords.length === 4 ? '#1A1A1B' : '#EFEFEF', borderColor: selectedWords.length === 4 ? '#1A1A1B' : '#D3D6DA' }}>
                            <Text className={\`font-bold \${selectedWords.length === 4 ? 'text-white' : 'text-gray-400'}\`}>Giska</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : !isFreshGameOver ? (
                <View className="w-full max-w-[500px] px-4 pb-12 mt-4 items-center">
                     <Text className="text-xl font-bold font-serif mb-4 text-[#1A1A1B]">Leik lokið!</Text>
                     <TouchableOpacity onPress={() => router.back()} className="px-8 py-4 rounded-full bg-[#1A1A1B] w-full max-w-[250px] items-center">
                        <Text className="font-bold text-white text-lg">Til baka í leiki</Text>
                    </TouchableOpacity>
                </View>
            ) : null}`);

fs.writeFileSync(filePath, content);
console.log('Tengingar updated');
