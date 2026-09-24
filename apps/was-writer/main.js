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