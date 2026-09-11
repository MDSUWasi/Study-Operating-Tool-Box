class DataService {
    constructor() {
        this.range = 'week';
        this.module = 'all';
    }

    getEvents() {
        try {
            return JSON.parse(localStorage.getItem('wascalendar_events')) || [];
        } catch { return []; }
    }

    getTasks() {
        try {
            return JSON.parse(localStorage.getItem('was-to-do-list_tasks')) || [];
        } catch { return []; }
    }


    getNotes() {
        try {
            return JSON.parse(localStorage.getItem('waswriter_notes')) || [];
        } catch { return []; }
    }

    getFocusTime() {
        return parseInt(localStorage.getItem('waswriter_focus_total')) || 0;
    }

    inRange(dateStr) {
        const d = new Date(dateStr);
        const now = new Date();
        const start = new Date();
        switch (this.range) {
            case 'today':
                start.setHours(0, 0, 0, 0);
                return d >= start;
            case 'week': {
                const day = now.getDay();
                start.setDate(now.getDate() - day);
                start.setHours(0, 0, 0, 0);
                return d >= start;
            }
            case 'month':
                start.setDate(1);
                start.setHours(0, 0, 0, 0);
                return d >= start && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            default:
                return true;
        }
    }

    getEventsInRange() {
        return this.getEvents().filter(e => this.inRange(e.start));
    }

    getTasksInRange() {
        return this.getTasks().filter(t => this.inRange(t.createdAt));
    }

    getNotesInRange() {
        return this.getNotes().filter(n => this.inRange(n.createdAt));
    }

    getWeeklyData() {
        const days = [];
        const today = new Date();
        const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dayStart = new Date(d);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayStart.getDate() + 1);

            let count = 0;
            if (this.module === 'all' || this.module === 'calendar') count += this.getEvents().filter(e => { const t = new Date(e.start); return t >= dayStart && t < dayEnd; }).length;
            if (this.module === 'all' || this.module === 'tasks') count += this.getTasks().filter(t => { const t2 = new Date(t.createdAt); return t2 >= dayStart && t2 < dayEnd; }).length;
            if (this.module === 'all' || this.module === 'writer') count += this.getNotes().filter(n => { const t3 = new Date(n.createdAt); return t3 >= dayStart && t3 < dayEnd; }).length;

            days.push({ label: labels[d.getDay()], count });
        }
        return days;
    }

    getCategoryData() {
        const cats = {};
        const colors = {};
        const palette = ['#ffaa00', '#00f2ff', '#00ff88', '#ff5e3a', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981'];
        let i = 0;

        if (this.module === 'all' || this.module === 'calendar') {
            this.getEventsInRange().forEach(e => {
                const cat = `${e.category || 'other'} (events)`;
                if (!cats[cat]) { cats[cat] = 0; colors[cat] = palette[i++ % palette.length]; }
                cats[cat]++;
            });
        }
        if (this.module === 'all' || this.module === 'tasks') {
            this.getTasksInRange().forEach(t => {
                const cat = `${t.category || 'other'} (tasks)`;
                if (!cats[cat]) { cats[cat] = 0; colors[cat] = palette[i++ % palette.length]; }
                cats[cat]++;
            });
        }
        if (this.module === 'all' || this.module === 'writer') {
            this.getNotesInRange().forEach(() => {
                const cat = 'notes';
                if (!cats[cat]) { cats[cat] = 0; colors[cat] = palette[i++ % palette.length]; }
                cats[cat]++;
            });
        }

        return { labels: Object.keys(cats), values: Object.values(cats), colors };
    }

    getActivity() {
        const items = [];
        this.getEventsInRange().forEach(e => {
            items.push({ icon: '📅', text: `Event <strong>${e.title}</strong> created`, time: e.createdAt || e.start });
        });
        this.getTasksInRange().forEach(t => {
            items.push({ icon: t.completed ? '✅' : '📝', text: `Task <strong>${t.title}</strong> ${t.completed ? 'completed' : 'created'}`, time: t.updatedAt || t.createdAt });
        });
        this.getNotesInRange().forEach(n => {
            items.push({ icon: '✍️', text: `Note <strong>${n.title || 'Untitled'}</strong> updated`, time: n.updatedAt || n.createdAt });
        });
        items.sort((a, b) => new Date(b.time) - new Date(a.time));
        return items.slice(0, 10);
    }
}

class Renderer {
    constructor(service) {
        this.service = service;
        this.barChart = document.getElementById('bar-chart');
        this.donutChart = document.getElementById('donut-chart');
        this.donutLegend = document.getElementById('donut-legend');
        this.activityList = document.getElementById('activity-list');
    }

    render() {
        this.renderKPIs();
        this.renderBarChart();
        this.renderDonut();
        this.renderActivity();
    }

    renderKPIs() {
        const events = this.service.getEventsInRange();
        const tasks = this.service.getTasksInRange();
        const notes = this.service.getNotesInRange();
        const completed = tasks.filter(t => t.completed).length;
        const focus = this.service.getFocusTime();
        const words = notes.reduce((sum, n) => sum + (n.content ? n.content.trim().split(/\s+/).filter(Boolean).length : 0), 0);

        document.getElementById('kpi-events').textContent = events.length;
        document.getElementById('kpi-completed').textContent = completed;
        document.getElementById('kpi-focus').textContent = this.formatFocus(focus);
        document.getElementById('kpi-words').textContent = words;

        document.getElementById('stat-events').textContent = events.length;
        document.getElementById('stat-tasks').textContent = tasks.length;
        document.getElementById('stat-completed').textContent = completed;
        document.getElementById('stat-notes').textContent = notes.length;
    }

    renderBarChart() {
        const data = this.service.getWeeklyData();
        const max = Math.max(...data.map(d => d.count), 1);
        this.barChart.innerHTML = '';
        data.forEach(d => {
            const col = document.createElement('div');
            col.className = 'bar-col';
            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.style.height = `${(d.count / max) * 100}%`;
            const val = document.createElement('div');
            val.className = 'bar-value';
            val.textContent = d.count;
            const label = document.createElement('div');
            label.className = 'bar-label';
            label.textContent = d.label;
            col.appendChild(bar);
            col.appendChild(val);
            col.appendChild(label);
            this.barChart.appendChild(col);
        });
    }

    renderDonut() {
        const { labels, values, colors } = this.service.getCategoryData();
        const total = values.reduce((a, b) => a + b, 0);

        this.donutChart.querySelector('.donut-center')?.remove();

        if (total === 0) {
            this.donutChart.style.background = 'conic-gradient(var(--text-muted) 0deg, var(--text-muted) 360deg)';
            this.donutLegend.innerHTML = '<div class="legend-item"><span class="legend-dot" style="background:var(--text-muted)"></span>No data</div>';
            return;
        }

        let cumulative = 0;
        let gradient = '';
        labels.forEach((label, i) => {
            const start = (cumulative / total) * 360;
            cumulative += values[i];
            const end = (cumulative / total) * 360;
            gradient += `, ${colors[label]} ${start}deg ${end}deg`;
        });
        this.donutChart.style.background = `conic-gradient(${gradient.slice(2)})`;

        const center = document.createElement('div');
        center.className = 'donut-center';
        center.textContent = total;
        this.donutChart.appendChild(center);

        this.donutLegend.innerHTML = '';
        labels.forEach((label, i) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `<span class="legend-dot" style="background:${colors[label]}"></span>${label} (${values[i]})`;
            this.donutLegend.appendChild(item);
        });
    }

    renderActivity() {
        const items = this.service.getActivity();
        this.activityList.innerHTML = '';
        if (items.length === 0) {
            this.activityList.innerHTML = '<div class="activity-item"><span class="activity-icon">📭</span><span class="activity-text">No activity in this range</span></div>';
            return;
        }
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'activity-item';
            div.innerHTML = `
                <span class="activity-icon">${item.icon}</span>
                <span class="activity-text">${item.text}</span>
                <span class="activity-time">${new Date(item.time).toLocaleDateString()} ${new Date(item.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
            `;
            this.activityList.appendChild(div);
        });
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
}

document.addEventListener('DOMContentLoaded', () => {
    const service = new DataService();
    const renderer = new Renderer(service);
    const theme = localStorage.getItem('stats_theme') || 'glass';
    document.body.className = `theme-${theme}`;
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    sidebarToggle.onclick = () => {
        const collapsed = document.getElementById('app').classList.toggle('sidebar-collapsed');
        sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    };
    document.querySelectorAll('.nav-item').forEach(btn => btn.onclick = () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        service.range = btn.dataset.range;
        renderer.render();
    });

    document.querySelectorAll('.category-btn').forEach(btn => btn.onclick = () => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        service.module = btn.dataset.module;
        renderer.render();
    });

    const themeToggle = document.getElementById('theme-toggle');
    const themeMenu = document.getElementById('theme-menu');
    themeToggle.onclick = (e) => { e.stopPropagation(); themeMenu.classList.toggle('hidden'); };
    document.addEventListener('click', () => themeMenu.classList.add('hidden'));
    document.querySelectorAll('#theme-menu button').forEach(btn => btn.onclick = () => {
        localStorage.setItem('stats_theme', btn.dataset.theme);
        document.body.className = `theme-${btn.dataset.theme}`;
        renderer.showToast(`Theme: ${btn.textContent.split(' ')[1]}`, 'success');
    });

    document.getElementById('refresh-btn').onclick = () => {
        renderer.render();
        renderer.showToast('Data refreshed', 'success');
    };

    renderer.render();
});