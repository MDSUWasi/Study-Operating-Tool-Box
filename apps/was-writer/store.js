class Store {
    constructor() {
        this.state = {
            notes: (JSON.parse(localStorage.getItem('waswriter_notes')) || []).map(note => new Note(note)),
            canvasNotes: (JSON.parse(localStorage.getItem('waswriter_canvas')) || []).map(note => new CanvasNote(note)),
            theme: localStorage.getItem('waswriter_theme') || 'glass',
            activeNoteId: null,
            activeCanvasNoteId: null,
            totalFocusTime: parseInt(localStorage.getItem('waswriter_focus_total')) || 0,
            activeView: 'text'
        };
        this.listeners = [];
        this.historyManager = new HistoryManager(50);
        this.renderer = null;
        this.canvasEngine = null;
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