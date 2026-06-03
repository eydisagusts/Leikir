const fetch = require('node-fetch');

async function test() {
    try {
        const res = await fetch("https://dulur.is/api/mobile/dulmal/init?d=2026-05-28");
        const data = await res.json();
        console.log(data);
    } catch (e) {
        console.error(e);
    }
}
test();
