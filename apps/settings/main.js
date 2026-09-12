const STORAGE_KEYS = {
    calendarEvents: 'powercalendar_events',
    calendarTheme: 'powercalendar_theme',
    tasks: 'focusflow_tasks',
    tasksTheme: 'focusflow_theme',
    notes: 'neuralwriter_notes',
    focusTotal: 'neuralwriter_focus_total',
    writerTheme: 'neuralwriter_theme',
    settingsAccent: 'studyoperatingtoolbox_accent',
    settingsName: 'studyoperatingtoolbox_name'
};

const ACCENTS = ['#00f2ff', '#00ff88', '#ffaa00', '#ff5e3a', '#8b5cf6', '#ec4899', '#3b82f6', '#00ccff'];

class SettingsApp {
    constructor() {
        this.accent = localStorage.getItem(STORAGE_KEYS.settingsAccent) || '#00f2ff';
        this.systemName = localStorage.getItem(STORAGE_KEYS.settingsName) || 'Study Operating Tool-Box';
this.appTheme = localStorage.getItem('studyoperatingtoolbox_theme') || 'glass';
    }

    showToast(msg, type = 'info') {
        const div = document.createElement('div');
        div.className = `toast ${type}`;
        div.textContent = msg;
        document.getElementById('toast-container').appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }
    initAccentPicker() {
        const container = document.getElementById('accent-options');
        container.innerHTML = '';
        ACCENTS.forEach(color => {
            const dot = document.createElement('div');
            dot.className = `accent-dot ${color === this.accent ? 'active' : ''}`;
            dot.style.background = color;
            dot.onclick = () => {
                this.accent = color;
                localStorage.setItem(STORAGE_KEYS.settingsAccent, color);
                document.getElementById('accent-custom').value = color;
                document.querySelectorAll('.accent-dot').forEach(d => d.classList.remove('active'));
                dot.classList.add('active');
                this.applyAccent();
                this.showToast('Accent color updated', 'success');
            };
            container.appendChild(dot);
        });
        document.getElementById('accent-custom').value = this.accent;
        document.getElementById('accent-custom').oninput = (e) => {
            this.accent = e.target.value;
            localStorage.setItem(STORAGE_KEYS.settingsAccent, this.accent);
            document.querySelectorAll('.accent-dot').forEach(d => d.classList.remove('active'));
            this.applyAccent();
        };
        this.applyAccent();
    }

    applyAccent() {
        document.documentElement.style.setProperty('--primary', this.accent);
        document.documentElement.style.setProperty('--primary-glow', `${this.accent}66`);
    }

    initThemeOptions() {
        document.querySelectorAll('.theme-option').forEach(btn => {
            if (btn.dataset.theme === this.appTheme) btn.classList.add('active');
            btn.onclick = () => {
                document.querySelectorAll('.theme-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.appTheme = btn.dataset.theme;
                localStorage.setItem('studyoperatingtoolbox_theme', this.appTheme);
                this.showToast('Default theme set', 'success');
            };
        });
    }

    initSystemName() {
        document.getElementById('system-name').value = this.systemName;
        document.getElementById('save-name-btn').onclick = () => {
            const name = document.getElementById('system-name').value.trim() || 'Study Operating Tool-Box';
            document.getElementById('system-name').value = name;
            localStorage.setItem(STORAGE_KEYS.settingsName, name);
            this.systemName = name;
            this.showToast('System name saved', 'success');
        };
    }
    gatherAllData() {
        const data = {};
        Object.values(STORAGE_KEYS).forEach(key => {
            const val = localStorage.getItem(key);
            if (val) {
                try { data[key] = JSON.parse(val); }
                catch { data[key] = val; }
            }
        });
        data.$meta = {
            exportedAt: new Date().toISOString(),
            app: 'Study Operating Tool-Box',
            version: 'v1.0.initial'
        };
        return data;
    }

    exportAll() {
        const data = this.gatherAllData();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `study_operating_toolbox_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('Backup exported', 'success');
    }

    importAll(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                let count = 0;
                Object.values(STORAGE_KEYS).forEach(key => {
                    if (data[key] !== undefined) {
                        localStorage.setItem(key, typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]));
                        count++;
                    }
                });
                this.showToast(`Imported ${count} data entries`, 'success');
                this.renderStorage();
                this.initAppearance();
            } catch {
                this.showToast('Invalid backup file', 'error');
            }
        };
        reader.readAsText(file);
    }

    clearAll() {
        Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
        localStorage.removeItem('studyoperatingtoolbox_theme');
        this.showToast('All data cleared', 'success');
        this.renderStorage();
        this.initAppearance();
    }

    renderStorage() {
        const list = document.getElementById('storage-list');
        const totalEl = document.getElementById('storage-total');
        list.innerHTML = '';
        let totalBytes = 0;

        const icons = {
            powercalendar_events: '📅',
            focusflow_tasks: '✅',
            neuralwriter_notes: '✍️',
            neuralwriter_focus_total: '⏱️'
        };

        Object.values(STORAGE_KEYS).forEach(key => {
            const val = localStorage.getItem(key);
            if (!val) return;
            const bytes = new Blob([val]).size;
            totalBytes += bytes;

            const item = document.createElement('div');
            item.className = 'storage-item';
            item.innerHTML = `
                <span class="storage-icon">${icons[`${key}`] || '🗄️'}</span>
                <div class="storage-info">
                    <div class="storage-name">${this.prettyName(key)}</div>
                    <div class="storage-key">${key}</div>
                </div>
                <span class="storage-size">${this.formatBytes(bytes)}</span>
            `;
            list.appendChild(item);
        });

        if (totalBytes === 0) {
            list.innerHTML = '<div class="storage-item"><span class="storage-icon">📭</span><div class="storage-info"><div class="storage-name">No data stored yet</div><div class="storage-key">Start using your apps to generate data</div></div></div>';
        }
        totalEl.textContent = this.formatBytes(totalBytes);
    }

    prettyName(key) {
        const map = {
            powercalendar_events: 'Calendar Events',
            powercalendar_theme: 'Calendar Theme',
            focusflow_tasks: 'Tasks',
            focusflow_theme: 'Tasks Theme',
            neuralwriter_notes: 'Writer Notes',
            neuralwriter_focus_total: 'Total Focus Time',
            neuralwriter_theme: 'Writer Theme',
            studyoperatingtoolbox_accent: 'Accent Color',
            studyoperatingtoolbox_name: 'System Name'
        };
        return map[key] || key;
    }

    formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    initNavigation() {
        document.querySelectorAll('.nav-item').forEach(btn => btn.onclick = () => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
            document.getElementById(`section-${btn.dataset.section}`).classList.add('active');
        });
    }

    initAppearance() {
        const savedAccent = localStorage.getItem(STORAGE_KEYS.settingsAccent) || '#00f2ff';
        this.accent = savedAccent;
        this.systemName = localStorage.getItem(STORAGE_KEYS.settingsName) || 'Study operating Tool-Box';
        this.initAccentPicker();
        this.initThemeOptions();
        this.initSystemName();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new SettingsApp();
    document.body.className = `theme-${app.appTheme}`;
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    sidebarToggle.onclick = () => {
        const collapsed = document.getElementById('app').classList.toggle('sidebar-collapsed');
        sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    };
    app.initNavigation();
    app.initAppearance();
    app.renderStorage();

    const themeToggle = document.getElementById('theme-toggle');
    const themeMenu = document.getElementById('theme-menu');
    themeToggle.onclick = (e) => { e.stopPropagation(); themeMenu.classList.toggle('hidden'); };
    document.addEventListener('click', () => themeMenu.classList.add('hidden'));
    document.querySelectorAll('#theme-menu button').forEach(btn => btn.onclick = () => {
        document.body.className = `theme-${btn.dataset.theme}`;
        app.appTheme = btn.dataset.theme;
        localStorage.setItem('studyoperatingtoolbox_theme', btn.dataset.theme);
        app.showToast(`Theme: ${btn.textContent.split(' ')[1]}`, 'success');
    });

    document.getElementById('export-all-btn').onclick = () => app.exportAll();
    document.getElementById('import-all-btn').onclick = () => document.getElementById('import-all-file').click();
    document.getElementById('import-all-file').onchange = (e) => {
        if (e.target.files[0]) { app.importAll(e.target.files[0]); e.target.value = ''; }
    };
    document.getElementById('clear-all-btn').onclick = () => {
        if (confirm('Are you sure you want to clear ALL data? This cannot be undone!')) {
            if (confirm('Final confirmation: This will delete all your calendar events, tasks, notes, and settings.')) {
                app.clearAll();
            }
        }
    };
});