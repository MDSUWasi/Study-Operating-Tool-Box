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
                    data.forEach(n => this.store.addNote(n));
                    count = data.length;
                } else if (data.text || data.canvas) {
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