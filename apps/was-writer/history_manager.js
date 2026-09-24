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