class Note {
    constructor(data) {
        this.id = data.id || `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.title = data.title || '';
        this.content = data.content || '';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        this.focusTime = data.focusTime || 0; // seconds spent while this note active
    }
    toJSON() { return { ...this }; }
    get wordCount() { return this.content.trim() ? this.content.trim().split(/\s+/).length : 0; }
}

class Store {
    constructor() {
        this.state = {
            notes: JSON.parse(localStorage.getItem('waswriter_notes')) || [],
            theme: localStorage.getItem('waswriter_theme') || 'glass',
            activeNoteId: null,
            totalFocusTime: parseInt(localStorage.getItem('waswriter_focus_total')) || 0
        };
        this.listeners = [];
        this.init();
    }

    init() {
        document.body.className = `theme-${this.state.theme}`;
        if (this.state.notes.length === 0) {
            this.addNote({
                title: 'Welcome',
                content: '# Welcome to Was Writer\n\nStart writing your thoughts here. This editor supports **Markdown**.\n\n## Markdown features\n\n- **Bold** and *italic* text\n- `inline code` and code blocks\n- [Links](https://example.com)\n- Lists and tables\n- Headings and quotes\n\n> Your notes are saved **locally** in your browser — nothing ever touches the cloud.\n\n## Focus Timer\n\nUse the focus timer for deep work sessions.\n\n```\nconst deepWork = true;\n// Stay focused!\n```'
            });
        }
        if (!this.state.activeNoteId && this.state.notes.length > 0) {
            this.state.activeNoteId = this.state.notes[0].id;
        }
        this.saveFocusTotal();
        this.notify();
    }

    subscribe(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter(l => l !== fn); }; }
    notify() { this.listeners.forEach(fn => fn(this.state)); }

    setTheme(theme) {
        this.state.theme = theme;
        localStorage.setItem('waswriter_theme', theme);
        document.body.className = `theme-${theme}`;
        this.notify();
    }

    addNote(data) {
        const note = new Note(data);
        this.state.notes.unshift(note);
        this.state.activeNoteId = note.id;
        this.save();
        this.notify();
        return note;
    }

    updateNote(id, updates) {
        const idx = this.state.notes.findIndex(n => n.id === id);
        if (idx !== -1) {
            this.state.notes[idx] = new Note({ ...this.state.notes[idx], ...updates, updatedAt: new Date().toISOString() });
            if (updates.focusTime) this.state.totalFocusTime += updates.focusTime;
            this.saveFocusTotal();
            this.save();
            this.notify();
        }
    }

    deleteNote(id) {
        this.state.notes = this.state.notes.filter(n => n.id !== id);
        if (this.state.activeNoteId === id) {
            this.state.activeNoteId = this.state.notes.length > 0 ? this.state.notes[0].id : null;
        }
        this.save();
        this.notify();
    }

    getActiveNote() {
        return this.state.notes.find(n => n.id === this.state.activeNoteId) || null;
    }

    save() {
        localStorage.setItem('waswriter_notes', JSON.stringify(this.state.notes.map(n => n.toJSON())));
    }

    saveFocusTotal() {
        localStorage.setItem('waswriter_focus_total', String(this.state.totalFocusTime));
    }
}

class MarkdownParser {
    parse(md) {
        if (!md) return '';
        const lines = md.split('\n');
        let html = '';
        let paragraph = [];

        const flushParagraph = () => {
            if (paragraph.length > 0) {
                html += `<p>${paragraph.map(l => this.inline(l)).join('<br>')}</p>`;
                paragraph = [];
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (/^```/.test(trimmed)) {
                flushParagraph();
                const code = [];
                i++;
                while (i < lines.length && !/^```/.test(lines[i].trim())) {
                    code.push(lines[i]);
                    i++;
                }
                html += `<pre><code>${this.escapeHtml(code.join('\n'))}</code></pre>`;
                continue;
            }

            if (i > 0 && lines[i - 1].includes('|') && this.isTableSeparator(trimmed)) {
                flushParagraph();
                const headers = lines[i - 1].split('|').map(s => s.trim()).filter(Boolean);
                const rows = [];
                i++;
                while (i < lines.length && lines[i].includes('|')) {
                    const cells = lines[i].split('|').map(s => s.trim()).filter(Boolean);
                    if (cells.length > 0) rows.push(cells);
                    i++;
                }
                html += this.renderTable(headers, rows);
                i--;
                continue;
            }

            const heading = trimmed.match(/^(#{1,6})\s+(.*)/);
            if (heading) {
                flushParagraph();
                const level = heading[1].length;
                html += `<h${level}>${this.inline(heading[2])}</h${level}>`;
                continue;
            }

            if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
                flushParagraph();
                html += '<hr>';
                continue;
            }

            if (/^>\s?/.test(trimmed)) {
                flushParagraph();
                const quoteLines = [];
                while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
                    quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
                    i++;
                }
                i--;
                html += `<blockquote>${quoteLines.map(l => this.inline(l)).join('<br>')}</blockquote>`;
                continue;
            }

            const taskMatch = trimmed.match(/^- \[([ xX])\]\s+(.*)/);
            if (taskMatch) {
                flushParagraph();
                html += '<ul>';
                const checked = taskMatch[1].toLowerCase() === 'x';
                html += `<li><input type="checkbox" disabled ${checked ? 'checked' : ''}> ${this.inline(taskMatch[2])}</li>`;
                i++;
                while (i < lines.length) {
                    const t = lines[i].trim();
                    const tm = t.match(/^- \[([ xX])\]\s+(.*)/);
                    if (tm) {
                        const c = tm[1].toLowerCase() === 'x';
                        html += `<li><input type="checkbox" disabled ${c ? 'checked' : ''}> ${this.inline(tm[2])}</li>`;
                        i++;
                    } else {
                        break;
                    }
                }
                html += '</ul>';
                i--;
                continue;
            }

            const ulMatch = trimmed.match(/^(-|\*)\s+(.*)/);
            if (ulMatch) {
                flushParagraph();
                html += '<ul>';
                html += `<li>${this.inline(ulMatch[2])}</li>`;
                i++;
                while (i < lines.length) {
                    const t = lines[i].trim();
                    const um = t.match(/^(-|\*)\s+(.*)/);
                    if (um) {
                        html += `<li>${this.inline(um[2])}</li>`;
                        i++;
                    } else {
                        break;
                    }
                }
                html += '</ul>';
                i--;
                continue;
            }

            const olMatch = trimmed.match(/^\d+\.\s+(.*)/);
            if (olMatch) {
                flushParagraph();
                html += '<ol>';
                html += `<li>${this.inline(olMatch[1])}</li>`;
                i++;
                while (i < lines.length) {
                    const t = lines[i].trim();
                    const om = t.match(/^\d+\.\s+(.*)/);
                    if (om) {
                        html += `<li>${this.inline(om[1])}</li>`;
                        i++;
                    } else {
                        break;
                    }
                }
                html += '</ol>';
                i--;
                continue;
            }

            if (trimmed === '') {
                flushParagraph();
            } else {
                paragraph.push(line);
            }
        }

        flushParagraph();
        return html;
    }

    inline(text) {
        let t = text;
        t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
        t = t.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        t = t.replace(/___(.*?)___/g, '<strong><em>$1</em></strong>');
        t = t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        t = t.replace(/__(.*?)__/g, '<strong>$1</strong>');
        t = t.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
        t = t.replace(/(^|[^_\w])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
        t = t.replace(/~~(.*?)~~/g, '<del>$1</del>');
        t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
        t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        return t;
    }

    isTableSeparator(line) {
        return /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/.test(line) && line.includes('-');
    }

    renderTable(headers, rows) {
        if (headers.length === 0) return '';
        let table = '<table><thead><tr>';
        headers.forEach(h => { table += `<th>${this.inline(h)}</th>`; });
        table += '</tr></thead><tbody>';
        rows.forEach(row => {
            table += '<tr>';
            row.forEach(cell => { table += `<td>${this.inline(cell)}</td>`; });
            table += '</tr>';
        });
        table += '</tbody></table>';
        return table;
    }

    escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/"/g, '"')
            .replace(/'/g, '&#39;');
    }
}

class Renderer {
    constructor(store) {
        this.store = store;
        this.markdown = new MarkdownParser();
        this.noteListEl = document.getElementById('note-list');
        this.titleEl = document.getElementById('note-title');
        this.editorEl = document.getElementById('editor');
        this.previewEl = document.getElementById('preview');
        this.saveStatusEl = document.getElementById('save-status');
        this.wordCountHeaderEl = document.getElementById('word-count-header');
        this.wordCountEl = document.getElementById('word-count');
        this.noteCountEl = document.getElementById('note-count');
        this.totalFocusEl = document.getElementById('total-focus');
        this.deleteBtn = document.getElementById('delete-note-btn');
        this.mode = 'write';
        this.saveTimer = null;
    }

    render() {
        this.renderNoteList();
        this.renderActiveNote();
        this.renderStats();
        this.renderPreview();
    }

    renderNoteList() {
        this.noteListEl.innerHTML = '';
        this.store.state.notes.forEach(note => {
            const item = document.createElement('div');
            item.className = `note-item ${note.id === this.store.state.activeNoteId ? 'active' : ''}`;
            item.innerHTML = `
                <div class="note-item-title">${note.title || 'Untitled Note'}</div>
                <div class="note-item-date">${new Date(note.updatedAt).toLocaleDateString()} · ${new Date(note.updatedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
            `;
            item.addEventListener('click', () => this.selectNote(note.id));
            this.noteListEl.appendChild(item);
        });
    }

    renderActiveNote() {
        const active = this.store.getActiveNote();
        if (active) {
            this.titleEl.value = active.title || '';
            this.editorEl.value = active.content || '';
            this.deleteBtn.classList.remove('hidden');
        } else {
            this.titleEl.value = '';
            this.editorEl.value = '';
            this.deleteBtn.classList.add('hidden');
        }
    }

    renderStats() {
        const active = this.store.getActiveNote();
        const activeWords = active ? active.wordCount : 0;
        this.wordCountEl.textContent = `${activeWords} words`;
        this.wordCountHeaderEl.textContent = `${activeWords} words`;
        this.noteCountEl.textContent = this.store.state.notes.length;
        this.totalFocusEl.textContent = this.formatFocus(this.store.state.totalFocusTime);
    }

    renderPreview() {
        const active = this.store.getActiveNote();
        const content = active ? active.content : '';
        this.previewEl.innerHTML = this.markdown.parse(content);
    }

    selectNote(id) {
        this.saveCurrent();
        this.store.state.activeNoteId = id;
        this.store.notify();
    }

    saveCurrent() {
        const active = this.store.getActiveNote();
        if (!active) return;
        const title = this.titleEl.value.trim();
        const content = this.editorEl.value;
        if (title !== active.title || content !== active.content) {
            this.store.updateNote(active.id, { title, content });
            this.showSaveStatus('Saving...');
            clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(() => this.showSaveStatus('Saved'), 800);
        }
    }

    showSaveStatus(text) {
        this.saveStatusEl.textContent = text;
        this.saveStatusEl.classList.add('saving');
        setTimeout(() => this.saveStatusEl.classList.remove('saving'), 700);
    }

    setMode(mode) {
        this.mode = mode;
        const preview = this.previewEl;
        const editor = this.editorEl;
        this.renderPreview();
        if (mode === 'write') {
            editor.classList.remove('hidden');
            preview.classList.add('hidden');
            editor.style.flex = '1';
            preview.style.flex = '0';
        } else if (mode === 'preview') {
            editor.classList.add('hidden');
            preview.classList.remove('hidden');
        } else if (mode === 'split') {
            editor.classList.remove('hidden');
            preview.classList.remove('hidden');
            editor.style.flex = '1';
            preview.style.flex = '1';
        }
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    }

    formatFocus(seconds) {
        const mins = Math.floor(seconds / 60);
        if (mins < 60) return `${mins}m`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h}h ${m}m`;
    }

    showToast(msg, type = 'info') {
        const div = document.createElement('div');
        div.className = `toast ${type}`;
        div.textContent = msg;
        document.getElementById('toast-container').appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }

    exportNotes() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.store.state.notes));
        const a = document.createElement('a');
        a.href = dataStr; a.download = 'waswriter_backup.json';
        document.body.appendChild(a); a.click(); a.remove();
        this.showToast('Notes exported', 'success');
    }

    importNotes(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    data.forEach(n => this.store.addNote(n));
                    this.showToast(`Imported ${data.length} notes`, 'success');
                } else {
                    this.showToast('Invalid file format', 'error');
                }
            } catch {
                this.showToast('Could not parse file', 'error');
            }
        };
        reader.readAsText(file);
    }

    exportPDF() {
        this.saveCurrent();
        const active = this.store.getActiveNote();
        if (!active) return;

        const printWindow = window.open('', '_blank', 'width=800,height=600');
        const content = this.markdown.parse(active.content);
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${active.title || 'Untitled Note'}</title>
                <style>
                    * { box-sizing: border-box; }
                    html, body { margin: 0; padding: 0; }
                    body {
                        font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                        color: #1a1a1a;
                        line-height: 1.6;
                        font-size: 12pt;
                    }
                    .page {
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 40px 48px;
                    }
                    .header {
                        text-align: center;
                        color: #666;
                        font-size: 0.85em;
                        margin-bottom: 32px;
                        padding-bottom: 16px;
                        border-bottom: 1px solid #ddd;
                    }
                    .header strong { color: #1a1a1a; font-size: 1.2em; display: block; margin-bottom: 4px; }
                    .content { text-align: left; }
                    .content h1, .content h2, .content h3,
                    .content h4, .content h5, .content h6 {
                        margin: 1.2em 0 0.5em;
                        line-height: 1.3;
                        font-weight: 700;
                        text-align: left;
                    }
                    .content h1 { font-size: 1.8em; border-bottom: 2px solid #3b82f6; padding-bottom: 0.25em; }
                    .content h2 { font-size: 1.4em; border-bottom: 1px solid #ddd; padding-bottom: 0.25em; }
                    .content h3 { font-size: 1.2em; }
                    .content p { margin: 0.7em 0; text-align: left; }
                    .content ul, .content ol { margin: 0.7em 0; padding-left: 2em; }
                    .content li { margin: 0.3em 0; }
                    .content code {
                        background: #f0f0f0;
                        padding: 0.15em 0.4em;
                        border-radius: 4px;
                        font-family: 'Consolas', 'Courier New', monospace;
                        font-size: 0.9em;
                    }
                    .content pre {
                        background: #f5f5f5;
                        padding: 16px;
                        border-radius: 8px;
                        overflow-x: auto;
                        margin: 0.8em 0;
                        border: 1px solid #e0e0e0;
                    }
                    .content pre code { background: transparent; padding: 0; }
                    .content blockquote {
                        border-left: 4px solid #3b82f6;
                        margin: 0.8em 0;
                        padding: 0.4em 1em;
                        background: #f8f9fa;
                        color: #444;
                    }
                    .content table { border-collapse: collapse; width: 100%; margin: 0.8em 0; }
                    .content th, .content td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; vertical-align: top; }
                    .content th { background: #f0f0f0; font-weight: 700; }
                    .content a { color: #3b82f6; text-decoration: none; }
                    .content img { max-width: 100%; }
                    .content hr { border: none; border-top: 1px solid #ddd; margin: 1.5em 0; }
                    .content input[type="checkbox"] { margin-right: 8px; }
                    .footer {
                        text-align: center;
                        color: #aaa;
                        font-size: 0.8em;
                        margin-top: 40px;
                        padding-top: 16px;
                        border-top: 1px solid #eee;
                    }
                    @media print {
                        body { font-size: 11pt; }
                        .page { padding: 0; }
                        .header { margin-bottom: 24px; }
                    }
                </style>
            </head>
            <body>
                <div class="page">
                    <div class="header">
                        <strong>${active.title || 'Untitled Note'}</strong>
                        Exported from Was Writer · ${new Date().toLocaleString()}
                    </div>
                    <div class="content">${content}</div>
                    <div class="footer">Generated by Study Operating Tool · Was Writer</div>
                </div>
                <script>
                    window.onload = function() { window.print(); };
                <\/script>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
        this.showToast('Opening print dialog...', 'info');
    }
}

class FocusTimer {
    constructor(store, renderer) {
        this.store = store;
        this.renderer = renderer;
        this.duration = 25 * 60;
        this.remaining = this.duration;
        this.running = false;
        this.interval = null;
        this.el = document.getElementById('timer-time');
        this.labelEl = document.getElementById('timer-label');
        this.startBtn = document.getElementById('timer-start');
        this.activeNoteId = null;
        this.elapsedDuring = 0;
    }

    tick() {
        this.remaining--;
        if (this.remaining <= 0) {
            this.complete();
            return;
        }
        this.elapsedDuring++;
        this.updateDisplay();
    }

    complete() {
        this.pause();
        this.renderer.showToast('🎉 Focus session complete!', 'success');
        this.recordFocus();
        this.reset();
    }

    recordFocus() {
        const active = this.store.getActiveNote();
        if (active && this.elapsedDuring > 0) {
            this.store.updateNote(active.id, { focusTime: this.elapsedDuring });
            this.elapsedDuring = 0;
        }
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.elapsedDuring = 0;
        this.activeNoteId = this.store.state.activeNoteId;
        this.startBtn.textContent = '⏸ Pause';
        this.el.classList.add('running');
        this.labelEl.textContent = 'FOCUSING';
        this.interval = setInterval(() => this.tick(), 1000);
    }

    pause() {
        this.running = false;
        clearInterval(this.interval);
        this.interval = null;
        this.startBtn.textContent = '▶ Resume';
        this.el.classList.remove('running');
        this.labelEl.textContent = this.elapsedDuring > 0 ? 'PAUSED' : 'FOCUS';
    }

    reset() {
        this.pause();
        this.remaining = this.duration;
        this.elapsedDuring = 0;
        this.labelEl.textContent = 'FOCUS';
        this.startBtn.textContent = '▶ Start';
        this.updateDisplay();
    }

    setDuration(minutes) {
        this.duration = minutes * 60;
        this.reset();
    }

    updateDisplay() {
        const m = Math.floor(this.remaining / 60).toString().padStart(2, '0');
        const s = Math.floor(this.remaining % 60).toString().padStart(2, '0');
        this.el.textContent = `${m}:${s}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const store = new Store();
    const renderer = new Renderer(store);
    const timer = new FocusTimer(store, renderer);
    store.subscribe(() => renderer.render());
    timer.updateDisplay();

    document.getElementById('new-note-btn').onclick = () => {
        renderer.saveCurrent();
        store.addNote({ title: 'Untitled Note', content: '' });
        renderer.showToast('New note created', 'success');
    };

    document.getElementById('delete-note-btn').onclick = () => {
        const active = store.getActiveNote();
        if (active && confirm('Delete this note?')) {
            store.deleteNote(active.id);
            renderer.showToast('Note deleted', 'success');
        }
    };

    document.getElementById('pdf-btn').onclick = () => renderer.exportPDF();

    document.querySelectorAll('.mode-btn').forEach(btn => btn.onclick = () => renderer.setMode(btn.dataset.mode));

    let inputTimer;
    document.getElementById('editor').addEventListener('input', () => {
        renderer.showSaveStatus('Saving...');
        clearTimeout(inputTimer);
        inputTimer = setTimeout(() => renderer.saveCurrent(), 500);
        renderer.renderPreview();
    });
    document.getElementById('note-title').addEventListener('input', () => {
        renderer.showSaveStatus('Saving...');
        clearTimeout(inputTimer);
        inputTimer = setTimeout(() => renderer.saveCurrent(), 500);
    });

    document.getElementById('editor').addEventListener('blur', () => renderer.saveCurrent());
    document.getElementById('note-title').addEventListener('blur', () => renderer.saveCurrent());

    const themeToggle = document.getElementById('theme-toggle');
    const themeMenu = document.getElementById('theme-menu');
    themeToggle.onclick = (e) => { e.stopPropagation(); themeMenu.classList.toggle('hidden'); };
    document.addEventListener('click', () => themeMenu.classList.add('hidden'));
    document.querySelectorAll('#theme-menu button').forEach(btn => btn.onclick = () => {
        store.setTheme(btn.dataset.theme);
        renderer.showToast(`Theme: ${btn.textContent.split(' ')[1]}`, 'success');
    });

    document.getElementById('export-btn').onclick = () => renderer.exportNotes();
    document.getElementById('import-btn').onclick = () => document.getElementById('import-file').click();
    document.getElementById('import-file').onchange = (e) => {
        if (e.target.files[0]) { renderer.importNotes(e.target.files[0]); e.target.value = ''; }
    };

    document.getElementById('timer-start').onclick = () => timer.running ? timer.pause() : timer.start();
    document.getElementById('timer-reset').onclick = () => timer.reset();
    document.getElementById('timer-duration').onchange = (e) => timer.setDuration(parseInt(e.target.value));

    window.addEventListener('beforeunload', () => {
        if (timer.running) timer.recordFocus();
        renderer.saveCurrent();
    });

    renderer.render();
});
