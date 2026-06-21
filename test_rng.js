function getIndex(dateStr, length) {
    const baseDate = new Date(`${dateStr}T12:00:00Z`);
    const seedMultiplier = baseDate.getFullYear() * 10000 + (baseDate.getMonth() + 1) * 100 + baseDate.getDate();

    const seedStr = seedMultiplier.toString();
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
        hash |= 0;
    }
    
    const rng = function() {
        let t = hash += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };

    return Math.floor(rng() * length);
}

for (let i = 18; i <= 24; i++) {
    console.log(`2026-05-${i}: `, getIndex(`2026-05-${i}`, 79));
}
