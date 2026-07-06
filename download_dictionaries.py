import os
import urllib.request

def download_file(url, filepath):
    print(f"Downloading {url} to {filepath}...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            with open(filepath, 'wb') as out_file:
                out_file.write(response.read())
        print("Download complete.")
    except Exception as e:
        print(f"Error downloading {url}: {e}")

def main():
    dest_dir = "dictionaries"
    os.makedirs(dest_dir, exist_ok=True)
    
    # Indonesian KBBI Wordlist (via jsDelivr CDN)
    id_url = "https://cdn.jsdelivr.net/gh/aryakdaniswara/kbbi-v6-wordlist@main/all_entries_v6.1.0.txt"
    id_path = os.path.join(dest_dir, "indonesian.txt")
    
    # English Wordlist (~479k words) (via jsDelivr CDN)
    en_url = "https://cdn.jsdelivr.net/gh/dwyl/english-words@master/words.txt"
    en_path = os.path.join(dest_dir, "english.txt")
    
    download_file(id_url, id_path)
    download_file(en_url, en_path)
    
    print("\nAll dictionaries prepared successfully!")

if __name__ == "__main__":
    main()
