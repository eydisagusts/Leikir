const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'app/game/native/sudoku.tsx');
let content = fs.readFileSync(filePath, 'utf8');

if(!content.includes("import { DeviceEventEmitter, Share }")) {
    content = content.replace("import { DeviceEventEmitter }", "import { DeviceEventEmitter, Share }");
}

if(!content.includes("isFreshGameOver")) {
    content = content.replace(
        "const [gameState, setGameState] = useState<'playing' | 'won' | 'loading' | 'error'>('loading');",
        "const [gameState, setGameState] = useState<'playing' | 'won' | 'loading' | 'error'>('loading');\n    const [earnedXp, setEarnedXp] = useState<number | null>(null);\n    const [showFlyXp, setShowFlyXp] = useState(false);\n    const [isFreshGameOver, setIsFreshGameOver] = useState(false);\n\n    const xpAnimY = useSharedValue(0);\n    const xpAnimOpacity = useSharedValue(1);\n\n    const handleCloseModal = () => {\n        setIsFreshGameOver(false);\n        if (earnedXp && earnedXp > 0) {\n            setShowFlyXp(true);\n            xpAnimY.value = 0;\n            xpAnimOpacity.value = 1;\n            xpAnimY.value = withTiming(-350, { duration: 1200 });\n            xpAnimOpacity.value = withTiming(0, { duration: 1200 });\n            setTimeout(() => {\n                setShowFlyXp(false);\n                DeviceEventEmitter.emit('xp-earned', earnedXp);\n            }, 1300);\n        }\n    };\n\n    const handleShare = async () => {\n        const header = \`Dulur: Sudoku ✏️\`;\n        const diffDict = { easy: 'Létt', medium: 'Miðlungs', hard: 'Erfitt' };\n        const diffText = diffDict[difficulty] || difficulty;\n        const xpText = earnedXp ? \`\\n⭐ XP: +\${earnedXp}\` : '';\n        const message = \`\${header}\\nErfiðleikastig: \${diffText}\${xpText}\\n\\nÉg leysti þraut dagsins!\\ndulur.is 🔥\`;\n        try {\n            await Share.share({ message });\n        } catch (error) {\n            console.error('Error sharing', error);\n        }\n    };\n\n    const flyStyle = useAnimatedStyle(() => {\n        return {\n            transform: [{ translateY: xpAnimY.value }],\n            opacity: xpAnimOpacity.value,\n        };\n    });"
    );
}

content = content.replace(
    "setGameState('won');",
    "setGameState('won');\n        setEarnedXp(100);\n        setIsFreshGameOver(true);"
);

if(!content.includes("isFreshGameOver && (")) {
    content = content.replace(
        "{gameState === 'won' && (",
        `{gameState === 'won' && isFreshGameOver && (
                    <View className="absolute top-1/4 self-center bg-white px-6 py-8 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] items-center z-40 w-[85%] max-w-[340px] border border-gray-200">
                        <View className="w-16 h-16 bg-indigo-50 rounded-full items-center justify-center mb-4">
                            <Ionicons name="trophy" size={32} color="#4f46e5" />
                        </View>
                        <Text className="text-2xl font-black font-serif text-[#1A1A1B] text-center mb-2">
                            Vel gert!
                        </Text>
                        <Text className="text-gray-500 text-center mb-6 text-sm">
                            Þú leystir Sudoku.
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
                )}

                {showFlyXp && earnedXp !== null && earnedXp > 0 && (
                    <Animated.View style={[{ position: 'absolute', top: '40%', alignSelf: 'center', zIndex: 60, pointerEvents: 'none' }, flyStyle]}>
                        <View className="bg-[#EAB308] flex-row items-center gap-1.5 px-4 py-2 rounded-full shadow-lg border border-[#FDE047]">
                            <Ionicons name="star" size={16} color="white" />
                            <Text className="text-white font-black text-xl tracking-widest">+{earnedXp}</Text>
                        </View>
                    </Animated.View>
                )}

            {!isFreshGameOver && gameState === 'won' && (`
    );
}

fs.writeFileSync(filePath, content);
console.log('Sudoku updated');
