const fs = require('fs');
const path = require('path');

const files = [
    '/Users/eydisla/Leikir/dulur_global/src/app/[locale]/straumur/page.tsx',
    '/Users/eydisla/Leikir/dulur_global/src/app/[locale]/krossgata/page.tsx',
    '/Users/eydisla/Leikir/dulur_global/src/app/[locale]/stafarugl/page.tsx',
    '/Users/eydisla/Leikir/dulur_global/src/app/[locale]/sprengjuleit/page.tsx',
    '/Users/eydisla/Leikir/dulur_global/src/app/[locale]/kviss/page.tsx',
    '/Users/eydisla/Leikir/dulur_global/src/app/[locale]/hengimadur/HengimadurClient.tsx',
    '/Users/eydisla/Leikir/dulur_global/src/app/[locale]/ordla/OrdlaClient.tsx',
    '/Users/eydisla/Leikir/dulur/src/app/stafarugl/page.tsx',
    '/Users/eydisla/Leikir/dulur/src/app/straumur/page.tsx',
    '/Users/eydisla/Leikir/dulur/src/app/krossgata/page.tsx',
    '/Users/eydisla/Leikir/dulur/src/app/sprengjuleit/page.tsx',
    '/Users/eydisla/Leikir/dulur/src/app/hengimadur/HengimadurClient.tsx',
    '/Users/eydisla/Leikir/dulur/src/app/kviss/page.tsx',
    '/Users/eydisla/Leikir/dulur/src/app/[locale]/stafarugl/page.tsx',
    '/Users/eydisla/Leikir/dulur/src/app/[locale]/straumur/page.tsx',
    '/Users/eydisla/Leikir/dulur/src/app/[locale]/krossgata/page.tsx',
    '/Users/eydisla/Leikir/dulur/src/app/[locale]/sprengjuleit/page.tsx',
    '/Users/eydisla/Leikir/dulur/src/app/[locale]/hengimadur/HengimadurClient.tsx',
    '/Users/eydisla/Leikir/dulur/src/app/[locale]/ordla/OrdlaClient.tsx',
    '/Users/eydisla/Leikir/dulur/src/app/[locale]/kviss/page.tsx',
    '/Users/eydisla/Leikir/dulur/src/app/ordla/OrdlaClient.tsx'
];

files.forEach(file => {
    if (!fs.existsSync(file)) {
        console.log(`Skipping non-existent file: ${file}`);
        return;
    }

    let content = fs.readFileSync(file, 'utf8');

    // Regex to match:
    // {playStatus.played ? (
    //     <DailyLockOverlay>
    //         <GameComponent ... />
    //     </DailyLockOverlay>
    // ) : (
    //     <GameComponent ... />
    // )}

    const regex = /\{playStatus\.played \? \([\s\n]*<DailyLockOverlay>([\s\n]*<[a-zA-Z]+[\s\S]*?\/>)[\s\n]*<\/DailyLockOverlay>[\s\n]*\) : \([\s\n]*(<[a-zA-Z]+[\s\S]*?\/>)[\s\n]*\)\}/g;

    const newContent = content.replace(regex, (match, p1) => {
        // We inject the isActive prop
        return `<DailyLockOverlay isActive={playStatus.played}>${p1}\n                </DailyLockOverlay>`;
    });

    if (content !== newContent) {
        fs.writeFileSync(file, newContent, 'utf8');
        console.log(`Replaced in ${file}`);
    }
});
