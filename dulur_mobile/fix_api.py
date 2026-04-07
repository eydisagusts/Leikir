import os
import glob

game_dir = "app/game"
files = glob.glob(f"{game_dir}/*.tsx")

for fpath in files:
    with open(fpath, "r") as f:
        content = f.read()
    
    if "const API_URL =" in content and "10.10.1.36" in content:
        # e.g. const API_URL = 'http://10.10.1.36:3000/api/mobile/ordla';
        # replace with process.env.EXPO_PUBLIC_API_URL + '/api/mobile/...'
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if line.startswith('const API_URL = ') and '10.10.1.36:3000' in line:
                # Extract the path portion carefully 
                parts = line.split("10.10.1.36:3000")
                if len(parts) > 1:
                    endpoint = parts[1].split("'")[0]
                    lines[i] = f"const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://10.10.1.36:3000') + '{endpoint}';"
        
        with open(fpath, "w") as f:
            f.write('\n'.join(lines))
        print("Updated", fpath)

