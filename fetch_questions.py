import requests
import json
import time
import html
import random
from deep_translator import GoogleTranslator

def fetch_and_translate(total_needed=1750):
    all_questions = []
    translator = GoogleTranslator(source='en', target='is')
    
    # OpenTDB session token prevents duplicates
    session_res = requests.get("https://opentdb.com/api_token.php?command=request")
    session_token = session_res.json().get("token")
    
    print(f"Session token: {session_token}")
    
    calls = total_needed // 50
    
    for i in range(calls):
        print(f"Fetching batch {i+1}/{calls}...")
        try:
            res = requests.get(f"https://opentdb.com/api.php?amount=50&type=multiple&token={session_token}")
            data = res.json()
            
            if data['response_code'] != 0:
                print(f"API Error code: {data['response_code']}")
                if data['response_code'] == 4:
                    print("Token Empty. Resetting...")
                    requests.get(f"https://opentdb.com/api_token.php?command=reset&token={session_token}")
                    time.sleep(2)
                    continue
                break
                
            results = data['results']
            
            # Prepare strings to translate
            strings_to_translate = []
            for item in results:
                strings_to_translate.append(html.unescape(item['question']))
                strings_to_translate.append(html.unescape(item['correct_answer']))
                for inc in item['incorrect_answers']:
                    strings_to_translate.append(html.unescape(inc))
            
            print("Translating...")
            # Translate in chunks of 50 to avoid payload too large errors
            translated = []
            chunk_size = 50
            for j in range(0, len(strings_to_translate), chunk_size):
                chunk = strings_to_translate[j:j+chunk_size]
                try:
                    trans_chunk = translator.translate_batch(chunk)
                    translated.extend(trans_chunk)
                except Exception as e:
                    print(f"Translation error: {e}")
                    # Fallback to individual
                    for s in chunk:
                        try:
                            translated.append(translator.translate(s))
                        except:
                            translated.append(s) # keep english if failed
            
            # Reconstruct questions
            idx = 0
            for item in results:
                q_text = translated[idx]
                correct = translated[idx+1]
                inc1 = translated[idx+2]
                inc2 = translated[idx+3]
                inc3 = translated[idx+4]
                idx += 5
                
                options = [correct, inc1, inc2, inc3]
                random.shuffle(options)
                correct_idx = options.index(correct)
                
                all_questions.append({
                    "question": q_text.replace('"', '\\"'),
                    "options": [o.replace('"', '\\"') for o in options],
                    "correctIndex": correct_idx
                })
            
            print(f"Total so far: {len(all_questions)}")
            # Save intermediate progress
            with open("kviss_temp.json", "w", encoding="utf-8") as f:
                json.dump(all_questions, f, ensure_ascii=False, indent=2)
                
        except Exception as e:
            print(f"Error in loop: {e}")
            
        time.sleep(3) # Respect API rate limits

    # Format for TS file insertion
    ts_str = ""
    for q in all_questions:
        ts_str += f'    {{ question: "{q["question"]}", options: ["{q["options"][0]}", "{q["options"][1]}", "{q["options"][2]}", "{q["options"][3]}"], correctIndex: {q["correctIndex"]} }},\n'
    
    with open("kviss_new_batch.txt", "w", encoding="utf-8") as f:
        f.write(ts_str)
        
    print("DONE! Wrote to kviss_new_batch.txt")

if __name__ == "__main__":
    fetch_and_translate(1750)
