// SVG connectors drawing and event tracking

import { activeIssueId, currentIssues, getElements } from './config.js';

// Draw dynamic connection line from word in editor to sidebar card
export function drawConnectorLine(id) {
    const svg = document.getElementById('connector-svg');
    if (!svg) return;
    svg.innerHTML = '';

    const elements = getElements();
    const wordEl = elements.editor.querySelector(`.issue-span[data-id="${id}"]`);
    const cardEl = document.querySelector(`.alert-card[data-id="${id}"]`);
    
    if (!wordEl || !cardEl) return;

    const issue = currentIssues.find(i => i.id === id);
    const color = issue && issue.type === 'Missing Italic' ? '#ef4444' : '#f59e0b';

    const svgRect = svg.getBoundingClientRect();
    const wordRect = wordEl.getBoundingClientRect();
    const cardRect = cardEl.getBoundingClientRect();
    const editorRect = elements.editor.getBoundingClientRect();

    // Hide connector line if the word is scrolled out of the visible editor bounds
    if (wordRect.bottom < editorRect.top || wordRect.top > editorRect.bottom) {
        return;
    }

    const startX = wordRect.right - svgRect.left;
    const startY = (wordRect.top + wordRect.bottom) / 2 - svgRect.top;

    const endX = cardRect.left - svgRect.left;
    const endY = (cardRect.top + cardRect.bottom) / 2 - svgRect.top;

    const controlOffset = Math.abs(endX - startX) / 2;
    const pathD = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-dasharray', '6,4');
    path.style.animation = 'stroke-dash 1s linear infinite';

    svg.appendChild(path);
}

// Clear connector SVG
export function clearConnectorLine() {
    const svg = document.getElementById('connector-svg');
    if (svg) svg.innerHTML = '';
}

// Set up scroll/resize redraw triggers
export function setupConnectorEvents() {
    const elements = getElements();
    
    if (elements.editor) {
        elements.editor.addEventListener('scroll', () => {
            if (activeIssueId !== null) drawConnectorLine(activeIssueId);
        });
    }
    
    if (elements.alertsListContainer) {
        elements.alertsListContainer.addEventListener('scroll', () => {
            if (activeIssueId !== null) drawConnectorLine(activeIssueId);
        });
    }
    
    window.addEventListener('resize', () => {
        if (activeIssueId !== null) drawConnectorLine(activeIssueId);
    });
}
