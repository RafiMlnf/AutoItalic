// Shared Application State and Configuration

export const indonesianWords = new Set();
export const englishWords = new Set();

export let whitelist = new Set([
    "html", "css", "js", "pdf", "docx", "web", "http", "https", "url", "api", "ip", "id", "db", "sql", "ui", "ux",
    "cpu", "ram", "gb", "mb", "kb", "tb", "ghz", "mhz", "khz", "hz", "cm", "mm", "kg", "gr", "ml", "km", "md5", "sha",
    "w3c", "dom", "xml", "json", "rest", "csv", "xls", "txt", "png", "jpg", "jpeg", "gif", "svg", "app", "os", "mac",
    "pc", "sd", "sim", "usb", "wi-fi", "wifi", "lan", "wan", "gps", "sms", "iot", "ai", "ml", "nlp", "gui", "cli",
    "kbbi", "eyd", "puebi", "skripsi", "thesis", "jurnal", "dosen", "mahasiswa", "kampus", "universitas", "prodi"
]);

export function updateWhitelist(newSet) {
    whitelist = newSet;
}

export let formulaVariables = new Set();
export function updateFormulaVariables(newSet) {
    formulaVariables = newSet;
}

// Common 2-letter English words to scan
export const COMMON_EN_2_LETTER = new Set(["of", "to", "in", "on", "by", "is", "it", "at", "an", "as", "if", "or", "be", "do", "we", "us"]);

export let currentIssues = [];
export function updateCurrentIssues(newIssues) {
    currentIssues = newIssues;
}

export let activeIssueId = null;
export function updateActiveIssueId(newId) {
    activeIssueId = newId;
}

export let activeSidebarTab = 'italic';
export function updateActiveSidebarTab(tab) {
    activeSidebarTab = tab;
}

// Elements Getter
export const getElements = () => ({
    editor: document.getElementById('editor'),
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    whitelistModal: document.getElementById('whitelist-modal'),
    whitelistTextarea: document.getElementById('whitelist-textarea'),
    alertsListContainer: document.getElementById('alerts-list-container'),
    statAccuracy: document.getElementById('stat-accuracy'),
    statMissing: document.getElementById('stat-missing'),
    statUnnecessary: document.getElementById('stat-unnecessary')
});
