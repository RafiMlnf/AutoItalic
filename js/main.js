// Application entry point and initialization

import { getElements } from './config.js';
import { loadDictionaries } from './dictionary.js';
import { loadSavedWhitelist, saveWhitelist, scanTextForWhitelistSuggestions, mapSelectedSuggestionsToWhitelist } from './whitelist.js';
import { scanText } from './scanner.js';
import { setupConnectorEvents, clearConnectorLine } from './connector.js';
import { clearEditor, handleEditorInput, fixIssue } from './editor.js';
import { cleanEditorMarkup, detectAndConvertTextTable } from './utils.js';
import { openWhitelistModal, closeWhitelistModal, toggleEditorTheme, openSettingsModal, closeSettingsModal, saveSettings, switchSidebarTab } from './ui.js';
import { loadSavedFormulaVariables, openFormulaModal, closeFormulaModal, scanTextForFormulaSuggestions, mapSelectedFormulaSuggestions } from './formula.js';

// Expose to window for inline HTML onclick handlers
window.scanText = scanText;
window.clearEditor = clearEditor;
window.handleEditorInput = handleEditorInput;
window.closeWhitelistModal = closeWhitelistModal;
window.saveWhitelist = saveWhitelist;
window.scanTextForWhitelistSuggestions = scanTextForWhitelistSuggestions;
window.mapSelectedSuggestionsToWhitelist = mapSelectedSuggestionsToWhitelist;
window.toggleEditorTheme = toggleEditorTheme;
window.fixIssue = fixIssue;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveSettings = saveSettings;
window.switchSidebarTab = switchSidebarTab;
window.openFormulaModal = openFormulaModal;
window.closeFormulaModal = closeFormulaModal;
window.scanTextForFormulaSuggestions = scanTextForFormulaSuggestions;
window.mapSelectedFormulaSuggestions = mapSelectedFormulaSuggestions;

// openWhitelistModal coordinates the whitelist scan suggestion as well
window.openWhitelistModal = () => {
    openWhitelistModal();
    scanTextForWhitelistSuggestions();
};

// Setup Copy Interception on the editor
function setupCopyIntercept() {
    const elements = getElements();
    if (!elements.editor) return;

    elements.editor.addEventListener('copy', (e) => {
        e.preventDefault();
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const container = document.createElement('div');
        for (let i = 0; i < selection.rangeCount; i++) {
            container.appendChild(selection.getRangeAt(i).cloneContents());
        }
        cleanEditorMarkup(container);
        e.clipboardData.setData('text/html', container.innerHTML);
        e.clipboardData.setData('text/plain', container.textContent);
    });
}

// Setup Paste Interception to auto-detect and convert plain text tables
function setupPasteIntercept() {
    const elements = getElements();
    if (!elements.editor) return;

    elements.editor.addEventListener('paste', (e) => {
        if (!e.clipboardData) return;

        const htmlData = e.clipboardData.getData('text/html');
        const textData = e.clipboardData.getData('text/plain');

        // Case 1: Pasted content is rich HTML containing a table
        if (htmlData && htmlData.includes('<table')) {
            // Let the browser paste it, then decorate with our custom class after paint
            setTimeout(() => {
                elements.editor.querySelectorAll('table').forEach(tbl => {
                    if (!tbl.classList.contains('editor-table')) {
                        tbl.classList.add('editor-table');
                    }
                });
                scanText();
            }, 20);
            return;
        }

        // Case 2: Pasted content is plain text containing TSV or Markdown table markup
        if (textData) {
            const convertedHtml = detectAndConvertTextTable(textData);
            if (convertedHtml) {
                e.preventDefault();
                document.execCommand('insertHTML', false, convertedHtml);
                scanText();
            }
        }
    });
}

// Clear focus when clicking empty editor space
function setupClearFocusOnEmptyClick() {
    const elements = getElements();
    if (!elements.editor) return;

    elements.editor.addEventListener('click', (e) => {
        if (!e.target.classList.contains('issue-span')) {
            elements.editor.querySelectorAll('.issue-span').forEach(span => {
                span.classList.remove('active-focus');
            });
            document.querySelectorAll('.alert-card').forEach(card => {
                card.classList.remove('active');
            });
            clearConnectorLine();
        }
    });
}

// Initialize Application on DOMContentLoaded
window.addEventListener('DOMContentLoaded', async () => {
    // 1. Restore editor content
    const elements = getElements();
    const savedText = localStorage.getItem('italic_editor_text');
    if (savedText && elements.editor) {
        elements.editor.innerHTML = savedText;
    }

    // 2. Restore theme preference
    const savedTheme = localStorage.getItem('italic_editor_theme');
    if (savedTheme === 'light') {
        toggleEditorTheme();
    }

    // 3. Load whitelist and formula variables from localStorage
    loadSavedWhitelist();
    loadSavedFormulaVariables();

    // 4. Set up SVG connector scroll/resize listeners
    setupConnectorEvents();

    // 5. Set up copy intercept sanitization
    setupCopyIntercept();

    // 6. Set up paste auto-table converter
    setupPasteIntercept();

    // 7. Clear highlighting focus on background click
    setupClearFocusOnEmptyClick();

    // 8. Load dictionaries — then scan if there was saved text
    const loaded = await loadDictionaries();
    if (loaded && savedText) {
        scanText();
    }
});
