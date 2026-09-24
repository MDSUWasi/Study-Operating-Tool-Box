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