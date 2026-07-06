// Formula variables mapping, smart suggestions, and batch formatting

import { formulaVariables, updateFormulaVariables, getElements } from './config.js';
import { isVariableContext } from './utils.js';
import { scanText } from './scanner.js';

// Load formula variables from localStorage
export function loadSavedFormulaVariables() {
    const saved = localStorage.getItem('italic_formula_variables');
    if (saved) {
        const vars = saved.split(',').map(v => v.trim().toLowerCase()).filter(v => v);
        updateFormulaVariables(new Set(vars));
    }
}

// Open Formula mapping Modal
export function openFormulaModal() {
    const modal = document.getElementById('formula-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    scanTextForFormulaSuggestions();
}

// Close Formula mapping Modal
export function closeFormulaModal() {
    const modal = document.getElementById('formula-modal');
    if (modal) modal.style.display = 'none';
}

// Scan editor text for single standalone letters that acts as mathematical variables
export function scanTextForFormulaSuggestions() {
    const elements = getElements();
    const container = document.getElementById('formula-suggestions-container');
    if (!container || !elements.editor) return;

    const text = elements.editor.innerText;
    const wordRegex = /[a-zA-Z]/g;
    let match;
    const uniqueCandidates = new Set();

    while ((match = wordRegex.exec(text)) !== null) {
        const char = match[0];
        if (isVariableContext(char, match.index, text)) {
            uniqueCandidates.add(char.toLowerCase());
        }
    }

    if (uniqueCandidates.size === 0) {
        container.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">Tidak ditemukan variabel rumus baru (huruf tunggal) di dokumen.</span>`;
        return;
    }

    container.innerHTML = '';
    uniqueCandidates.forEach(char => {
        const badge = document.createElement('span');
        const isMapped = formulaVariables.has(char);
        
        badge.className = `suggestion-badge ${isMapped ? 'selected' : ''}`;
        badge.setAttribute('data-word', char);
        badge.textContent = char;
        badge.onclick = () => badge.classList.toggle('selected');
        container.appendChild(badge);
    });
}

// Map selected badges to formulaVariables list then rescan (results shown as cards in sidebar)
export function mapSelectedFormulaSuggestions() {
    const container = document.getElementById('formula-suggestions-container');
    if (!container) return;

    const selectedBadges = container.querySelectorAll('.suggestion-badge.selected');
    const selectedVars = Array.from(selectedBadges).map(badge => badge.getAttribute('data-word'));

    // Save mapped variables
    updateFormulaVariables(new Set(selectedVars));
    localStorage.setItem('italic_formula_variables', selectedVars.join(','));
    
    closeFormulaModal();

    // Switch to formula tab and rescan so items appear as individual cards
    if (window.switchSidebarTab) window.switchSidebarTab('formula');
    scanText();
}

// Auto italicize all occurrences of selected variables in the editor
function autoItalicizeSelectedVariables(selectedVars) {
    const elements = getElements();
    if (!elements.editor) return;

    // Clean active highlights first
    const clearConnector = window.clearConnectorLine || (() => {});
    clearConnector();
    
    const selectors = ['.issue-span', '.citation-text'];
    selectors.forEach(selector => {
        elements.editor.querySelectorAll(selector).forEach(el => {
            const pNode = el.parentNode;
            while (el.firstChild) {
                pNode.insertBefore(el.firstChild, el);
            }
            pNode.removeChild(el);
        });
    });
    elements.editor.normalize();

    // Get text nodes
    const textNodes = [];
    const walker = document.createTreeWalker(elements.editor, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
        if (node.parentNode && !['STYLE', 'SCRIPT', 'TITLE', 'HEAD', 'I', 'EM', 'CITE'].includes(node.parentNode.tagName)) {
            textNodes.push(node);
        }
    }

    let fixedCount = 0;
    const targetSet = new Set(selectedVars);

    for (const tNode of textNodes) {
        const text = tNode.nodeValue;
        const wordRegex = /[a-zA-Z]/g;
        let m;
        const matchesToItalicize = [];

        while ((m = wordRegex.exec(text)) !== null) {
            const char = m[0];
            const lowerChar = char.toLowerCase();
            if (targetSet.has(lowerChar) && isVariableContext(char, m.index, text)) {
                matchesToItalicize.push({
                    char: char,
                    index: m.index
                });
            }
        }

        if (matchesToItalicize.length > 0) {
            let currentNode = tNode;
            for (let j = matchesToItalicize.length - 1; j >= 0; j--) {
                const match = matchesToItalicize[j];
                const wordNode = currentNode.splitText(match.index);
                wordNode.splitText(1);

                const iTag = document.createElement('i');
                wordNode.parentNode.replaceChild(iTag, wordNode);
                iTag.appendChild(wordNode);

                fixedCount++;
            }
        }
    }

    elements.editor.normalize();
    scanText();
    alert(`Berhasil memformat ${fixedCount} variabel matematika menjadi cetak miring.`);
}
