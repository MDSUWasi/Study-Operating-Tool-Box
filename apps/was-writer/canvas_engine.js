class CanvasEngine {
    constructor(container, store) {
        this.container = container;
        this.store = store;
        
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.touchAction = 'none';
        container.appendChild(this.canvas);
        
        this.mode = 'pen';
        this.color = '#00f2ff';
        this.isDrawing = false;
        this.currentStroke = null;
        this.strokes = [];
        this.viewState = { x: 0, y: 0, scale: 1 };
        this.lastMouse = { x: 0, y: 0 };
        this.isPanning = false;
        
        this.penSize = 3;
        this.highlighterSize = 20;
        this.eraserSize = 30;
        this.pressureSensitivity = true;
        this.pressureScale = 2;
        
        this.backgroundImage = null;
        this.backgroundLayers = [];
        this.currentPageIndex = 0;
        this.currentPageCount = 1;
        
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