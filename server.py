import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
        
    def end_headers(self):
        # Enable CORS headers for development/local fetch flexibility
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type')
        super().end_headers()

def main():
    # Change working directory to ensure correct serving folder
    os.chdir(DIRECTORY)
    
    # Confirm dictionary files exist
    id_path = os.path.join("dictionaries", "indonesian.txt")
    en_path = os.path.join("dictionaries", "english.txt")
    
    if not os.path.exists(id_path) or not os.path.exists(en_path):
        print("PERINGATAN: File kamus tidak ditemukan!")
        print("Silakan jalankan 'python download_dictionaries.py' terlebih dahulu untuk mengunduh kamus kata.")
        print("Tutup server ini, lalu jalankan download_dictionaries.py.")
        print("-"*50)
        
    handler = MyHTTPRequestHandler
    
    # Allow port reuse to avoid 'Address already in use' errors
    socketserver.TCPServer.allow_reuse_address = True
    
    try:
        with socketserver.TCPServer(("", PORT), handler) as httpd:
            print(f"Server berjalan di: http://localhost:{PORT}")
            print(f"Menyajikan folder: {DIRECTORY}")
            print("Tekan Ctrl+C untuk menghentikan server.")
            
            # Automatically open the web browser
            webbrowser.open(f"http://localhost:{PORT}")
            
            # Start serving
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\nServer dihentikan oleh pengguna.")
        sys.exit(0)
    except Exception as e:
        print(f"Error saat menjalankan server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
