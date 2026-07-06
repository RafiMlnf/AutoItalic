// Common DOM and string utilities

import { getElements } from './config.js';

// Get the sentence/paragraph context of a text node
export function getBlockContext(node) {
    const elements = getElements();
    let parent = node.parentNode;
    const blockTags = ['P', 'LI', 'TD', 'TH', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'SECTION', 'ARTICLE', 'BLOCKQUOTE'];
    while (parent && parent !== elements.editor) {
        if (blockTags.includes(parent.tagName)) {
            return parent.textContent.trim();
        }
        parent = parent.parentNode;
    }
    return node.textContent.trim();
}

// Clean warning spans and faded citation markup from the editor
export function cleanEditorMarkup(parent) {
    const selectors = ['.issue-span', '.citation-text'];
    selectors.forEach(selector => {
        const elements = parent.querySelectorAll(selector);
        elements.forEach(el => {
            const pNode = el.parentNode;
            while (el.firstChild) {
                pNode.insertBefore(el.firstChild, el);
            }
            pNode.removeChild(el);
        });
    });
    parent.normalize();
}

// HTML escaping helper
export function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Auto detect and convert plain text (Markdown, Spreadsheet TSV) into HTML table markup
export function detectAndConvertTextTable(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return null;

    // 1. Check if it's a Markdown table
    const isMarkdownTable = lines.some(line => line.includes('|') && line.includes('---')) && 
                            lines.every(line => {
                                const trimmed = line.trim();
                                return trimmed === '' || (trimmed.startsWith('|') && trimmed.endsWith('|'));
                            });
                            
    if (isMarkdownTable) {
        let html = '<table class="editor-table">';
        let hasHeader = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === '') continue;
            
            // Skip separator line (e.g. |---|---|)
            if (line.includes('---')) {
                continue;
            }
            
            // Split cells, clean leading and trailing pipes
            const cells = line.split('|').map(c => c.trim());
            if (cells[0] === '') cells.shift();
            if (cells[cells.length - 1] === '') cells.pop();
            
            if (cells.length === 0) continue;
            
            html += '<tr>';
            for (const cell of cells) {
                const tag = !hasHeader ? 'th' : 'td';
                html += `<${tag}>${cell}</${tag}>`;
            }
            html += '</tr>';
            hasHeader = true;
        }
        html += '</table>';
        return html;
    }

    // 2. Check if it's a Spreadsheet Tab-separated Values (TSV) table
    const rowsWithTabs = lines.map(line => line.split('\t'));
    const colCounts = rowsWithTabs.map(r => r.length);
    const maxCols = Math.max(...colCounts);
    const minCols = Math.min(...colCounts);

    if (maxCols >= 2 && maxCols === minCols && lines.length >= 2) {
        let html = '<table class="editor-table">';
        for (let i = 0; i < rowsWithTabs.length; i++) {
            html += '<tr>';
            for (const cell of rowsWithTabs[i]) {
                const tag = (i === 0) ? 'th' : 'td';
                html += `<${tag}>${cell.trim()}</${tag}>`;
            }
            html += '</tr>';
        }
        html += '</table>';
        return html;
    }

    return null;
}

// Save caret (cursor) character offset inside contenteditable container
export function saveCaretPosition(context) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(context);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
}

// Restore caret (cursor) position inside contenteditable using character count offset
export function restoreCaretPosition(context, charCount) {
    if (charCount === null || charCount === undefined) return;
    const selection = window.getSelection();
    if (!selection) return;
    
    const range = document.createRange();
    range.setStart(context, 0);
    range.collapse(true);
    
    const nodeStack = [context];
    let node, foundStart = false, stop = false;
    let charIndex = 0;
    
    while (!stop && (node = nodeStack.pop())) {
        if (node.nodeType === Node.TEXT_NODE) {
            const nextCharIndex = charIndex + node.length;
            if (!foundStart && charCount >= charIndex && charCount <= nextCharIndex) {
                try {
                    range.setStart(node, charCount - charIndex);
                    range.setEnd(node, charCount - charIndex);
                    stop = true;
                } catch (e) {
                    // Fail-safe fallback if index is out of bounds
                }
            }
            charIndex = nextCharIndex;
        } else {
            let i = node.childNodes.length;
            while (i--) {
                nodeStack.push(node.childNodes[i]);
            }
        }
    }
    
    selection.removeAllRanges();
    selection.addRange(range);
}

// Check if a DOM node resides inside an HTML table
export function isInsideTable(node) {
    const elements = getElements();
    let parent = node.parentNode;
    while (parent && parent !== elements.editor) {
        if (parent.tagName && parent.tagName.toLowerCase() === 'table') {
            return true;
        }
        parent = parent.parentNode;
    }
    return false;
}

// Determine if a single letter stands as a mathematical variable based on its context
export function isVariableContext(word, index, sentenceText) {
    if (word.length !== 1 || !/[a-zA-Z]/.test(word)) return false;
    
    // Check if it is a list marker like "a. " or "a) "
    const afterChar = sentenceText[index + 1] || '';
    if (afterChar === '.' || afterChar === ')') {
        const afterAfterChar = sentenceText[index + 2] || '';
        if (afterAfterChar === '' || /\s/.test(afterAfterChar)) {
            return false;
        }
    }
    
    // Check if it is wrapped in parentheses like "(a)"
    const beforeChar = sentenceText[index - 1] || '';
    if (beforeChar === '(' && afterChar === ')') {
        return false;
    }
    
    return true;
}

