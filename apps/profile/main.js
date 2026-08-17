const BANNER_COLORS = [
    ['#8b5cf6', '#ec4899', '#00f2ff'],
    ['#00ff88', '#00ccff', '#7000ff'],
    ['#ffaa00', '#ff5e3a', '#ef4444'],
    ['#3b82f6', '#10b981', '#f59e0b']
];
const ACCENTS = ['#8b5cf6', '#ec4899', '#00f2ff', '#00ff88', '#ffaa00', '#3b82f6', '#10b981', '#ef4444'];
const EMOJIS = ['🧑‍🎓', '👨‍💻', '👩‍🔬', '🧑‍🏫', '🧑‍🎨', '👨‍🚀', '🧑‍⚕️', '🧑‍💼', '👩‍🎓', '🧑‍🔬'];

class ProfileApp {
    constructor() {
        this.profile = {
            name: localStorage.getItem('profile_name') || 'Scholar',
            role: localStorage.getItem('profile_role') || 'Student · Researcher',
            bio: localStorage.getItem('profile_bio') || '',
            email: localStorage.getItem('profile_email') || '',
            institution: localStorage.getItem('profile_institution') || '',
            avatarEmoji: localStorage.getItem('profile_avatar') || '🧑‍🎓',
            avatarData: localStorage.getItem('profile_avatar_data') || null,
            bannerColors: (localStorage.getItem('profile_banner') || '8b5cf6,ec4899,00f2ff').split(','),
accent: localStorage.getItem('profile_accent') || '#8b5cf6',
            theme: localStorage.getItem('profile_theme') || 'glass'
        };
    }

    showToast(msg, type = 'info') {
        const div = document.createElement('div');
        div.className = `toast ${type}`;
        div.textContent = msg;
        document.getElementById('toast-container').appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }

    applyAccent() {
        document.documentElement.style.setProperty('--primary', this.profile.accent);
        document.documentElement.style.setProperty('--primary-glow', `${this.profile.accent}66`);
    }

    applyBanner() {
        const banner = document.getElementById('profile-banner');
        banner.style.background = `linear-gradient(135deg, ${this.profile.bannerColors.join(', ')})`;
    }

    renderIdentity() {
        document.getElementById('display-name').textContent = this.profile.name;
        document.getElementById('display-role').textContent = this.profile.role;
        document.getElementById('profile-name').value = this.profile.name;
        document.getElementById('profile-role').value = this.profile.role;
        document.getElementById('profile-bio').value = this.profile.bio;
        document.getElementById('profile-email').value = this.profile.email;
        document.getElementById('profile-institution').value = this.profile.institution;

        const avatar = document.getElementById('avatar-display');
        if (this.profile.avatarData) {
            avatar.style.backgroundImage = `url(${this.profile.avatarData})`;
            avatar.style.backgroundSize = 'cover';
            avatar.style.fontSize = '0';
        } else {
            avatar.style.backgroundImage = '';
            avatar.style.fontSize = '3.5rem';
            avatar.textContent = this.profile.avatarEmoji;
        }
    }

    initBannerColors() {
        const grid = document.getElementById('banner-colors');
        grid.innerHTML = '';
        BANNER_COLORS.forEach((colors, idx) => {
            const btn = document.createElement('button');
            btn.style.background = `linear-gradient(135deg, ${colors.join(', ')})`;
            btn.className = 'color-swatch';
            const isActive = this.profile.bannerColors.join(',') === colors.join(',');
            if (isActive) btn.classList.add('active');
            btn.onclick = () => {
                this.profile.bannerColors = colors;
                localStorage.setItem('profile_banner', colors.join(','));
                this.applyBanner();
                document.querySelectorAll('#banner-colors .color-swatch').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                this.showToast('Banner updated', 'success');
            };
            grid.appendChild(btn);
        });
    }

    initAccentColors() {
        const grid = document.getElementById('accent-colors');
        grid.innerHTML = '';
        ACCENTS.forEach(color => {
            const btn = document.createElement('button');
            btn.style.background = color;
            btn.className = 'color-swatch';
            if (color === this.profile.accent) btn.classList.add('active');
            btn.onclick = () => {
                this.profile.accent = color;
                localStorage.setItem('profile_accent', color);
                this.applyAccent();
                document.querySelectorAll('#accent-colors .color-swatch').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                this.showToast('Accent updated', 'success');
            };
            grid.appendChild(btn);
        });
    }

    initEmojis() {
        const grid = document.getElementById('emoji-options');
        grid.innerHTML = '';
        EMOJIS.forEach(emoji => {
            const btn = document.createElement('button');
            btn.className = `emoji-option ${emoji === this.profile.avatarEmoji && !this.profile.avatarData ? 'active' : ''}`;
            btn.textContent = emoji;
            btn.onclick = () => {
                this.profile.avatarEmoji = emoji;
                this.profile.avatarData = null;
                document.getElementById('avatar-input').value = '';
                localStorage.setItem('profile_avatar', emoji);
                localStorage.removeItem('profile_avatar_data');
                this.renderIdentity();
                document.querySelectorAll('#emoji-options .emoji-option').forEach(e => e.classList.remove('active'));
                btn.classList.add('active');
                this.showToast('Avatar updated', 'success');
            };
            grid.appendChild(btn);
        });
    }

    initAvatarUpload() {
        document.getElementById('avatar-input').onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                this.profile.avatarData = ev.target.result;
                localStorage.setItem('profile_avatar_data', ev.target.result);
                this.renderIdentity();
                document.querySelectorAll('#emoji-options .emoji-option').forEach(e => e.classList.remove('active'));
                this.showToast('Avatar uploaded', 'success');
            };
            reader.readAsDataURL(file);
        };
    }

    saveProfile() {
        this.profile.name = document.getElementById('profile-name').value.trim() || 'Scholar';
        this.profile.role = document.getElementById('profile-role').value.trim() || 'Student · Researcher';
        this.profile.bio = document.getElementById('profile-bio').value;
        this.profile.email = document.getElementById('profile-email').value;
        this.profile.institution = document.getElementById('profile-institution').value;

        localStorage.setItem('profile_name', this.profile.name);
        localStorage.setItem('profile_role', this.profile.role);
        localStorage.setItem('profile_bio', this.profile.bio);
        localStorage.setItem('profile_email', this.profile.email);
        localStorage.setItem('profile_institution', this.profile.institution);

        this.renderIdentity();
        this.showToast('Profile saved', 'success');
    }

    loadAchievements() {
        const hasNote = (JSON.parse(localStorage.getItem('neuralwriter_notes')) || []).length > 0;
        const hasEvent = (JSON.parse(localStorage.getItem('powercalendar_events')) || []).length > 0;
        const hasTask = (JSON.parse(localStorage.getItem('focusflow_tasks')) || []).length > 0;
        const focus = parseInt(localStorage.getItem('neuralwriter_focus_total')) || 0;

        this.setAchievement('ach-note', hasNote);
        this.setAchievement('ach-event', hasEvent);
        this.setAchievement('ach-task', hasTask);
        this.setAchievement('ach-focus', focus >= 25 * 60);
    }

    setAchievement(id, unlocked) {
        const el = document.getElementById(id);
        const card = el.closest('.achievement');
        if (unlocked) {
            card.classList.add('unlocked');
            el.textContent = 'Unlocked';
            el.className = 'ach-status unlocked';
        } else {
            card.classList.remove('unlocked');
            el.textContent = 'Locked';
            el.className = 'ach-status locked';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new ProfileApp();
    document.body.className = `theme-${app.profile.theme}`;
    app.applyAccent();
    app.applyBanner();
    app.renderIdentity();
    app.initBannerColors();
    app.initAccentColors();
    app.initEmojis();
    app.initAvatarUpload();
    app.loadAchievements();

    document.getElementById('save-profile-btn').onclick = () => app.saveProfile();
    document.getElementById('save-style-btn').onclick = () => {
        app.applyAccent();
        app.applyBanner();
        app.showToast('Style saved', 'success');
    };

    const themeToggle = document.getElementById('theme-toggle');
    const themeMenu = document.getElementById('theme-menu');
    themeToggle.onclick = (e) => { e.stopPropagation(); themeMenu.classList.toggle('hidden'); };
    document.addEventListener('click', () => themeMenu.classList.add('hidden'));
    document.querySelectorAll('#theme-menu button').forEach(btn => btn.onclick = () => {
        document.body.className = `theme-${btn.dataset.theme}`;
        app.profile.theme = btn.dataset.theme;
        localStorage.setItem('profile_theme', btn.dataset.theme);
        app.showToast(`Theme: ${btn.textContent.split(' ')[1]}`, 'success');
    });
});