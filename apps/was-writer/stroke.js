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
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(36).substring(0, 1)
        );
    }
    
    toJSON() { return { ...this }; }
}