const fs = require('fs');
const path = require('path');
const translate = require('google-translate-api-x');

// HTML entity decoder
const decodeHTML = (str) => {
    return str.replace(/&quot;/g, '"')
              .replace(/&#039;/g, "'")
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&ntilde;/g, 'ñ')
              .replace(/&eacute;/g, 'é')
              .replace(/&aacute;/g, 'á')
              .replace(/&iacute;/g, 'í')
              .replace(/&oacute;/g, 'ó')
              .replace(/&uacute;/g, 'ú')
              .replace(/&rsquo;/g, "'");
};

async function fetchQuestions() {
    const TOTAL_NEEDED = 1800;
    const BATCH_SIZE = 50;
    const calls = Math.ceil(TOTAL_NEEDED / BATCH_SIZE);
    let allQuestions = [];

    console.log("Fetching session token...");
    const sessionRes = await fetch("https://opentdb.com/api_token.php?command=request");
    const sessionData = await sessionRes.json();
    let token = sessionData.token;

    for (let i = 0; i < calls; i++) {
        console.log(`Fetching batch ${i+1}/${calls}...`);
        
        try {
            const res = await fetch(`https://opentdb.com/api.php?amount=${BATCH_SIZE}&type=multiple&token=${token}`);
            const data = await res.json();
            
            if (data.response_code !== 0) {
                console.log(`API Error code: ${data.response_code}`);
                if (data.response_code === 4) {
                    console.log("Token Empty. Need reset.");
                    await fetch(`https://opentdb.com/api_token.php?command=reset&token=${token}`);
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }
                break;
            }

            const results = data.results;
            
            // Extract all strings to translate
            let stringsToTranslate = [];
            for (let item of results) {
                stringsToTranslate.push(decodeHTML(item.question));
                stringsToTranslate.push(decodeHTML(item.correct_answer));
                for (let inc of item.incorrect_answers) {
                    stringsToTranslate.push(decodeHTML(inc));
                }
            }

            console.log(`Translating ${stringsToTranslate.length} strings...`);
            
            // Translate the array in chunks to avoid max length errors
            let translated = [];
            for (let j = 0; j < stringsToTranslate.length; j += 50) {
                const chunk = stringsToTranslate.slice(j, j + 50);
                try {
                    const res = await translate(chunk, {to: 'is'});
                    translated.push(...res.map(r => r.text));
                } catch (e) {
                    console.log(`Translation error on chunk: ${e.message}`);
                    // Fallback: keep english
                    translated.push(...chunk);
                }
                await new Promise(r => setTimeout(r, 500)); // Slight delay
            }

            // Reconstruct
            let idx = 0;
            for (let item of results) {
                const qText = translated[idx];
                const correct = translated[idx+1];
                const inc1 = translated[idx+2];
                const inc2 = translated[idx+3];
                const inc3 = translated[idx+4];
                idx += 5;

                let options = [correct, inc1, inc2, inc3];
                
                // Shuffle options
                for (let k = options.length - 1; k > 0; k--) {
                    const l = Math.floor(Math.random() * (k + 1));
                    [options[k], options[l]] = [options[l], options[k]];
                }
                
                const correctIndex = options.indexOf(correct);

                allQuestions.push({
                    question: qText.replace(/"/g, '\\"').replace(/\n/g, ' '),
                    options: options.map(o => o.replace(/"/g, '\\"').replace(/\n/g, ' ')),
                    correctIndex
                });
            }

            console.log(`Total questions processed: ${allQuestions.length}`);
            await new Promise(r => setTimeout(r, 2000)); // Respect API limits

        } catch (e) {
            console.log(`Error in loop: ${e.message}`);
            break;
        }
    }

    console.log("Formatting for TypeScript...");
    let tsStr = "";
    for (let q of allQuestions) {
        tsStr += `    { question: "${q.question}", options: ["${q.options[0]}", "${q.options[1]}", "${q.options[2]}", "${q.options[3]}"], correctIndex: ${q.correctIndex} },\n`;
    }

    // Append to file
    const targetFile = path.join(__dirname, 'dulur_global/src/lib/games/kviss/content.ts');
    const fileStr = fs.readFileSync(targetFile, 'utf8');
    
    const targetIndex = fileStr.indexOf('export const KVISS_QUESTIONS_EN');
    let beforeEnd = fileStr.lastIndexOf('];', targetIndex);
    
    if (beforeEnd === -1 || targetIndex === -1) {
        console.log("Could not find the end of KVISS_QUESTIONS array.");
        return;
    }

    const newFileContent = fileStr.slice(0, beforeEnd) + tsStr + fileStr.slice(beforeEnd);
    fs.writeFileSync(targetFile, newFileContent);

    console.log("SUCCESSFULLY APPENDED 1800 QUESTIONS!");
}

fetchQuestions();
