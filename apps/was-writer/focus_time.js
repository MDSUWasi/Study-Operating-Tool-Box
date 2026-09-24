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