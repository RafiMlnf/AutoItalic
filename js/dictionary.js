// Dictionary operations and analysis helpers

import { indonesianWords, englishWords, whitelist, COMMON_EN_2_LETTER, getElements } from './config.js';

export function cleanWord(word) {
    return word.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').toLowerCase();
}

// Check if word is foreign and requires italicization
export function isForeignWord(word, rawWord = "") {
    const cleaned = cleanWord(word);
    
    if (!cleaned || /^\d+$/.test(cleaned)) return false;
    if (whitelist.has(cleaned)) return false;
    if (cleaned.length <= 1) return false;

    // Abbreviation/Acronym rule: All uppercase words are abbreviations and should not be italicized
    if (rawWord && rawWord === rawWord.toUpperCase() && rawWord.length > 1 && !/^\d+$/.test(rawWord)) {
        return false;
    }
    
    // Check short word rules
    if (cleaned.length === 2 && !COMMON_EN_2_LETTER.has(cleaned)) return false;

    // Check code-mixing pattern like di-download, meng-upload, di-scan
    const mixedMatch = cleaned.match(/^(di|meng|men|peng|pe|ter|se|ke)-([a-zA-Z]+)$/);
    if (mixedMatch) {
        const root = mixedMatch[2];
        if (englishWords.has(root) && !indonesianWords.has(root)) {
            return true;
        }
    }

    if (indonesianWords.has(cleaned)) return false;
    if (englishWords.has(cleaned)) return true;

    // Common English suffixes checks
    if (cleaned.endsWith('s') && englishWords.has(cleaned.slice(0, -1)) && !indonesianWords.has(cleaned.slice(0, -1))) return true;
    if (cleaned.endsWith('es') && englishWords.has(cleaned.slice(0, -2)) && !indonesianWords.has(cleaned.slice(0, -2))) return true;
    if (cleaned.endsWith('ing') && englishWords.has(cleaned.slice(0, -3)) && !indonesianWords.has(cleaned.slice(0, -3))) return true;
    if (cleaned.endsWith('ed') && englishWords.has(cleaned.slice(0, -2)) && !indonesianWords.has(cleaned.slice(0, -2))) return true;
    if (cleaned.endsWith('ly') && englishWords.has(cleaned.slice(0, -2)) && !indonesianWords.has(cleaned.slice(0, -2))) return true;

    return false;
}

// Load dictionaries offline — scanText called from main.js after this resolves
export async function loadDictionaries() {
    const elements = getElements();
    try {
        const idResponse = await fetch('dictionaries/indonesian.txt');
        if (!idResponse.ok) throw new Error('Indonesian dict not found');
        const idText = await idResponse.text();
        idText.split(/\r?\n/).forEach(word => {
            const w = word.trim().toLowerCase();
            if (w) indonesianWords.add(w);
        });

        const enResponse = await fetch('dictionaries/english.txt');
        if (!enResponse.ok) throw new Error('English dict not found');
        const enText = await enResponse.text();
        enText.split(/\r?\n/).forEach(word => {
            const w = word.trim().toLowerCase();
            if (w) englishWords.add(w);
        });

        if (elements.statusDot) elements.statusDot.classList.add('active');
        if (elements.statusText) elements.statusText.innerText = 'Kamus Siap (Offline)';
        console.log(`Dictionaries loaded: ID = ${indonesianWords.size}, EN = ${englishWords.size}`);

        // Return true so caller (main.js) can decide whether to run scanText
        return true;
    } catch (error) {
        console.error(error);
        if (elements.statusText) elements.statusText.innerText = 'Gagal memuat kamus! Gunakan server.py';
        return false;
    }
}
