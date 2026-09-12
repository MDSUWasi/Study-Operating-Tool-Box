// ============================================
// DATA MODELS
// ============================================

class Note {
    constructor(data) {
        this.id = data.id || `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.title = data.title || '';
        this.content = data.content || '';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        this.focusTime = data.focusTime || 0;
        this.type = 'text';
    }
    toJSON() { return { ...this }; }
    get wordCount() { return this.content.trim() ? this.content.trim().split(/\s+/).length : 0; }
}

class CanvasNote {
    constructor(data) {
        this.id = data.id || this.generateUUID();
        this.title = data.title || 'Untitled Canvas';
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        this.viewport = data.viewport || { x: 0, y: 0, scale: 1 };
        this.background = data.background || null;
        this.strokes = (data.strokes || []).map(stroke => stroke instanceof Stroke ? stroke : new Stroke(stroke));
        this.lastSavedHash = this.computeDataHash();
        this.type = 'canvas';
        this.strokeCount = this.strokes.length;
    }
    
    generateUUID() {
        return 'canvas_' + ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }
    
    computeDataHash() {
        const json = JSON.stringify(this.strokes.sort((a,b) => a.timestamp.localeCompare(b.timestamp)));
        return this.hashCode(json);
    }
    
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }
    
    toJSON() { 
        return { 
            ...this, 
            strokes: this.strokes.map(s => s instanceof Stroke ? s.toJSON() : s) 
        }; 
    }
}

class Stroke {
    constructor(data) {
        this.id = data.id || this.generateUUID();
        this.type = data.type || 'pen';
        this.authorId = data.authorId || 'local_user';
        this.timestamp = data.timestamp || new Date().toISOString();
        this.color = data.color || '#00f2ff';
        this.baseWidth = data.baseWidth || 3;
        this.points = data.points || [];
        this.shape = data.shape || null;
        this.text = data.text || null;
        this.startX = data.startX || 0;
        this.startY = data.startY || 0;
        this.endX = data.endX || 0;
        this.endY = data.endY || 0;
    }
    
    generateUUID() {
        return 'stroke_' + ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }
    
    toJSON() { return { ...this }; }
}

// ============================================
// HISTORY MANAGER (UNDO/REDO)
// ============================================

class HistoryManager {
    constructor(maxHistory = 50) {
        this.maxHistory = maxHistory;
        this.undoStack = [];
        this.redoStack = [];
    }
    
    recordChange(action, data) {
        this.undoStack.push({
            action: action,
            data: data,
            timestamp: new Date().toISOString()
        });
        
        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
        
        this.redoStack = [];
    }
    
    canUndo() { return this.undoStack.length > 0; }
    canRedo() { return this.redoStack.length > 0; }
    
    undo() {
        if (!this.canUndo()) return null;
        const change = this.undoStack.pop();
        this.redoStack.push({
            ...change,
            previousData: this.cloneData(change.data)
        });
        return change;
    }
    
    redo() {
        if (!this.canRedo()) return null;
        const change = this.redoStack.pop();
        this.undoStack.push({
            ...change,
            timestamp: new Date().toISOString()
        });
        return change;
    }
    
    cloneData(data) {
        return JSON.parse(JSON.stringify(data));
    }
    
    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }
    
    getUndoStackSize() { return this.undoStack.length; }
    getRedoStackSize() { return this.redoStack.length; }
}

// ============================================
// STORE
// ============================================

class Store {
    constructor() {
        this.state = {
            notes: (JSON.parse(localStorage.getItem('waswriter_notes')) || []).map(note => new Note(note)),
            canvasNotes: (JSON.parse(localStorage.getItem('waswriter_canvas')) || []).map(note => new CanvasNote(note)),
            theme: localStorage.getItem('waswriter_theme') || 'glass',
            activeNoteId: null,
            activeCanvasNoteId: null,
            totalFocusTime: parseInt(localStorage.getItem('waswriter_focus_total')) || 0,
            activeView: 'text' // 'text' or 'canvas'
        };
        this.listeners = [];
        this.historyManager = new HistoryManager(50);
        this.renderer = null;
        this.canvasEngine = null;
        this.init();
    }

    init() {
        document.body.className = `theme-${this.state.theme}`;
        
        // Initialize text notes
        if (this.state.notes.length === 0) {
            this.addNote({
                title: 'Welcome',
                content: '# Welcome to Was Writer\n\nStart writing your thoughts here. This editor supports **Markdown**.\n\n## Markdown features\n\n- **Bold** and *italic* text\n- `inline code` and code blocks\n- [Links](https://example.com)\n- Lists and tables\n- Headings and quotes\n\n> Your notes are saved **locally** in your browser — nothing ever touches the cloud.\n\n## Focus Timer\n\nUse the focus timer for deep work sessions.\n\n```\nconst deepWork = true;\n// Stay focused!\n```'
            });
        }
        if (!this.state.activeNoteId && this.state.notes.length > 0) {
            this.state.activeNoteId = this.state.notes[0].id;
        }
        
        // Initialize canvas notes with welcome canvas if empty
        if (this.state.canvasNotes.length === 0) {
            this.addCanvasNote({
                title: 'Welcome Canvas',
                strokes: []
            });
        }
        if (!this.state.activeCanvasNoteId && this.state.canvasNotes.length > 0) {
            this.state.activeCanvasNoteId = this.state.canvasNotes[0].id;
        }

        this.state.activeView = 'text';
        
        this.saveFocusTotal();
        this.notify();
    }

    subscribe(fn) { 
        this.listeners.push(fn); 
        return () => { this.listeners = this.listeners.filter(l => l !== fn); }; 
    }
    
    notify() { 
        this.listeners.forEach(fn => fn(this.state)); 
    }

    setTheme(theme) {
        this.state.theme = theme;
        localStorage.setItem('waswriter_theme', theme);
        document.body.className = `theme-${theme}`;
        this.notify();
    }
    
    setActiveView(view) {
        this.state.activeView = view;
        this.notify();
    }

    // ========== TEXT NOTE METHODS ==========
    addNote(data) {
        const note = new Note(data);
        this.state.notes.unshift(note);
        this.state.activeNoteId = note.id;
        this.state.activeView = 'text';
        this.save();
        this.notify();
        return note;
    }

    updateNote(id, updates) {
        const idx = this.state.notes.findIndex(n => n.id === id);
        if (idx !== -1) {
            this.state.notes[idx] = new Note({ 
                ...this.state.notes[idx], 
                ...updates, 
                updatedAt: new Date().toISOString() 
            });
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

    // ========== CANVAS NOTE METHODS ==========
    addCanvasNote(data) {
        const note = new CanvasNote(data);
        this.state.canvasNotes.unshift(note);
        this.state.activeCanvasNoteId = note.id;
        this.state.activeView = 'canvas';
        this.saveCanvas();
        this.notify();
        return note;
    }

    updateCanvasNote(id, updates) {
        const idx = this.state.canvasNotes.findIndex(n => n.id === id);
        if (idx !== -1) {
            const updated = new CanvasNote({ 
                ...this.state.canvasNotes[idx], 
                ...updates, 
                updatedAt: new Date().toISOString(),
                strokeCount: updates.strokes ? updates.strokes.length : this.state.canvasNotes[idx].strokes.length
            });
            this.state.canvasNotes[idx] = updated;
            this.saveCanvas();
            this.notify();
        }
    }

    deleteCanvasNote(id) {
        this.state.canvasNotes = this.state.canvasNotes.filter(n => n.id !== id);
        if (this.state.activeCanvasNoteId === id) {
            this.state.activeCanvasNoteId = this.state.canvasNotes.length > 0 
                ? this.state.canvasNotes[0].id 
                : null;
        }
        this.saveCanvas();
        this.notify();
    }

    getActiveCanvasNote() {
        return this.state.canvasNotes.find(n => n.id === this.state.activeCanvasNoteId) || null;
    }

    setActiveCanvasNote(id) {
        this.state.activeCanvasNoteId = id;
        this.state.activeView = 'canvas';
        this.notify();
    }

    saveCanvas() {
        try {
            const serialized = JSON.stringify(this.state.canvasNotes.map(n => n.toJSON()));
            localStorage.setItem('waswriter_canvas', serialized);
        } catch (e) {
            console.warn('Storage limit reached. Consider clearing old notes.');
        }
    }

    saveFocusTotal() {
        localStorage.setItem('waswriter_focus_total', String(this.state.totalFocusTime));
    }
}

// ============================================
// MARKDOWN PARSER
// ============================================

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

// ============================================
// RENDERER
// ============================================

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
        this.canvasNoteCountEl = document.getElementById('canvas-note-count');
        this.strokeCountEl = document.getElementById('stroke-count');
        this.totalFocusEl = document.getElementById('total-focus');
        this.deleteBtn = document.getElementById('delete-note-btn');
        this.noteTypeBadgeEl = document.getElementById('note-type-badge');
        this.pdfBtn = document.getElementById('pdf-btn');
        this.exportCanvasPdfBtn = document.getElementById('export-canvas-pdf-btn');
        this.mode = 'write';
        this.saveTimer = null;
    }

    render() {
        this.renderNoteList();
        this.renderActiveNoteOrCanvas();
        this.renderStats();
        this.renderPreview();
        this.updateViewVisibility();
        this.updateNoteTypeBadge();
        this.updateButtonVisibility();
    }

    renderNoteList() {
        this.noteListEl.innerHTML = '';
        
        // Text notes
        this.store.state.notes.forEach(note => {
            const item = document.createElement('div');
            item.className = `note-item ${note.id === this.store.state.activeNoteId ? 'active' : ''}`;
            item.innerHTML = `
                <div class="note-item-icon">📝</div>
                <div class="note-item-details">
                    <div class="note-item-title">${note.title || 'Untitled Note'}</div>
                    <div class="note-item-date">${new Date(note.updatedAt).toLocaleDateString()} · ${new Date(note.updatedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                </div>
            `;
            item.addEventListener('click', () => {
                this.saveCurrent();
                this.store.state.activeNoteId = note.id;
                this.store.state.activeView = 'text';
                this.store.notify();
            });
            this.noteListEl.appendChild(item);
        });
        
        // Canvas notes
        this.store.state.canvasNotes.forEach(note => {
            const item = document.createElement('div');
            item.className = `note-item canvas-note-item ${note.id === this.store.state.activeCanvasNoteId ? 'active' : ''}`;
            item.innerHTML = `
                <div class="note-item-icon">🎨</div>
                <div class="note-item-details">
                    <div class="note-item-title">${note.title || 'Untitled Canvas'}</div>
                    <div class="note-item-date">${note.strokes?.length || 0} strokes · ${new Date(note.updatedAt).toLocaleDateString()}</div>
                </div>
            `;
            item.addEventListener('click', () => {
                this.store.setActiveCanvasNote(note.id);
            });
            this.noteListEl.appendChild(item);
        });
    }

    renderActiveNoteOrCanvas() {
        if (this.store.state.activeView === 'text') {
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
        } else {
            const active = this.store.getActiveCanvasNote();
            this.titleEl.value = active ? active.title || '' : '';
            this.deleteBtn.classList.toggle('hidden', !active);
        }
    }

    renderStats() {
        const active = this.store.state.activeView === 'text' ? this.store.getActiveNote() : this.store.getActiveCanvasNote();
        
        if (this.store.state.activeView === 'text') {
            const activeWords = active && active.content
                ? active.content.trim().split(/\s+/).length
                : 0;
            this.wordCountEl.textContent = `${activeWords} words`;
            this.wordCountHeaderEl.textContent = `${activeWords} words`;
        } else {
            const activeStrokes = active ? active.strokeCount || 0 : 0;
            this.wordCountEl.textContent = `${activeStrokes} strokes`;
            this.wordCountHeaderEl.textContent = `${activeStrokes} strokes`;
        }
        
        this.noteCountEl.textContent = this.store.state.notes.length;
        this.canvasNoteCountEl.textContent = this.store.state.canvasNotes.length;
        this.strokeCountEl.textContent = active ? (active.strokeCount || 0) : 0;
        this.totalFocusEl.textContent = this.formatFocus(this.store.state.totalFocusTime);
    }

    renderPreview() {
        const active = this.store.getActiveNote();
        const content = active ? active.content : '';
        this.previewEl.innerHTML = this.markdown.parse(content);
    }

    updateViewVisibility() {
        const textView = document.getElementById('text-editor-view');
        const canvasView = document.getElementById('canvas-editor-view');
        
        if (textView && canvasView) {
            if (this.store.state.activeView === 'text') {
                textView.classList.remove('hidden');
                canvasView.classList.add('hidden');
            } else {
                textView.classList.add('hidden');
                canvasView.classList.remove('hidden');
                if (this.store.canvasEngine) {
                    this.store.canvasEngine.loadFromStore();
                    this.store.canvasEngine.resize();
                }
            }
        }
    }

    updateNoteTypeBadge() {
        if (this.noteTypeBadgeEl) {
            this.noteTypeBadgeEl.textContent = this.store.state.activeView === 'text' ? '📝 Text' : '🎨 Canvas';
            this.noteTypeBadgeEl.className = `note-type-badge ${this.store.state.activeView}`;
        }
    }

    updateButtonVisibility() {
        if (this.pdfBtn && this.exportCanvasPdfBtn) {
            if (this.store.state.activeView === 'text') {
                this.pdfBtn.classList.remove('hidden');
                this.exportCanvasPdfBtn.classList.add('hidden');
            } else {
                this.pdfBtn.classList.add('hidden');
                this.exportCanvasPdfBtn.classList.remove('hidden');
            }
        }
    }

    selectNote(id) {
        this.saveCurrent();
        this.store.state.activeNoteId = id;
        this.store.state.activeView = 'text';
        this.store.notify();
    }

    saveCurrent() {
        if (this.store.state.activeView === 'canvas') {
            const activeCanvas = this.store.getActiveCanvasNote();
            if (activeCanvas) {
                const title = this.titleEl.value.trim();
                if (title !== activeCanvas.title) {
                    this.store.updateCanvasNote(activeCanvas.id, { title });
                    this.showSaveStatus('Saving...');
                    clearTimeout(this.saveTimer);
                    this.saveTimer = setTimeout(() => this.showSaveStatus('Saved'), 800);
                }
            }
            return;
        }

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
        const data = {
            text: this.store.state.notes.map(n => n.toJSON()),
            canvas: this.store.state.canvasNotes.map(n => n.toJSON())
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
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
                let count = 0;
                if (Array.isArray(data)) {
                    // Legacy format
                    data.forEach(n => this.store.addNote(n));
                    count = data.length;
                } else if (data.text || data.canvas) {
                    // New format
                    if (data.text) {
                        data.text.forEach(n => this.store.addNote(n));
                        count += data.text.length;
                    }
                    if (data.canvas) {
                        data.canvas.forEach(n => this.store.addCanvasNote(n));
                        count += data.canvas.length;
                    }
                } else {
                    this.showToast('Invalid file format', 'error');
                    return;
                }
                this.showToast(`Imported ${count} items`, 'success');
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
                        Exported from Study Operating Tool-Box · ${new Date().toLocaleString()}
                    </div>
                    <div class="content">${content}</div>
                    <div class="footer">Generated by Was Writer</div>
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

// ============================================
// FOCUS TIMER
// ============================================

class FocusTimer {
    constructor(store, renderer) {
        this.store = store;
        this.renderer = renderer;
        this.duration = 25 * 60;
        this.remaining = this.duration;
        this.running = false;
        this.interval = null;
        this.timeEls = document.querySelectorAll('.timer-time');
        this.labelEls = document.querySelectorAll('.timer-label');
        this.startBtns = document.querySelectorAll('#timer-start');
        this.resetBtns = document.querySelectorAll('#timer-reset');
        this.durationEls = document.querySelectorAll('#timer-duration');
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
        const active = this.store.state.activeView === 'text' 
            ? this.store.getActiveNote() 
            : this.store.getActiveCanvasNote();
        if (active && this.elapsedDuring > 0) {
            if (this.store.state.activeView === 'text') {
                this.store.updateNote(active.id, { focusTime: this.elapsedDuring });
            }
            this.elapsedDuring = 0;
        }
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.elapsedDuring = 0;
        this.activeNoteId = this.store.state.activeView === 'text' ? this.store.state.activeNoteId : this.store.state.activeCanvasNoteId;
        this.startBtns.forEach(button => button.textContent = '⏸ Pause');
        this.timeEls.forEach(element => element.classList.add('running'));
        this.labelEls.forEach(element => element.textContent = 'FOCUSING');
        this.interval = setInterval(() => this.tick(), 1000);
    }

    pause() {
        this.running = false;
        clearInterval(this.interval);
        this.interval = null;
        this.startBtns.forEach(button => button.textContent = '▶ Resume');
        this.timeEls.forEach(element => element.classList.remove('running'));
        this.labelEls.forEach(element => element.textContent = this.elapsedDuring > 0 ? 'PAUSED' : 'FOCUS');
    }

    reset() {
        this.pause();
        this.remaining = this.duration;
        this.elapsedDuring = 0;
        this.labelEls.forEach(element => element.textContent = 'FOCUS');
        this.startBtns.forEach(button => button.textContent = '▶ Start');
        this.updateDisplay();
    }

    setDuration(minutes) {
        this.duration = minutes * 60;
        this.reset();
    }

    updateDisplay() {
        const m = Math.floor(this.remaining / 60).toString().padStart(2, '0');
        const s = Math.floor(this.remaining % 60).toString().padStart(2, '0');
        this.timeEls.forEach(element => element.textContent = `${m}:${s}`);
    }
}

// ============================================
// CANVAS ENGINE
// ============================================

class CanvasEngine {
    constructor(container, store) {
        this.container = container;
        this.store = store;
        
        // Create canvas with HiDPI support
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.touchAction = 'none';
        container.appendChild(this.canvas);
        
        // State
        this.mode = 'pen';
        this.color = '#00f2ff';
        this.isDrawing = false;
        this.currentStroke = null;
        this.strokes = [];
        this.viewState = { x: 0, y: 0, scale: 1 };
        this.lastMouse = { x: 0, y: 0 };
        this.isPanning = false;
        
        // Pen settings
        this.penSize = 3;
        this.highlighterSize = 20;
        this.eraserSize = 30;
        this.pressureSensitivity = true;
        this.pressureScale = 2;
        
        // PDF background
        this.backgroundImage = null;
        this.backgroundLayers = [];
        this.currentPageIndex = 0;
        this.currentPageCount = 1;
        
        // Load from store
        this.loadFromStore();
        this.setupEvents();
        this.setupUIListeners();
        this.resize();
        this.render();
    }
    
    loadFromStore() {
        const activeNote = this.store.getActiveCanvasNote();
        this.backgroundImage = null;
        this.backgroundLayers = [];
        this.currentPageIndex = 0;
        this.currentPageCount = 1;
        if (activeNote) {
            this.strokes = activeNote.strokes || [];
            this.viewState = activeNote.viewport || { x: 0, y: 0, scale: 1 };
            
            if (activeNote.background) {
                this.loadBackground(activeNote.background);
            }
        } else {
            this.strokes = [];
            this.viewState = { x: 0, y: 0, scale: 1 };
        }

        const navControls = document.getElementById('page-nav-controls');
        if (navControls) navControls.style.display = 'none';
    }
    
    setupEvents() {
        let touchDistance = 0;
        let initialDistance = 0;
        let initialScale = 1;
        let isPinching = false;
        let isTwoFingerPan = false;
        let lastTwoFingerCenter = { x: 0, y: 0 };
        
        this.canvas.addEventListener('pointerdown', (e) => {
            if (e.pointerId !== undefined && this.canvas.setPointerCapture) {
                try { this.canvas.setPointerCapture(e.pointerId); } catch (error) { }
            }
            
            if (e.button === 1 || (e.ctrlKey && e.button === 0)) {
                this.isPanning = true;
                this.lastMouse = { x: e.clientX, y: e.clientY };
                this.canvas.style.cursor = 'grabbing';
                return;
            }
            
            if (e.button === 2 || (e.pointerType === 'pen' && e.buttons === 32)) {
                this.mode = 'eraser';
                this.startDrawing(e);
                return;
            }
            
            this.startDrawing(e);
        });
        
        this.canvas.addEventListener('pointermove', (e) => {
            if (e.touches && e.touches.length === 2) {
                isTwoFingerPan = true;
                const [t1, t2] = e.touches;
                
                const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                const centerX = (t1.clientX + t2.clientX) / 2;
                const centerY = (t1.clientY + t2.clientY) / 2;
                
                if (isPinching) {
                    const zoomDelta = distance / initialDistance;
                    const newScale = initialScale * zoomDelta;
                    this.viewState.scale = Math.max(0.1, Math.min(10, newScale));
                } else {
                    const dx = centerX - lastTwoFingerCenter.x;
                    const dy = centerY - lastTwoFingerCenter.y;
                    this.viewState.x -= dx / this.viewState.scale;
                    this.viewState.y -= dy / this.viewState.scale;
                    lastTwoFingerCenter = { x: centerX, y: centerY };
                }
                
                this.render();
                return;
            }
            
            if (!e.touches || e.touches.length < 2) {
                isPinching = false;
            }
            
            if (this.isPanning) {
                const dx = e.clientX - this.lastMouse.x;
                const dy = e.clientY - this.lastMouse.y;
                this.viewState.x -= dx / this.viewState.scale;
                this.viewState.y -= dy / this.viewState.scale;
                this.lastMouse = { x: e.clientX, y: e.clientY };
                this.render();
            } else if (this.isDrawing && this.currentStroke) {
                this.continueDrawing(e);
            }
        });
        
        this.canvas.addEventListener('pointerup', (e) => {
            if (e.pointerId !== undefined && this.canvas.releasePointerCapture) {
                try { this.canvas.releasePointerCapture(e.pointerId); } catch (error) { }
            }
            
            if (this.isPanning) {
                this.isPanning = false;
                this.canvas.style.cursor = 'default';
            } else if (this.isDrawing) {
                this.finishDrawing();
            }
            
            if (e.pointerType === 'pen' && !(e.buttons & 32)) {
                this.mode = 'pen';
            }
        });
        
        this.canvas.addEventListener('pointercancel', (e) => {
            if (e.pointerId !== undefined && this.canvas.releasePointerCapture) {
                try { this.canvas.releasePointerCapture(e.pointerId); } catch (error) { }
            }
            if (this.isDrawing) this.finishDrawing();
            this.isPanning = false;
            isPinching = false;
            isTwoFingerPan = false;
        });
        
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                isPinching = true;
                isTwoFingerPan = false;
                
                const [t1, t2] = e.touches;
                initialDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                initialScale = this.viewState.scale;
                lastTwoFingerCenter = {
                    x: (t1.clientX + t2.clientX) / 2,
                    y: (t1.clientY + t2.clientY) / 2
                };
            }
        }, { passive: false });
        
        this.canvas.addEventListener('touchend', (e) => {
            isPinching = false;
            isTwoFingerPan = false;
        }, { passive: false });
        
        this.canvas.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey || e.deltaMode === 2) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                const oldZoom = this.viewState.scale;
                this.viewState.scale *= delta;
                this.viewState.scale = Math.max(0.1, Math.min(10, this.viewState.scale));
                
                const rect = this.canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                const worldBefore = this.screenToWorld(mouseX, mouseY);
                this.viewState.x -= (worldBefore.x - this.viewState.x) * (1 - this.viewState.scale / oldZoom);
                this.viewState.y -= (worldBefore.y - this.viewState.y) * (1 - this.viewState.scale / oldZoom);
                
                this.render();
            }
        }, { passive: false });
        
        this.canvas.addEventListener('dblclick', (e) => {
            if (this.strokes.length > 0 || this.backgroundImage) {
                this.fitContent();
            }
        });
        
        window.addEventListener('resize', () => this.resize());
    }
    
    setupUIListeners() {
        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.setMode(btn.dataset.tool);
            };
        });
        
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.onclick = () => {
                this.setColor(btn.dataset.color);
            };
        });
        
        document.getElementById('import-pdf-btn')?.addEventListener('click', () => {
            document.getElementById('pdf-import-file')?.click();
        });
        
        document.getElementById('pdf-import-file')?.addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                await this.importPDF(e.target.files[0]);
                e.target.value = '';
            }
        });
        
        document.getElementById('undo-btn')?.addEventListener('click', () => this.undo());
        document.getElementById('redo-btn')?.addEventListener('click', () => this.redo());
        document.getElementById('fit-view-btn')?.addEventListener('click', () => this.fitContent());
        document.getElementById('clear-canvas-btn')?.addEventListener('click', () => this.clearCanvas());
        
        document.getElementById('prev-page-btn')?.addEventListener('click', () => this.switchBackgroundPage(-1));
        document.getElementById('next-page-btn')?.addEventListener('click', () => this.switchBackgroundPage(1));
        
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) this.redo();
                    else this.undo();
                }
                if (e.key === 'y') {
                    e.preventDefault();
                    this.redo();
                }
            }
        });
    }
    
    setMode(mode) {
        this.mode = mode;
    }
    
    setColor(color) {
        this.color = color;
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.style.border = btn.dataset.color === color ? '3px solid white' : '2px solid white';
        });
    }
    
    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.container.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        this.ctx.scale(dpr, dpr);
        this.render();
    }
    
    worldToScreen(wx, wy) {
        return {
            x: (wx - this.viewState.x) * this.viewState.scale + this.canvas.width / (2 * window.devicePixelRatio || 1),
            y: (wy - this.viewState.y) * this.viewState.scale + this.canvas.height / (2 * window.devicePixelRatio || 1)
        };
    }
    
    screenToWorld(sx, sy) {
        return {
            x: (sx - (this.canvas.width / (2 * window.devicePixelRatio || 1))) / this.viewState.scale + this.viewState.x,
            y: (sy - (this.canvas.height / (2 * window.devicePixelRatio || 1))) / this.viewState.scale + this.viewState.y
        };
    }
    
    fitContent() {
        if (this.strokes.length === 0) {
            this.viewState = { x: 0, y: 0, scale: 1 };
            this.render();
            return;
        }
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        this.strokes.forEach(stroke => {
            if (stroke.points && stroke.points.length > 0) {
                stroke.points.forEach(p => {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                });
            }
        });
        
        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
        
        const scaleX = canvasWidth / (contentWidth * 1.2);
        const scaleY = canvasHeight / (contentHeight * 1.2);
        const scale = Math.min(scaleX, scaleY, 2);
        
        this.viewState.x = (minX + maxX) / 2;
        this.viewState.y = (minY + maxY) / 2;
        this.viewState.scale = scale;
        
        this.render();
    }
    
    startDrawing(e) {
        const worldPos = this.screenToWorld(e.offsetX, e.offsetY);
        const pressure = e.pressure > 0 ? e.pressure : 0.5;
        
        this.currentStroke = new Stroke({
            type: this.mode,
            color: this.color,
            points: [{ 
                x: worldPos.x, 
                y: worldPos.y, 
                pressure: pressure,
                timestamp: new Date().toISOString()
            }],
            startX: worldPos.x,
            startY: worldPos.y
        });
        
        this.isDrawing = true;
    }
    
    continueDrawing(e) {
        const worldPos = this.screenToWorld(e.offsetX, e.offsetY);
        const pressure = e.pressure > 0 ? e.pressure : 0.5;
        
        this.currentStroke.points.push({ 
            x: worldPos.x, 
            y: worldPos.y, 
            pressure: pressure,
            timestamp: new Date().toISOString()
        });
        
        this.render();
    }
    
    finishDrawing() {
        if (this.currentStroke && this.currentStroke.points.length > 1) {
            this.store.historyManager.recordChange('add_stroke', { stroke: this.currentStroke });
            this.strokes.push(this.currentStroke);
        }
        this.currentStroke = null;
        this.isDrawing = false;
        this.saveToStore();
    }
    
    saveToStore() {
        const activeNote = this.store.getActiveCanvasNote();
        if (activeNote) {
            this.store.updateCanvasNote(activeNote.id, {
                strokes: this.strokes.map(s => s.toJSON()),
                viewport: { ...this.viewState },
                updatedAt: new Date().toISOString(),
                strokeCount: this.strokes.length
            });
            if (this.store.renderer) {
                this.store.renderer.renderStats();
            }
        }
    }
    
    render() {
        const ctx = this.ctx;
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg-body') || '#0f172a';
        ctx.fillRect(0, 0, width, height);
        
        this.drawGrid(ctx);
        
        if (this.backgroundImage) {
            this.drawBackground(ctx);
        }
        
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(this.viewState.scale, this.viewState.scale);
        ctx.translate(-this.viewState.x, -this.viewState.y);
        
        this.strokes.forEach(stroke => this.drawStroke(ctx, stroke));
        if (this.currentStroke) {
            this.drawStroke(ctx, this.currentStroke, true);
        }
        
        ctx.restore();
    }
    
    drawGrid(ctx) {
        const gridSize = 50 * this.viewState.scale;
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(this.viewState.scale, this.viewState.scale);
        ctx.translate(-this.viewState.x, -this.viewState.y);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        
        const worldLeft = -width / 2 / this.viewState.scale + this.viewState.x;
        const worldRight = width / 2 / this.viewState.scale + this.viewState.x;
        const worldTop = -height / 2 / this.viewState.scale + this.viewState.y;
        const worldBottom = height / 2 / this.viewState.scale + this.viewState.y;
        
        const startX = Math.floor(worldLeft / gridSize) * gridSize;
        const startY = Math.floor(worldTop / gridSize) * gridSize;
        
        ctx.beginPath();
        for (let x = startX; x < worldRight; x += gridSize) {
            ctx.moveTo(x, worldTop);
            ctx.lineTo(x, worldBottom);
        }
        for (let y = startY; y < worldBottom; y += gridSize) {
            ctx.moveTo(worldLeft, y);
            ctx.lineTo(worldRight, y);
        }
        ctx.stroke();
        ctx.restore();
    }
    
    drawBackground(ctx) {
        if (this.backgroundImage) {
            const margin = 50;
            const x = -this.backgroundImage.width / 2 - margin;
            const y = -this.backgroundImage.height / 2 - margin;
            
            ctx.globalAlpha = 0.6;
            ctx.drawImage(this.backgroundImage, x, y);
            ctx.globalAlpha = 1.0;
            
            ctx.strokeStyle = this.currentPageCount > 1 ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = this.currentPageCount > 1 ? 3 : 2;
            ctx.strokeRect(x, y, this.backgroundImage.width, this.backgroundImage.height);
            
            if (this.currentPageCount > 1) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(x, y, 120, 30);
                ctx.fillStyle = 'white';
                ctx.font = '14px Inter';
                ctx.textAlign = 'center';
                ctx.fillText(`${this.currentPageIndex + 1}/${this.currentPageCount}`, x + 60, y + 20);
            }
        }
    }
    
    drawStroke(ctx, stroke, isLive = false) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        switch (stroke.type) {
            case 'pen':
                this.drawPenStroke(ctx, stroke, isLive);
                break;
            case 'highlighter':
                this.drawHighlighterStroke(ctx, stroke, isLive);
                break;
            case 'eraser':
                this.drawEraserStroke(ctx, stroke, isLive);
                break;
            case 'rectangle':
            case 'circle':
                this.drawShapeStroke(ctx, stroke, isLive);
                break;
        }
    }
    
    drawPenStroke(ctx, stroke, isLive) {
        if (stroke.points.length < 2) {
            const p = stroke.points[0];
            const baseWidth = this.pressureSensitivity ? p.pressure * this.penSize * this.pressureScale : this.penSize;
            ctx.fillStyle = stroke.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, baseWidth / 2, 0, Math.PI * 2);
            ctx.fill();
            return;
        }
        
        ctx.strokeStyle = stroke.color;
        if (this.pressureSensitivity) {
            ctx.lineWidth = stroke.baseWidth;
            this.drawPressureSensitivePath(ctx, stroke.points);
        } else {
            ctx.lineWidth = this.penSize;
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
        }
    }
    
    drawPressureSensitivePath(ctx, points) {
        if (points.length < 2) return;
        
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        
        for (let i = 1; i < points.length; i++) {
            const curr = points[i];
            const width = curr.pressure * this.penSize * this.pressureScale;
            
            ctx.lineWidth = width;
            ctx.lineTo(curr.x, curr.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(curr.x, curr.y);
        }
    }
    
    drawHighlighterStroke(ctx, stroke, isLive) {
        if (stroke.points.length < 2) return;
        
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = this.highlighterSize;
        
        if (this.pressureSensitivity) {
            this.drawPressureSensitivePath(ctx, stroke.points);
        } else {
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
        }
        
        ctx.globalAlpha = 1.0;
    }
    
    drawEraserStroke(ctx, stroke, isLive) {
        if (stroke.points.length < 2) return;
        
        ctx.globalCompositeOperation = 'destination-out';
        
        if (this.pressureSensitivity) {
            this.drawPressureSensitivePath(ctx, stroke.points);
        } else {
            ctx.lineWidth = this.eraserSize;
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
        }
        
        ctx.globalCompositeOperation = 'source-over';
    }
    
    drawShapeStroke(ctx, stroke, isLive) {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = this.penSize;
        
        const w = stroke.endX - stroke.startX;
        const h = stroke.endY - stroke.startY;
        
        if (stroke.type === 'rectangle') {
            ctx.strokeRect(stroke.startX, stroke.startY, w, h);
        } else if (stroke.type === 'circle') {
            const rx = Math.abs(w) / 2;
            const ry = Math.abs(h) / 2;
            const cx = stroke.startX + w / 2;
            const cy = stroke.startY + h / 2;
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    
    async importPDF(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            const totalPages = pdf.numPages;
            const pages = [];
            
            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 2 });
                
                const thumbCanvas = document.createElement('canvas');
                thumbCanvas.width = viewport.width / 2;
                thumbCanvas.height = viewport.height / 2;
                const thumbCtx = thumbCanvas.getContext('2d');
                
                const thumbViewport = page.getViewport({ scale: 1 });
                await page.render({
                    canvasContext: thumbCtx,
                    viewport: thumbViewport
                }).promise;
                
                const fullCanvas = document.createElement('canvas');
                fullCanvas.width = viewport.width;
                fullCanvas.height = viewport.height;
                const fullCtx = fullCanvas.getContext('2d');
                
                await page.render({
                    canvasContext: fullCtx,
                    viewport: viewport
                }).promise;
                
                pages.push({
                    pageNumber: pageNum,
                    thumbnail: thumbCanvas.toDataURL('image/jpeg', 0.8),
                    fullRes: fullCanvas.toDataURL('image/png'),
                    width: viewport.width,
                    height: viewport.height
                });
            }
            
            this.showPageSelectionModal(pages, file.name);
            this.store.renderer.showToast(`PDF loaded (${totalPages} pages)`, 'success');
        } catch (err) {
            console.error('PDF import failed:', err);
            this.store.renderer.showToast('Failed to import PDF', 'error');
        }
    }
    
    showPageSelectionModal(pages, fileName) {
        const modal = document.createElement('div');
        modal.className = 'pdf-selection-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Import PDF: ${fileName}</h2>
                <p>Select pages to add as background:</p>
                <div class="page-thumbnails">
                    ${pages.map((page, idx) => `
                        <div class="page-thumb" data-index="${idx}">
                            <img src="${page.thumbnail}" alt="Page ${page.pageNumber}">
                            <div class="page-number">${page.pageNumber}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="modal-actions">
                    <button id="modal-cancel-btn" class="secondary-btn">Cancel</button>
                    <button id="modal-select-all-btn" class="secondary-btn">Select All</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const selectedPages = new Set();
        const thumbs = modal.querySelectorAll('.page-thumb');
        
        thumbs.forEach(thumb => {
            thumb.addEventListener('click', () => {
                const index = parseInt(thumb.dataset.index);
                if (selectedPages.has(index)) {
                    selectedPages.delete(index);
                    thumb.classList.remove('selected');
                } else {
                    selectedPages.add(index);
                    thumb.classList.add('selected');
                }
            });
        });
        
        const selectAllBtn = document.getElementById('modal-select-all-btn');
        selectAllBtn.addEventListener('click', () => {
            if (selectedPages.size === pages.length) {
                selectedPages.clear();
                thumbs.forEach(t => t.classList.remove('selected'));
                selectAllBtn.textContent = 'Select All';
            } else {
                selectedPages.clear();
                for (let i = 0; i < pages.length; i++) selectedPages.add(i);
                thumbs.forEach(t => t.classList.add('selected'));
                selectAllBtn.textContent = 'Deselect All';
            }
        });
        
        document.getElementById('modal-cancel-btn').addEventListener('click', () => {
            modal.remove();
        });
        
        setTimeout(() => {
            selectAllBtn.addEventListener('click', async (e) => {
                if (selectedPages.size === 0) {
                    this.store.renderer.showToast('Please select at least one page', 'error');
                    return;
                }
                
                const backgroundLayers = [];
                for (const index of selectedPages) {
                    const page = pages[index];
                    const bitmap = await createImageBitmap(await fetch(page.fullRes).then(r => r.blob()));
                    backgroundLayers.push({
                        type: 'pdf_page',
                        data: page.fullRes,
                        width: page.width,
                        height: page.height,
                        pageNumber: page.pageNumber
                    });
                }
                
                const activeCanvasNote = this.store.getActiveCanvasNote();
                if (!activeCanvasNote) return;

                this.store.updateCanvasNote(activeCanvasNote.id, {
                    background: {
                        type: 'multi_pdf',
                        pages: backgroundLayers,
                        currentPageIndex: 0,
                        fileName: fileName
                    }
                });
                
                this.backgroundLayers = backgroundLayers;
                this.backgroundImage = await createImageBitmap(await fetch(backgroundLayers[0].data).then(r => r.blob()));
                this.currentPageIndex = 0;
                this.currentPageCount = backgroundLayers.length;
                
                const navControls = document.getElementById('page-nav-controls');
                if (navControls) {
                    navControls.style.display = 'flex';
                    document.getElementById('page-indicator').textContent = `1 / ${backgroundLayers.length}`;
                }
                
                modal.remove();
                this.store.renderer.showToast(`Imported ${selectedPages.size} page(s)`, 'success');
            }, { once: true });
        }, 100);
    }
    
    switchBackgroundPage(delta) {
        if (!this.backgroundLayers || this.backgroundLayers.length === 0) return;
        
        const newIndex = this.currentPageIndex + delta;
        if (newIndex < 0 || newIndex >= this.backgroundLayers.length) return;
        
        this.currentPageIndex = newIndex;
        this.loadBackground(this.backgroundLayers[newIndex]);
        
        document.getElementById('page-indicator').textContent = `${this.currentPageIndex + 1}/${this.backgroundLayers.length}`;
        this.render();
    }
    
    loadBackground(bgData) {
        if (!bgData || !bgData.data) return;
        
        createImageBitmap(fetch(bgData.data).then(r => r.blob())).then(bitmap => {
            this.backgroundImage = bitmap;
            this.currentPageCount = bgData.pages ? bgData.pages.length : 1;
            this.currentPageIndex = bgData.currentPageIndex || 0;
            
            const navControls = document.getElementById('page-nav-controls');
            if (navControls) {
                navControls.style.display = this.currentPageCount > 1 ? 'flex' : 'none';
                if (this.currentPageCount > 1) {
                    document.getElementById('page-indicator').textContent = `${this.currentPageIndex + 1}/${this.currentPageCount}`;
                }
            }
        });
    }
    
    clearCanvas() {
        if (confirm('Clear all strokes? This cannot be undone.')) {
            this.store.historyManager.recordChange('clear_all', { previousStrokes: [...this.strokes] });
            this.strokes = [];
            this.saveToStore();
            this.render();
        }
    }
    
    undo() {
        if (this.store.historyManager.canUndo()) {
            const change = this.store.historyManager.undo();
            this.applyChange(change, false);
            this.saveToStore();
            this.store.renderer.renderStats();
        }
    }
    
    redo() {
        if (this.store.historyManager.canRedo()) {
            const change = this.store.historyManager.redo();
            this.applyChange(change, true);
            this.saveToStore();
            this.store.renderer.renderStats();
        }
    }
    
    applyChange(change, isRedo) {
        switch (change.action) {
            case 'add_stroke':
                if (!isRedo) {
                    const strokeId = change.data?.stroke?.id;
                    if (strokeId) this.strokes = this.strokes.filter(stroke => stroke.id !== strokeId);
                } else if (change.data?.stroke && !this.strokes.some(stroke => stroke.id === change.data.stroke.id)) {
                    this.strokes.push(new Stroke(change.data.stroke));
                }
                break;
            case 'clear_all':
                if (isRedo) {
                    this.strokes = [];
                } else {
                    this.strokes = (change.data.previousStrokes || []).map(stroke =>
                        stroke instanceof Stroke ? stroke : new Stroke(stroke)
                    );
                }
                break;
        }
        this.render();
    }
    
    exportAsPDF() {
        const exportCanvas = document.createElement('canvas');
        const exportCtx = exportCanvas.getContext('2d');
        exportCanvas.width = 2480;
        exportCanvas.height = 3508;
        
        exportCtx.fillStyle = '#ffffff';
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        
        if (this.backgroundImage) {
            exportCtx.globalAlpha = 0.6;
            exportCtx.drawImage(this.backgroundImage, 100, 100);
            exportCtx.globalAlpha = 1.0;
        }
        
        this.strokes.forEach(stroke => {
            this.drawStroke(exportCtx, stroke);
        });
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${this.store.getActiveCanvasNote()?.title || 'Canvas'}.pdf</title>
                <style>
                    body { margin: 0; padding: 20px; background: #eee; }
                    img { max-width: 100%; box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
                    @media print {
                        body { background: white; }
                        img { box-shadow: none; }
                    }
                </style>
            </head>
            <body>
                <img src="${exportCanvas.toDataURL('image/jpeg', 0.9)}" />
                <script>window.onload = function() { window.print(); }<\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    const store = new Store();
    const renderer = new Renderer(store);
    store.renderer = renderer;
    store.canvasEngine = null;
    
    const timer = new FocusTimer(store, renderer);
    store.subscribe(() => renderer.render());
    timer.updateDisplay();

    const sidebarToggle = document.querySelector('.sidebar-toggle');
    sidebarToggle.onclick = () => {
        const collapsed = document.getElementById('app').classList.toggle('sidebar-collapsed');
        sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    };
    
    // Canvas engine initialization
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) {
        window.canvasEngine = new CanvasEngine(canvasContainer, store);
        store.canvasEngine = window.canvasEngine;
    }
    
    // New note button (text notes)
    document.getElementById('new-note-btn').onclick = () => {
        renderer.saveCurrent();
        store.addNote({ title: 'Untitled Note', content: '' });
        renderer.showToast('New note created', 'success');
    };
    
    // New canvas button
    document.getElementById('new-canvas-btn').onclick = () => {
        store.addCanvasNote({ title: 'Untitled Canvas', strokes: [] });
        renderer.showToast('New canvas created', 'success');
    };
    
    // Delete note button
    document.getElementById('delete-note-btn').onclick = () => {
        const active = store.state.activeView === 'text' 
            ? store.getActiveNote() 
            : store.getActiveCanvasNote();
        
        if (active) {
            const confirmMsg = store.state.activeView === 'text' 
                ? 'Delete this note?' 
                : 'Delete this canvas?';
            if (confirm(confirmMsg)) {
                if (store.state.activeView === 'text') {
                    store.deleteNote(active.id);
                } else {
                    store.deleteCanvasNote(active.id);
                }
                renderer.showToast('Item deleted', 'success');
            }
        }
    };
    
    // PDF export buttons
    document.getElementById('pdf-btn').onclick = () => renderer.exportPDF();
    document.getElementById('export-canvas-pdf-btn').onclick = () => {
        if (store.canvasEngine) {
            store.canvasEngine.exportAsPDF();
        }
    };
    
    // Editor mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => btn.onclick = () => renderer.setMode(btn.dataset.mode));
    
    // Text editor input handling
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
    
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    const themeMenu = document.getElementById('theme-menu');
    themeToggle.onclick = (e) => { e.stopPropagation(); themeMenu.classList.toggle('hidden'); };
    document.addEventListener('click', () => themeMenu.classList.add('hidden'));
    document.querySelectorAll('#theme-menu button').forEach(btn => btn.onclick = () => {
        store.setTheme(btn.dataset.theme);
        renderer.showToast(`Theme: ${btn.textContent.split(' ')[1]}`, 'success');
    });
    
    // Export/import buttons
    document.getElementById('export-btn').onclick = () => renderer.exportNotes();
    document.getElementById('import-btn').onclick = () => document.getElementById('import-file').click();
    document.getElementById('import-file').onchange = (e) => {
        if (e.target.files[0]) { 
            renderer.importNotes(e.target.files[0]); 
            e.target.value = ''; 
        }
    };
    
    // Timer controls
    timer.startBtns.forEach(button => button.onclick = () => timer.running ? timer.pause() : timer.start());
    timer.resetBtns.forEach(button => button.onclick = () => timer.reset());
    timer.durationEls.forEach(select => select.onchange = (e) => timer.setDuration(parseInt(e.target.value)));
    
    // Save before unload
    window.addEventListener('beforeunload', () => {
        if (timer.running) timer.recordFocus();
        renderer.saveCurrent();
        if (store.canvasEngine) {
            store.canvasEngine.saveToStore();
        }
    });
    
    renderer.render();
});