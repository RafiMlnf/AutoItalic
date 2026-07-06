// UI rendering, alert cards, statistics, modal controls, and theme toggle

import { getElements, currentIssues, updateActiveIssueId, activeIssueId, activeSidebarTab, updateActiveSidebarTab } from './config.js';
import { drawConnectorLine, clearConnectorLine } from './connector.js';
import { escapeHtml } from './utils.js';

// Open Whitelist Modal
export function openWhitelistModal() {
    const elements = getElements();
    if (!elements.whitelistModal || !elements.whitelistTextarea) return;
    elements.whitelistModal.style.display = 'flex';
}

// Close Whitelist Modal
export function closeWhitelistModal() {
    const elements = getElements();
    if (elements.whitelistModal) elements.whitelistModal.style.display = 'none';
}

// Toggle editor light/dark theme
export function toggleEditorTheme() {
    const container = document.querySelector('.editor-container');
    const btn = document.getElementById('theme-btn');
    if (!container || !btn) return;

    const isLight = container.classList.toggle('light-theme');
    localStorage.setItem('italic_editor_theme', isLight ? 'light' : 'dark');

    if (isLight) {
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
        btn.title = "Ganti ke Tema Gelap";
    } else {
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
        btn.title = "Ganti ke Tema Terang";
    }

    if (activeIssueId !== null) {
        setTimeout(() => drawConnectorLine(activeIssueId), 100);
    }
}

// Focus issue navigation: scroll into view and trigger SVG connector
export function focusIssue(id) {
    const elements = getElements();
    if (!elements.editor) return;

    elements.editor.querySelectorAll('.issue-span').forEach(span => {
        span.classList.remove('active-focus');
    });
    document.querySelectorAll('.alert-card').forEach(card => {
        card.classList.remove('active');
    });
    clearConnectorLine();

    updateActiveIssueId(id);
    const span = elements.editor.querySelector(`.issue-span[data-id="${id}"]`);
    const card = document.querySelector(`.alert-card[data-id="${id}"]`);

    if (span) {
        span.classList.add('active-focus');
        span.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (card) {
        card.classList.add('active');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    setTimeout(() => {
        drawConnectorLine(id);
    }, 180);
}

// Render warnings as sidebar cards
export function renderAlertCards() {
    const elements = getElements();
    if (!elements.alertsListContainer) return;

    // Filter current issues based on the selected tab
    const filteredIssues = currentIssues.filter(issue => {
        if (activeSidebarTab === 'italic') {
            return issue.type === 'Missing Italic' || issue.type === 'Unnecessary Italic';
        } else {
            return issue.type === 'Missing Italic (Variabel)';
        }
    });

    if (filteredIssues.length === 0) {
        elements.alertsListContainer.innerHTML = `
            <div class="empty-alerts">
                <div class="empty-alerts-title">Semua Bersih!</div>
                <p>Tidak ditemukan kesalahan ${activeSidebarTab === 'italic' ? 'huruf miring' : 'variabel rumus'} di kategori ini.</p>
            </div>`;
        return;
    }

    elements.alertsListContainer.innerHTML = '';
    filteredIssues.forEach(issue => {
        const card = document.createElement('div');
        const isMissing = issue.type === 'Missing Italic' || issue.type === 'Missing Italic (Variabel)';
        card.className = `alert-card ${isMissing ? 'missing' : 'unnecessary'}`;
        card.setAttribute('data-id', issue.id);

        card.addEventListener('click', () => {
            focusIssue(issue.id);
        });

        const escapedWord = escapeHtml(issue.word);
        const escapedContext = escapeHtml(issue.context);

        let highlightedContext = escapedContext;
        try {
            const reg = new RegExp(`\\b(${escapedWord})\\b`, 'gi');
            highlightedContext = escapedContext.replace(reg, '<mark>$1</mark>');
        } catch(e) {
            highlightedContext = escapedContext.replace(escapedWord, `<mark>${escapedWord}</mark>`);
        }

        let badgeLabel = 'Kelebihan';
        let btnIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>Tegakkan';
        if (issue.type === 'Missing Italic') {
            badgeLabel = 'Kurang Italic';
            btnIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>Miringkan';
        } else if (issue.type === 'Missing Italic (Variabel)') {
            badgeLabel = 'Variabel';
            btnIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>Miringkan';
        }

        card.innerHTML = `
            <div class="card-header">
                <span class="card-word">${escapedWord}</span>
                <span class="card-badge">${badgeLabel}</span>
            </div>
            <div class="card-desc">${issue.description}</div>
            <div class="card-context">"${highlightedContext}"</div>
            <div class="card-actions">
                <button class="btn-card-fix" onclick="event.stopPropagation(); window.fixIssue(${issue.id})">
                    ${btnIcon}
                </button>
            </div>
        `;
        elements.alertsListContainer.appendChild(card);
    });
}

// Update statistics cards
export function updateStats(totalWords, missing, unnecessary) {
    const elements = getElements();
    if (!elements.statAccuracy || !elements.statMissing || !elements.statUnnecessary) return;

    const totalErrors = missing + unnecessary;
    const accuracy = totalWords > 0 ? (100 - (totalErrors / totalWords * 100)) : 100;

    elements.statAccuracy.innerText = `${accuracy.toFixed(1)}%`;
    elements.statMissing.innerText = missing;
    elements.statUnnecessary.innerText = unnecessary;
}

// Open Settings Modal
export function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const checkbox = document.getElementById('setting-ignore-tables');
    if (!modal || !checkbox) return;

    const isIgnored = localStorage.getItem('italic_setting_ignore_tables') === 'true';
    checkbox.checked = isIgnored;
    modal.style.display = 'flex';
}

// Close Settings Modal
export function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.style.display = 'none';
}

// Save Settings and run re-scan
export function saveSettings() {
    const checkbox = document.getElementById('setting-ignore-tables');
    if (checkbox) {
        localStorage.setItem('italic_setting_ignore_tables', checkbox.checked ? 'true' : 'false');
    }
    closeSettingsModal();
    if (window.scanText) {
        window.scanText();
    }
}

// Switch sidebar active tab between Italic and Formula/Variable checks
export function switchSidebarTab(tab) {
    updateActiveSidebarTab(tab);
    
    const tabItalic = document.getElementById('tab-italic');
    const tabFormula = document.getElementById('tab-formula');
    if (!tabItalic || !tabFormula) return;
    
    if (tab === 'italic') {
        tabItalic.classList.remove('border-transparent', 'text-slate-400');
        tabItalic.classList.add('border-indigo-500', 'text-indigo-400');
        
        tabFormula.classList.remove('border-indigo-500', 'text-indigo-400');
        tabFormula.classList.add('border-transparent', 'text-slate-400');
    } else {
        tabFormula.classList.remove('border-transparent', 'text-slate-400');
        tabFormula.classList.add('border-indigo-500', 'text-indigo-400');
        
        tabItalic.classList.remove('border-indigo-500', 'text-indigo-400');
        tabItalic.classList.add('border-transparent', 'text-slate-400');
    }
    
    // Clear connectors and redraw
    clearConnectorLine();
    renderAlertCards();
}
