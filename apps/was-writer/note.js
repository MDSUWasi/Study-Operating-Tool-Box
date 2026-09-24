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