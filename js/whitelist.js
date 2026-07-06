// Whitelist exception management and smart suggestions

import { whitelist, updateWhitelist, getElements } from './config.js';
import { cleanWord, isForeignWord } from './dictionary.js';
import { scanText } from './scanner.js';

// Load whitelist from localStorage
export function loadSavedWhitelist() {
    const saved = localStorage.getItem('italic_whitelist');
    if (saved) {
        const words = saved.split(',').map(w => w.trim().toLowerCase()).filter(w => w);
        updateWhitelist(new Set(words));
    }
}

// Save whitelist changes
export function saveWhitelist() {
    const elements = getElements();
    const val = elements.whitelistTextarea.value;
    const words = val.split(/[\n,]+/).map(w => w.trim().toLowerCase()).filter(w => w);
    updateWhitelist(new Set(words));
    localStorage.setItem('italic_whitelist', Array.from(whitelist).join(','));
    
    // Decoupled close modal action
    if (elements.whitelistModal) {
        elements.whitelistModal.style.display = 'none';
    }
    
    scanText(); // Rescan text with new whitelist exceptions
}

// Scan editor text for new whitelist candidates
export function scanTextForWhitelistSuggestions() {
    const elements = getElements();
    const container = document.getElementById('suggestions-container');
    if (!container || !elements.editor) return;
    
    const text = elements.editor.innerText;
    const wordRegex = /[a-zA-Z]+(-[a-zA-Z]+)*/g;
    let match;
    const uniqueCandidates = new Set();
    
    while ((match = wordRegex.exec(text)) !== null) {
        const rawWord = match[0];
        const cleaned = cleanWord(rawWord);
        if (!cleaned || cleaned.length <= 1) continue;
        
        // Find candidates that are currently not whitelisted
        if (!whitelist.has(cleaned)) {
            const isForeign = isForeignWord(cleaned, rawWord);
            const isAllCaps = rawWord === rawWord.toUpperCase() && !/^\d+$/.test(rawWord);
            
            if (isForeign || isAllCaps) {
                uniqueCandidates.add(cleaned);
            }
        }
    }
    
    if (uniqueCandidates.size === 0) {
        container.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">Tidak ditemukan kata asing baru di dokumen.</span>`;
        return;
    }
    
    container.innerHTML = '';
    uniqueCandidates.forEach(word => {
        const badge = document.createElement('span');
        badge.className = 'suggestion-badge selected'; // Selected by default
        badge.setAttribute('data-word', word);
        badge.textContent = word;
        badge.onclick = () => badge.classList.toggle('selected');
        container.appendChild(badge);
    });
}

// Map selected suggestion badges to the Whitelist textarea and save
export function mapSelectedSuggestionsToWhitelist() {
    const elements = getElements();
    const container = document.getElementById('suggestions-container');
    const selectedBadges = container.querySelectorAll('.suggestion-badge.selected');
    if (selectedBadges.length === 0) {
        alert('Pilih minimal satu kata dari saran terlebih dahulu.');
        return;
    }
    
    const wordsToMap = [];
    selectedBadges.forEach(badge => {
        wordsToMap.push(badge.getAttribute('data-word'));
    });
    
    // Add to current textarea value
    let currentVal = elements.whitelistTextarea.value.trim();
    if (currentVal) {
        // Ensure comma-separated spacing
        currentVal += ', ' + wordsToMap.join(', ');
    } else {
        currentVal = wordsToMap.join(', ');
    }
    
    elements.whitelistTextarea.value = currentVal;
    saveWhitelist();
    
    // Re-render suggestions to clear already mapped words
    scanTextForWhitelistSuggestions();
}
