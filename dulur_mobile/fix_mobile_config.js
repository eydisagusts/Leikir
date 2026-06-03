const fs = require('fs');

let code = fs.readFileSync('app/(tabs)/index.tsx', 'utf-8');

// 1. Add krossreikningur to GAME_IMAGES
if (!code.includes("'krossreikningur': require('../../assets/images/games/dulur_krossreikningur.png')")) {
    code = code.replace(
        "'samhengi': require('../../assets/images/games/dulur_samhengi.png'),",
        "'samhengi': require('../../assets/images/games/dulur_samhengi.png'),\n    'krossreikningur': require('../../assets/images/games/dulur_krossreikningur.png'),"
    );
}

// 2. Change resizeMode: 'cover' to resizeMode: 'contain' and adjust sizing
code = code.replace(
        "style={{ width: '100%', height: '100%', resizeMode: 'cover' }}",
        "style={{ width: '85%', height: '85%', resizeMode: 'contain' }}"
);

fs.writeFileSync('app/(tabs)/index.tsx', code);
console.log('Mobile updated');
