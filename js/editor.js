// Editor helper functions, DOM manipulation, copy interception, and auto-fixes

import { getElements, currentIssues, updateActiveIssueId } from './config.js';
import { clearConnectorLine } from './connector.js';
import { scanText } from './scanner.js';
import { cleanEditorMarkup, getBlockContext, isVariableContext } from './utils.js';

// Editor helper
export function clearEditor() {
    const elements = getElements();
    if (confirm('Apakah Anda yakin ingin mengosongkan editor?')) {
        if (elements.editor) elements.editor.innerHTML = '';
        localStorage.removeItem('italic_editor_text');
        if (elements.alertsListContainer) {
            elements.alertsListContainer.innerHTML = `
                <div class="empty-alerts">
                    <div class="empty-alerts-title">Semua Bersih!</div>
                    <p>Paste teks di kiri lalu klik "Pindai Teks" untuk melihat hasil analisis di sini.</p>
                </div>`;
        }
        updateStatsGlobal(0, 0, 0);
    }
}

// Helper to update stats when clearing editor
function updateStatsGlobal(totalWords, missing, unnecessary) {
    const elements = getElements();
    if (elements.statAccuracy) elements.statAccuracy.innerText = '100%';
    if (elements.statMissing) elements.statMissing.innerText = missing;
    if (elements.statUnnecessary) elements.statUnnecessary.innerText = unnecessary;
}

// Auto-run scan when typing stops for 800ms
let scanDebounceTimer;
export function handleEditorInput() {
    const elements = getElements();
    if (!elements.editor) return;
    clearTimeout(scanDebounceTimer);
    localStorage.setItem('italic_editor_text', elements.editor.innerHTML);
    
    // Auto-run scan after 800ms of no typing
    scanDebounceTimer = setTimeout(() => {
        scanText();
    }, 800);
}

// Helper to escape regex special characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper to split a formatting element (like <i>) at the position of a specific child node
function splitElementAtChild(parentEl, childNode) {
    const parentNode = parentEl.parentNode;
    if (!parentNode) return;

    const beforeClone = parentEl.cloneNode(false);
    const afterClone = parentEl.cloneNode(false);

    // Move siblings before childNode to beforeClone
    while (parentEl.firstChild && parentEl.firstChild !== childNode) {
        beforeClone.appendChild(parentEl.firstChild);
    }

    // Skip childNode, move next siblings to afterClone
    const nextSiblings = [];
    let sib = childNode.nextSibling;
    while (sib) {
        nextSiblings.push(sib);
        sib = sib.nextSibling;
    }

    for (const s of nextSiblings) {
        afterClone.appendChild(s);
    }

    // Insert clones and childNode in place of the original parent
    if (beforeClone.childNodes.length > 0) {
        parentNode.insertBefore(beforeClone, parentEl);
    }
    parentNode.insertBefore(childNode, parentEl);
    if (afterClone.childNodes.length > 0) {
        parentNode.insertBefore(afterClone, parentEl);
    }
    parentNode.removeChild(parentEl);
}

// DOM-Based Auto-Fixing
export function fixIssue(id) {
    const elements = getElements();
    const issue = currentIssues.find(i => i.id === id);
    if (!issue || !elements.editor) return;

    clearConnectorLine();
    updateActiveIssueId(null);
    cleanEditorMarkup(elements.editor);

    // Collect raw text nodes
    const textNodes = [];
    const walker = document.createTreeWalker(elements.editor, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
        if (node.parentNode && !['STYLE', 'SCRIPT', 'TITLE', 'HEAD'].includes(node.parentNode.tagName)) {
            textNodes.push(node);
        }
    }

    let targetNode = null;
    let targetMatch = null;
    // Uses lookbehind and lookahead to handle word boundary properly including hyphens (e.g. di-download)
    const regex = new RegExp(`(?<![a-zA-Z0-9-])${escapeRegExp(issue.word)}(?![a-zA-Z0-9-])`, 'i');

    for (const tNode of textNodes) {
        const text = tNode.nodeValue;
        const context = getBlockContext(tNode);
        
        if (context.includes(issue.context.substring(0, 15))) { // approximate context match
            const match = regex.exec(text);
            if (match) {
                targetNode = tNode;
                targetMatch = match;
                break;
            }
        }
    }

    if (targetNode && targetMatch) {
        if (issue.type === 'Missing Italic' || issue.type === 'Missing Italic (Variabel)') {
            const beforeNode = targetNode;
            const wordNode = beforeNode.splitText(targetMatch.index);
            wordNode.splitText(targetMatch[0].length);

            const iTag = document.createElement('i');
            wordNode.parentNode.replaceChild(iTag, wordNode);
            iTag.appendChild(wordNode);
            elements.editor.normalize();
        } 
        else if (issue.type === 'Unnecessary Italic') {
            // Split text node so the target word is isolated in its own text node
            const beforeNode = targetNode;
            const wordNode = beforeNode.splitText(targetMatch.index);
            wordNode.splitText(targetMatch[0].length);

            let parent = wordNode.parentNode;
            let wrapper = null;
            while (parent && parent !== elements.editor) {
                if (['I', 'EM'].includes(parent.tagName)) {
                    wrapper = parent;
                    break;
                }
                parent = parent.parentNode;
            }

            if (wrapper) {
                // Split the formatting wrapper tag at the target word node
                splitElementAtChild(wrapper, wordNode);
                elements.editor.normalize();
            }
        }
    } else {
        alert("Gagal melakukan perbaikan otomatis. Silakan pindai ulang.");
    }

    scanText();
}

// Automatically scan and italicize all plain text mathematical variables in the editor
export function autoFixAllVariables() {
    const elements = getElements();
    if (!elements.editor) return;

    // Filter current issues to find all 'Missing Italic (Variabel)' issues
    const varIssues = currentIssues.filter(i => i.type === 'Missing Italic (Variabel)');
    if (varIssues.length === 0) {
        alert('Tidak ditemukan variabel matematika yang perlu diperbaiki.');
        return;
    }

    if (confirm(`Apakah Anda yakin ingin secara otomatis memformat miring ${varIssues.length} variabel matematika?`)) {
        clearConnectorLine();
        updateActiveIssueId(null);
        cleanEditorMarkup(elements.editor);

        // Collect all raw text nodes that are not inside tags like title, style, script, or existing italics
        const textNodes = [];
        const walker = document.createTreeWalker(elements.editor, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
            if (node.parentNode && !['STYLE', 'SCRIPT', 'TITLE', 'HEAD', 'I', 'EM', 'CITE'].includes(node.parentNode.tagName)) {
                textNodes.push(node);
            }
        }

        let fixedCount = 0;

        for (const tNode of textNodes) {
            const text = tNode.nodeValue;
            
            // Scan for single letters in this text node
            const wordRegex = /[a-zA-Z]/g;
            let m;
            const matchesToItalicize = [];

            while ((m = wordRegex.exec(text)) !== null) {
                const char = m[0];
                if (isVariableContext(char, m.index, text)) {
                    matchesToItalicize.push({
                        char: char,
                        index: m.index
                    });
                }
            }

            if (matchesToItalicize.length > 0) {
                // Split text node in reverse index order to preserve split boundary offsets
                let currentNode = tNode;
                for (let j = matchesToItalicize.length - 1; j >= 0; j--) {
                    const match = matchesToItalicize[j];
                    
                    const wordNode = currentNode.splitText(match.index);
                    wordNode.splitText(1); // 1 letter variables

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
}

