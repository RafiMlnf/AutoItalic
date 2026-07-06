// Text scanning engine, sentence parsing, and violation detection

import { indonesianWords, updateCurrentIssues, getElements, formulaVariables } from './config.js';
import { cleanWord, isForeignWord } from './dictionary.js';
import { cleanEditorMarkup, saveCaretPosition, restoreCaretPosition, isInsideTable, isVariableContext } from './utils.js';
import { renderAlertCards, updateStats, focusIssue } from './ui.js';

// Check if an element node represents an italic formatting context
export function isItalicNode(node) {
    const elements = getElements();
    let parent = node.parentNode;
    while (parent && parent !== elements.editor) {
        const tag = parent.tagName ? parent.tagName.toLowerCase() : '';
        if (tag === 'i' || tag === 'em') return true;
        
        // Also check inline style
        const style = parent.getAttribute ? parent.getAttribute('style') : '';
        if (style && (style.includes('font-style: italic') || style.includes('font-style:italic'))) {
            return true;
        }
        parent = parent.parentNode;
    }
    return false;
}

// Main Scan Text logic
export function scanText() {
    const elements = getElements();
    if (!elements.editor) return;

    // Save caret position if editor is currently focused
    const isFocused = document.activeElement === elements.editor;
    let caretPos = null;
    if (isFocused) {
        caretPos = saveCaretPosition(elements.editor);
    }

    // 1. Clean editor markup (preserve text nodes and basic italic structure)
    cleanEditorMarkup(elements.editor);

    const textNodes = [];
    const walk = document.createTreeWalker(elements.editor, NodeFilter.SHOW_TEXT, null, false);
    let n;
    while (n = walk.nextNode()) {
        textNodes.push(n);
    }

    const currentIssues = [];
    let totalWords = 0;
    let issueId = 0;

    // Group text nodes by block-level paragraphs to correctly parse sentence boundaries
    const blocks = [];
    let currentBlockNodes = [];
    let lastBlockParent = null;

    for (const tNode of textNodes) {
        // Find closest block parent (P, DIV, etc.)
        let parent = tNode.parentNode;
        while (parent && parent !== elements.editor && window.getComputedStyle(parent).display === 'inline') {
            parent = parent.parentNode;
        }

        if (parent !== lastBlockParent && currentBlockNodes.length > 0) {
            blocks.push(currentBlockNodes);
            currentBlockNodes = [];
        }
        currentBlockNodes.push(tNode);
        lastBlockParent = parent;
    }
    if (currentBlockNodes.length > 0) {
        blocks.push(currentBlockNodes);
    }

    // Process blocks
    for (const blockNodes of blocks) {
        // Calculate text offsets
        let paraText = "";
        const nodeOffsets = [];
        for (const tNode of blockNodes) {
            nodeOffsets.push({
                node: tNode,
                start: paraText.length,
                text: tNode.nodeValue
            });
            paraText += tNode.nodeValue;
        }

        // Split paragraph text into sentences and merge abbreviations/decimals
        const rawFragments = [];
        const sentenceRegex = /[^.!?]+([.!?]+|$)/g;
        let match;
        while ((match = sentenceRegex.exec(paraText)) !== null) {
            rawFragments.push({
                text: match[0],
                start: match.index,
                end: match.index + match[0].length
            });
        }

        const sentences = [];
        let i = 0;
        while (i < rawFragments.length) {
            let current = rawFragments[i];
            
            while (i + 1 < rawFragments.length && shouldMerge(current.text, rawFragments[i + 1].text)) {
                const next = rawFragments[i + 1];
                current = {
                    text: current.text + next.text,
                    start: current.start,
                    end: next.end
                };
                i++;
            }
            
            const sText = current.text;
            const isCitation = /\[\d+(\s*[-,\s]\s*\d+)*\]/.test(sText);
            
            sentences.push({
                text: sText,
                start: current.start,
                end: current.end,
                isCitation: isCitation
            });
            i++;
        }

        // Apply highlights and annotations
        const ignoreTables = localStorage.getItem('italic_setting_ignore_tables') === 'true';
        for (const nodeOffset of nodeOffsets) {
            const tNode = nodeOffset.node;
            const nStart = nodeOffset.start;
            const nEnd = nStart + nodeOffset.text.length;
            const nodeText = nodeOffset.text;
            
            if (ignoreTables && isInsideTable(tNode)) {
                continue;
            }
            
            const fragment = document.createDocumentFragment();
            let lastIdxInNode = 0;

            for (const s of sentences) {
                const overlapStart = Math.max(nStart, s.start);
                const overlapEnd = Math.min(nEnd, s.end);

                if (overlapStart < overlapEnd) {
                    const relStart = overlapStart - nStart;
                    const relEnd = overlapEnd - nStart;

                    if (relStart > lastIdxInNode) {
                        fragment.appendChild(document.createTextNode(nodeText.substring(lastIdxInNode, relStart)));
                    }

                    const sliceText = nodeText.substring(relStart, relEnd);

                    if (s.isCitation) {
                        // Citation sentence: Wrap in faded styling span
                        const span = document.createElement('span');
                        span.className = 'citation-text';
                        span.textContent = sliceText;
                        fragment.appendChild(span);
                    } else {
                        // Normal sentence: Scan words for formatting rules
                        const isItalic = isItalicNode(tNode);
                        const wordRegex = /[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*/g;
                        let m;
                        let lastWordIdx = 0;
                        const wordFragment = document.createDocumentFragment();

                        while ((m = wordRegex.exec(sliceText)) !== null) {
                            const rawWord = m[0];
                            const cleaned = cleanWord(rawWord);
                            if (!cleaned || /^\d+$/.test(cleaned)) continue;

                            totalWords++;
                            
                            const isVar = formulaVariables.has(cleaned.toLowerCase()) && isVariableContext(cleaned, m.index, sliceText);
                            let hasViolation = false;
                            let violationType = "";
                            let violationDesc = "";
                            
                            if (isVar) {
                                if (!isItalic) {
                                    hasViolation = true;
                                    violationType = "Missing Italic (Variabel)";
                                    violationDesc = `Variabel rumus '${rawWord}' harus dicetak miring (italic).`;
                                }
                            } else {
                                const isForeign = isForeignWord(cleaned, rawWord);
                                if ((isForeign && !isItalic) || (!isForeign && isItalic && indonesianWords.has(cleaned))) {
                                    hasViolation = true;
                                    violationType = isForeign ? "Missing Italic" : "Unnecessary Italic";
                                    violationDesc = isForeign 
                                        ? `Kata asing '${rawWord}' seharusnya dicetak miring (italic).`
                                        : `Kata Indonesia '${rawWord}' tidak perlu dicetak miring (potensi salah).`;
                                }
                            }

                            if (hasViolation) {
                                if (m.index > lastWordIdx) {
                                    wordFragment.appendChild(document.createTextNode(sliceText.substring(lastWordIdx, m.index)));
                                }

                                const span = document.createElement('span');
                                span.className = `issue-span ${violationType.startsWith('Missing') ? 'missing' : 'unnecessary'}`;
                                span.setAttribute('data-id', issueId);
                                span.textContent = rawWord;

                                currentIssues.push({
                                    id: issueId,
                                    word: rawWord,
                                    cleaned: cleaned,
                                    type: violationType,
                                    description: violationDesc,
                                    context: s.text.trim()
                                });

                                issueId++;
                                wordFragment.appendChild(span);
                                lastWordIdx = m.index + rawWord.length;
                            }
                        }

                        if (lastWordIdx < sliceText.length) {
                            wordFragment.appendChild(document.createTextNode(sliceText.substring(lastWordIdx)));
                        }
                        fragment.appendChild(wordFragment);
                    }
                    lastIdxInNode = relEnd;
                }
            }

            if (lastIdxInNode < nodeText.length) {
                fragment.appendChild(document.createTextNode(nodeText.substring(lastIdxInNode)));
            }

            if (tNode.parentNode) {
                tNode.parentNode.replaceChild(fragment, tNode);
            }
        }
    }

    updateCurrentIssues(currentIssues);
    const missingItalicCount = currentIssues.filter(i => i.type === 'Missing Italic').length;
    const unnecessaryItalicCount = currentIssues.filter(i => i.type === 'Unnecessary Italic').length;

    renderAlertCards();
    updateStats(totalWords, missingItalicCount, unnecessaryItalicCount);

    // Bind click triggers on editor warning nodes
    elements.editor.querySelectorAll('.issue-span').forEach(span => {
        span.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(span.getAttribute('data-id'));
            focusIssue(id);
        });
    });

    // Save marked up DOM to localStorage
    localStorage.setItem('italic_editor_text', elements.editor.innerHTML);

    // Restore caret position
    if (isFocused && caretPos !== null) {
        restoreCaretPosition(elements.editor, caretPos);
    }
}

// Helper to determine if two text fragments should be merged (to prevent splitting on decimals/abbreviations)
function shouldMerge(text1, text2) {
    const t1 = text1.trim();
    // 1. Decimal number check (e.g. ends with digit + period, and next starts with digit)
    if (/\d\.$/.test(t1) && /^\d/.test(text2.trim())) {
        return true;
    }
    
    // 2. Common academic/editorial abbreviations check (case-insensitive)
    const abbs = [
        'dkk', 'et al', 'hlm', 'vol', 'no', 'hal', 'ed', 'dr', 'prof', 'ir', 
        'e.g', 'i.e', 'etc', 'vs', 'cf', 'ibid', 'op.cit', 'loc.cit'
    ];
    const lowercaseT1 = t1.toLowerCase();
    const isAbb = abbs.some(abb => lowercaseT1.endsWith(abb + '.') || lowercaseT1.endsWith(abb + '?') || lowercaseT1.endsWith(abb + '!'));
    if (isAbb) {
        return true;
    }
    
    return false;
}
