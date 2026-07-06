import os
import sys
import re
import argparse
from bs4 import BeautifulSoup, Comment

# Common English words that are 2 letters long and should be flagged if normal text
COMMON_EN_2_LETTER = {"of", "to", "in", "on", "by", "is", "it", "at", "an", "as", "if", "or", "be", "do", "we", "us"}

# Default whitelist of abbreviations, scientific units, or names that shouldn't be flagged
DEFAULT_WHITELIST = {
    "html", "css", "js", "pdf", "docx", "web", "http", "https", "url", "api", "ip", "id", "db", "sql", "ui", "ux",
    "cpu", "ram", "gb", "mb", "kb", "tb", "ghz", "mhz", "khz", "hz", "cm", "mm", "kg", "gr", "ml", "km", "md5", "sha",
    "w3c", "dom", "xml", "json", "rest", "csv", "xls", "txt", "png", "jpg", "jpeg", "gif", "svg", "app", "os", "mac",
    "pc", "sd", "sim", "usb", "wi-fi", "wifi", "lan", "wan", "gps", "sms", "iot", "ai", "ml", "nlp", "gui", "cli",
    "kbbi", "eyd", "puebi", "skripsi", "thesis", "jurnal", "dosen", "mahasiswa", "kampus", "universitas", "prodi"
}

def load_words(filepath):
    """Load words from a text file into a set for fast lookup."""
    words_set = set()
    if os.path.exists(filepath):
        print(f"Loading dictionary: {filepath}...")
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                word = line.strip().lower()
                if word:
                    words_set.add(word)
        print(f"Loaded {len(words_set)} words.")
    else:
        print(f"Warning: Dictionary file not found at {filepath}")
    return words_set

def load_whitelist(filepath):
    """Load whitelist terms from file or return default whitelist."""
    whitelist = set(DEFAULT_WHITELIST)
    if os.path.exists(filepath):
        print(f"Loading custom whitelist: {filepath}...")
        with open(filepath, 'r', encoding='utf-8') as f:
            for line in f:
                term = line.strip().lower()
                if term:
                    whitelist.add(term)
        print(f"Loaded {len(whitelist)} whitelist terms (including defaults).")
    return whitelist

def clean_word(word):
    """Remove leading/trailing punctuation and symbols from a word."""
    cleaned = re.sub(r'^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$', '', word)
    return cleaned.lower()

def is_foreign_word(word, id_set, en_set, whitelist_set):
    """Determine if a word is foreign and requires italicization."""
    # Ignore abbreviations/acronyms (all uppercase alphabetical sequences)
    alpha_chars = ''.join(c for c in word if c.isalpha())
    if alpha_chars.isupper() and len(alpha_chars) > 1:
        return False

    cleaned = clean_word(word)
    
    # Ignore empty or strictly numeric words
    if not cleaned or cleaned.isdigit():
        return False
        
    # Ignore whitelisted terms (acronyms, common jargon)
    if cleaned in whitelist_set:
        return False
        
    # Ignore single character words
    if len(cleaned) <= 1:
        return False
        
    # Ignore 2-letter words unless they are common English terms
    if len(cleaned) == 2 and cleaned not in COMMON_EN_2_LETTER:
        return False

    # Check mixed Indonesian-English words (e.g. di-download, meng-upload, di-scan)
    # PUEBI rule: Indonesian prefix + foreign word should have a hyphen and the foreign word should be italic
    mixed_match = re.match(r'^(di|meng|men|peng|pe|ter|se|ke)-([a-zA-Z]+)$', cleaned)
    if mixed_match:
        root_word = mixed_match.group(2)
        if root_word in en_set and root_word not in id_set:
            return True

    # If it's a standard Indonesian word, it is NOT foreign
    if cleaned in id_set:
        return False

    # If it's in the English dictionary, it is foreign
    if cleaned in en_set:
        return True

    # Simple suffix stemming for English words (plurals, continuous, past-tense)
    if cleaned.endswith('s') and cleaned[:-1] in en_set and cleaned[:-1] not in id_set:
        return True
    if cleaned.endswith('es') and cleaned[:-2] in en_set and cleaned[:-2] not in id_set:
        return True
    if cleaned.endswith('ing') and cleaned[:-3] in en_set and cleaned[:-3] not in id_set:
        return True
    if cleaned.endswith('ed') and cleaned[:-2] in en_set and cleaned[:-2] not in id_set:
        return True
    if cleaned.endswith('ly') and cleaned[:-2] in en_set and cleaned[:-2] not in id_set:
        return True

    return False

def is_italic_node(node):
    """Trace up the DOM to see if the text node is styled as italic."""
    parent = node.parent
    while parent and parent.name != '[document]':
        if parent.name in ['i', 'em', 'cite', 'dfn']:
            return True
        style = parent.get('style', '')
        if style and 'font-style' in style and 'italic' in style:
            return True
        parent = parent.parent
    return False

def get_block_context(node):
    """Find the closest block parent element to extract the sentence/paragraph context."""
    parent = node.parent
    block_tags = {'p', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'section', 'article', 'blockquote'}
    while parent and parent.name != '[document]':
        if parent.name in block_tags:
            return parent.get_text().strip()
        parent = parent.parent
    return node.strip()

def analyze_html(html_content, id_set, en_set, whitelist_set):
    """Parse HTML and detect italic formatting issues."""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Remove script, style, and comments to avoid processing metadata
    for script in soup(["script", "style", "meta", "link", "head"]):
        script.decompose()
        
    for comment in soup.find_all(text=lambda text: isinstance(text, Comment)):
        comment.extract()
        
    # Also ignore header, nav, and footer to focus on main content if they exist
    for junk in soup(["nav", "footer", "header"]):
        junk.decompose()

    errors = []
    word_count = 0
    foreign_count = 0
    
    # Find all text nodes
    text_nodes = soup.find_all(text=True)
    
    for node in text_nodes:
        text = node.strip()
        if not text:
            continue
            
        italic_active = is_italic_node(node)
        
        # Tokenize by whitespace and keep punctuation for sentence-level context
        words = text.split()
        for raw_word in words:
            cleaned = clean_word(raw_word)
            if not cleaned or cleaned.isdigit():
                continue
                
            word_count += 1
            
            # Check if word is foreign
            is_foreign = is_foreign_word(cleaned, id_set, en_set, whitelist_set)
            if is_foreign:
                foreign_count += 1
                
            context = get_block_context(node)
            # Limit context length for display readability
            if len(context) > 250:
                # Truncate context to show around the word
                word_idx = context.lower().find(cleaned)
                if word_idx != -1:
                    start = max(0, word_idx - 100)
                    end = min(len(context), word_idx + 100)
                    context = ("..." if start > 0 else "") + context[start:end] + ("..." if end < len(context) else "")

            # Rule 1: Foreign word should be italic
            if is_foreign and not italic_active:
                errors.append({
                    "word": raw_word,
                    "cleaned": cleaned,
                    "type": "Missing Italic",
                    "description": f"Kata asing '{raw_word}' seharusnya dicetak miring.",
                    "context": context
                })
                
            # Rule 2: Indonesian word should NOT be italic (optional warning)
            elif not is_foreign and italic_active and cleaned in id_set:
                errors.append({
                    "word": raw_word,
                    "cleaned": cleaned,
                    "type": "Unnecessary Italic",
                    "description": f"Kata bahasa Indonesia '{raw_word}' dicetak miring (potensi salah).",
                    "context": context
                })
                
    return errors, word_count, foreign_count

def generate_report(errors, word_count, foreign_count, file_name, output_path):
    """Generate a premium responsive HTML dashboard report."""
    missing_italic = [e for e in errors if e["type"] == "Missing Italic"]
    unnecessary_italic = [e for e in errors if e["type"] == "Unnecessary Italic"]
    
    error_density = (len(errors) / word_count * 100) if word_count > 0 else 0
    accuracy = 100 - error_density
    
    # HTML Row Generation
    rows_html = ""
    for idx, err in enumerate(errors, 1):
        badge_class = "badge-danger" if err["type"] == "Missing Italic" else "badge-warning"
        
        # Highlight the word in the context
        context_escaped = html_escape(err["context"])
        word_escaped = html_escape(err["word"])
        cleaned_escaped = html_escape(err["cleaned"])
        
        # Highlight using a robust case-insensitive word-boundary replace
        try:
            highlighted = re.sub(
                r'\b(' + re.escape(word_escaped) + r'|' + re.escape(cleaned_escaped) + r')\b', 
                r'<mark class="highlight">\1</mark>', 
                context_escaped, 
                flags=re.IGNORECASE
            )
        except Exception:
            highlighted = context_escaped.replace(word_escaped, f'<mark class="highlight">{word_escaped}</mark>')
            
        rows_html += f"""
        <tr class="error-row" data-type="{err["type"]}">
            <td>{idx}</td>
            <td class="word-col"><strong>{html_escape(err["word"])}</strong></td>
            <td><span class="badge {badge_class}">{err["type"]}</span></td>
            <td>{err["description"]}</td>
            <td class="context-col">{highlighted}</td>
        </tr>
        """
        
    html_template = f"""<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Laporan Deteksi Italic - {html_escape(file_name)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg-primary: #0f172a;
            --bg-secondary: #1e293b;
            --bg-accent: #334155;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --accent-primary: #6366f1;
            --accent-primary-hover: #4f46e5;
            --danger: #ef4444;
            --warning: #f59e0b;
            --success: #10b981;
            --border-color: #334155;
        }}

        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-main);
            line-height: 1.6;
            padding: 2rem;
        }}

        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}

        header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2.5rem;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 1.5rem;
        }}

        h1 {{
            font-size: 2.2rem;
            font-weight: 700;
            background: linear-gradient(to right, #818cf8, #e0e7ff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }}

        .file-info {{
            font-size: 0.95rem;
            color: var(--text-muted);
            margin-top: 0.3rem;
        }}

        /* Dashboard Stats Grid */
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2.5rem;
        }}

        .stat-card {{
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
            position: relative;
            overflow: hidden;
            transition: transform 0.2s, border-color 0.2s;
        }}

        .stat-card:hover {{
            transform: translateY(-2px);
            border-color: var(--accent-primary);
        }}

        .stat-card::before {{
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: var(--accent-primary);
        }}

        .stat-card.danger::before {{ background: var(--danger); }}
        .stat-card.warning::before {{ background: var(--warning); }}
        .stat-card.success::before {{ background: var(--success); }}

        .stat-label {{
            font-size: 0.9rem;
            color: var(--text-muted);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}

        .stat-value {{
            font-size: 2.2rem;
            font-weight: 700;
            margin-top: 0.5rem;
            display: flex;
            align-items: baseline;
        }}

        .stat-unit {{
            font-size: 1rem;
            color: var(--text-muted);
            margin-left: 0.25rem;
            font-weight: 400;
        }}

        /* Filter Controls */
        .filter-section {{
            display: flex;
            gap: 1rem;
            margin-bottom: 1.5rem;
            align-items: center;
        }}

        .filter-btn {{
            background: var(--bg-secondary);
            color: var(--text-main);
            border: 1px solid var(--border-color);
            padding: 0.6rem 1.2rem;
            border-radius: 9999px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s;
            font-size: 0.9rem;
        }}

        .filter-btn:hover {{
            border-color: var(--text-muted);
        }}

        .filter-btn.active {{
            background: var(--accent-primary);
            border-color: var(--accent-primary);
        }}

        /* Report Table Container */
        .table-container {{
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        }}

        table {{
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }}

        th, td {{
            padding: 1.2rem 1.5rem;
            border-bottom: 1px solid var(--border-color);
        }}

        th {{
            background-color: rgba(15, 23, 42, 0.4);
            font-weight: 600;
            color: var(--text-muted);
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}

        tr:last-child td {{
            border-bottom: none;
        }}

        tr:hover td {{
            background-color: rgba(51, 65, 85, 0.3);
        }}

        .word-col {{
            color: #a5b4fc;
        }}

        .context-col {{
            font-family: 'Outfit', sans-serif;
            font-size: 0.95rem;
            color: #cbd5e1;
        }}

        /* Badges */
        .badge {{
            display: inline-flex;
            align-items: center;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}

        .badge-danger {{
            background-color: rgba(239, 68, 68, 0.15);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.3);
        }}

        .badge-warning {{
            background-color: rgba(245, 158, 11, 0.15);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.3);
        }}

        /* Highlights */
        mark.highlight {{
            background-color: rgba(239, 68, 68, 0.25);
            color: #f87171;
            padding: 0.1rem 0.3rem;
            border-radius: 4px;
            border: 1px solid rgba(239, 68, 68, 0.4);
            font-weight: 600;
        }}

        tr[data-type="Unnecessary Italic"] mark.highlight {{
            background-color: rgba(245, 158, 11, 0.25);
            color: #fbbf24;
            border: 1px solid rgba(245, 158, 11, 0.4);
        }}

        /* Empty State */
        .empty-state {{
            padding: 4rem;
            text-align: center;
            color: var(--text-muted);
        }}

        .empty-state h3 {{
            color: var(--text-main);
            margin-bottom: 0.5rem;
            font-size: 1.5rem;
        }}

        @media (max-width: 768px) {{
            body {{
                padding: 1rem;
            }}
            th, td {{
                padding: 0.8rem 1rem;
            }}
            .stats-grid {{
                grid-template-columns: 1fr;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>Italic Scan Report</h1>
                <div class="file-info">Nama File: {html_escape(file_name)}</div>
            </div>
            <div>
                <span class="badge" style="background: var(--bg-secondary); border: 1px solid var(--border-color); font-size: 0.85rem; color: var(--text-muted); padding: 0.5rem 1rem;">
                    Offline Analyzer v1.0
                </span>
            </div>
        </header>

        <!-- Stats Section -->
        <div class="stats-grid">
            <div class="stat-card success">
                <span class="stat-label">Akurasi Italic</span>
                <span class="stat-value">{accuracy:.1f}<span class="stat-unit">%</span></span>
            </div>
            <div class="stat-card">
                <span class="stat-label">Total Kata Dipindai</span>
                <span class="stat-value">{word_count}</span>
            </div>
            <div class="stat-card danger">
                <span class="stat-label">Missing Italic</span>
                <span class="stat-value">{len(missing_italic)}</span>
            </div>
            <div class="stat-card warning">
                <span class="stat-label">Unnecessary Italic</span>
                <span class="stat-value">{len(unnecessary_italic)}</span>
            </div>
        </div>

        <!-- Filter Controls -->
        <div class="filter-section">
            <span style="font-weight: 600; font-size: 0.95rem; color: var(--text-muted); margin-right: 0.5rem;">Filter Temuan:</span>
            <button class="filter-btn active" onclick="filterType('All')">Semua ({len(errors)})</button>
            <button class="filter-btn" onclick="filterType('Missing Italic')">Missing Italic ({len(missing_italic)})</button>
            <button class="filter-btn" onclick="filterType('Unnecessary Italic')">Unnecessary Italic ({len(unnecessary_italic)})</button>
        </div>

        <!-- Main Report Table -->
        <div class="table-container">
            {f"""
            <table>
                <thead>
                    <tr>
                        <th style="width: 50px;">No</th>
                        <th style="width: 150px;">Kata</th>
                        <th style="width: 180px;">Jenis Temuan</th>
                        <th>Keterangan</th>
                        <th>Konteks Kalimat</th>
                    </tr>
                </thead>
                <tbody id="report-body">
                    {rows_html}
                </tbody>
            </table>
            """ if errors else """
            <div class="empty-state">
                <h3>Luar Biasa! 🎉</h3>
                <p>Tidak ada kesalahan penulisan huruf miring (italic) yang ditemukan pada file ini.</p>
            </div>
            """}
        </div>
    </div>

    <script>
        function filterType(type) {{
            // Update active state of buttons
            const buttons = document.querySelectorAll('.filter-btn');
            buttons.forEach(btn => btn.classList.remove('active'));
            
            // Set active button
            event.target.classList.add('active');
            
            // Filter table rows
            const rows = document.querySelectorAll('.error-row');
            rows.forEach(row => {{
                if (type === 'All') {{
                    row.style.display = '';
                }} else {{
                    const rowType = row.getAttribute('data-type');
                    if (rowType === type) {{
                        row.style.display = '';
                    }} else {{
                        row.style.display = 'none';
                    }}
                }}
            }});
        }}
    </script>
</body>
</html>
"""
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_template)
    print(f"Report generated successfully: {output_path}")

def html_escape(text):
    """Simple HTML escaping for security and tags integrity."""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#x27;")

def main():
    parser = argparse.ArgumentParser(description="Detektor Italic Otomatis (Page Capture Offline)")
    parser.add_argument("input_file", nargs="?", help="Path ke file HTML lokal hasil page capture.")
    parser.add_argument("--whitelist", default="whitelist.txt", help="Path ke file whitelist kustom.")
    args = parser.parse_args()

    # Define paths
    dict_dir = "dictionaries"
    id_dict_path = os.path.join(dict_dir, "indonesian.txt")
    en_dict_path = os.path.join(dict_dir, "english.txt")
    
    # Check if dictionaries exist
    if not os.path.exists(id_dict_path) or not os.path.exists(en_dict_path):
        print("Error: Kamus belum lengkap. Silakan jalankan 'python download_dictionaries.py' terlebih dahulu.")
        sys.exit(1)
        
    id_set = load_words(id_dict_path)
    en_set = load_words(en_dict_path)
    whitelist_set = load_whitelist(args.whitelist)

    # Determine files to scan
    files_to_scan = []
    if args.input_file:
        if os.path.exists(args.input_file):
            files_to_scan.append(args.input_file)
        else:
            print(f"Error: File tidak ditemukan: {args.input_file}")
            sys.exit(1)
    else:
        # Scan current workspace directory for .html files (except report.html and templates)
        print("Mencari file HTML di direktori kerja saat ini...")
        for file in os.listdir('.'):
            if file.endswith('.html') and file != 'report.html' and not file.startswith('test_'):
                files_to_scan.append(file)
                
        if not files_to_scan:
            print("\n[INFO] Tidak ada file input HTML yang ditentukan atau ditemukan di folder.")
            print("Silakan taruh file HTML hasil page capture di folder ini, atau jalankan:")
            print("   python detector.py <nama_file.html>")
            
            # Create a quick demo template if empty to guide the user
            create_demo = input("\nApakah Anda ingin membuat file contoh 'test_page.html' untuk uji coba? (y/n): ")
            if create_demo.lower() == 'y':
                create_test_file()
                files_to_scan.append('test_page.html')
            else:
                sys.exit(0)

    # Process files
    for file_path in files_to_scan:
        print(f"\nMemindai file: {file_path}...")
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        except Exception as e:
            print(f"Gagal membaca file {file_path}: {e}")
            continue
            
        errors, word_count, foreign_count = analyze_html(content, id_set, en_set, whitelist_set)
        
        output_report = f"report_{os.path.splitext(os.path.basename(file_path))[0]}.html"
        generate_report(errors, word_count, foreign_count, file_path, output_report)
        
        print("\n" + "="*50)
        print(f"HASIL ANALISIS UNTUK {file_path}:")
        print(f"Total Kata: {word_count}")
        print(f"Total Kata Asing: {foreign_count}")
        print(f"Total Kesalahan: {len(errors)}")
        print(f"  - Kurang Italic (Missing): {len([e for e in errors if e['type'] == 'Missing Italic'])}")
        print(f"  - Kelebihan Italic (Unnecessary): {len([e for e in errors if e['type'] == 'Unnecessary Italic'])}")
        print(f"Laporan HTML lengkap dibuat: {output_report}")
        print("="*50)

def create_test_file():
    """Create a sample HTML file with intentional formatting errors for verification."""
    html_demo = """<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Halaman Contoh Pengujian Italic</title>
</head>
<body>
    <h1>Pengujian Sistem Deteksi Huruf Miring</h1>
    <p>
        Dalam era digital ini, teknologi <i>information technology</i> sangat berkembang pesat.
        Banyak sekali mahasiswa yang melakukan download materi kuliah langsung dari internet.
        Namun, tidak sedikit pula yang lupa menerapkan format italic pada kata asing tersebut.
    </p>
    <p>
        Sebagai contoh, kata seperti <i>database</i> dan <i>server</i> sering sekali ditulis salah.
        Sebaliknya, kata bahasa Indonesia seperti <i>data</i> atau <i>proses</i> terkadang malah dicetak miring secara tidak perlu.
    </p>
    <p>
        Selain itu, penulisan kata turunan campuran juga perlu diperhatikan. 
        Contohnya adalah kata di-download, meng-upload, atau di-scan. Jika ditulis tanpa huruf miring,
        maka dianggap kurang tepat menurut pedoman EYD atau PUEBI.
    </p>
</body>
</html>
"""
    with open('test_page.html', 'w', encoding='utf-8') as f:
        f.write(html_demo)
    print("File demo 'test_page.html' berhasil dibuat.")

if __name__ == "__main__":
    main()
