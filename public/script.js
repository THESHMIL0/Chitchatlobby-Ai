// Connects directly to local server!
const socket = io();

function hapticFeedback(type = 'light') {
    if (!navigator.vibrate) return;
    if (type === 'light') navigator.vibrate(30); 
    else if (type === 'medium') navigator.vibrate(50); 
    else if (type === 'heavy') navigator.vibrate([40, 60, 40]); 
}

function escapeHTML(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

function showToast(msg, duration = 3000) {
    let toast = document.getElementById('custom-app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'custom-app-toast';
        toast.className = 'custom-toast-pill';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

const loadingScreen = document.getElementById('loading-screen');
const appLockScreen = document.getElementById('app-lock-screen'); 
const loginScreen = document.getElementById('login-screen');
const roomListScreen = document.getElementById('room-list-screen');
const chatScreen = document.getElementById('chat-screen');
const profileScreen = document.getElementById('profile-screen');
const settingsScreen = document.getElementById('settings-screen');

const createRoomModal = document.getElementById('create-room-modal');
const passwordModal = document.getElementById('password-modal');
const msgOptionsModal = document.getElementById('msg-options-modal');
const viewProfileModal = document.getElementById('view-profile-modal');
const groupInfoModal = document.getElementById('group-info-modal');

const usernameInput = document.getElementById('username-input');
const avatarPreview = document.getElementById('avatar-preview');
const profilePicUpload = document.getElementById('profile-pic-upload');
const roomsUl = document.getElementById('rooms-ul');
const currentRoomName = document.getElementById('current-room-name');
const currentRoomLogo = document.getElementById('current-room-logo');
const onlineUsersText = document.getElementById('online-users-text');
const groupPicUpload = document.getElementById('group-pic-upload');
const messages = document.getElementById('messages');
const input = document.getElementById('the-chat-box');
const sendMicBtn = document.getElementById('send-mic-btn');
const attachBtn = document.getElementById('attach-btn');
const imageUpload = document.getElementById('image-upload');
const replyPreviewContainer = document.getElementById('reply-preview-container');
const ghostBtn = document.getElementById('ghost-btn'); 

const pollBtn = document.getElementById('poll-btn');
const createPollModal = document.getElementById('create-poll-modal');
const addPollOptBtn = document.getElementById('add-poll-opt-btn');
const sendPollBtn = document.getElementById('send-poll-btn');
const pollQuestion = document.getElementById('poll-question');
const pollOptionsContainer = document.getElementById('poll-options-container');

const appSettingsModal = document.getElementById('app-settings-modal'); 
const headerClickArea = document.getElementById('header-click-area');
const infoRoomLogo = document.getElementById('info-room-logo');
const infoRoomName = document.getElementById('info-room-name');
const chatSearchContainer = document.getElementById('chat-search-container');
const chatSearchInput = document.getElementById('chat-search-input');
const wallpaperUpload = document.getElementById('wallpaper-upload');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');

let currentUser = { name: '', avatar: '', about: 'Hey there! I am using Chit Chat.', color: '#dcf8c6' }; 
let activeRoomId = null;
let currentRoomPassword = ''; 
let replyingTo = null;
let selectedMsgId = null; 

let editingMsgId = null;
let isGhostMode = false;
let unreadCounts = {}; 
const defaultRooms = [
    { id: 'lobby', name: 'Lobby 😸', logo: '', isPrivate: 0 },
    { id: 'ai_lounge', name: '🤖 AI Lounge', logo: 'https://api.dicebear.com/7.x/bottts/svg?seed=ChitChatBot&backgroundColor=00a884', isPrivate: 0 }
];
let globalRoomList = [...defaultRooms];
let currentlyTyping = new Map();
let baseOnlineText = "Tap to change info";

let typingTimeout;
let typingSent = false;
let globalAudio = null;
let globalAudioBtn = null;
let globalAudioFill = null;

let isPromptingBiometrics = false;
const toggleAppLock = document.getElementById('toggle-app-lock');
if (toggleAppLock) {
    toggleAppLock.checked = localStorage.getItem('chitchat_applock') === 'true';
    toggleAppLock.addEventListener('change', (e) => {
        localStorage.setItem('chitchat_applock', e.target.checked);
    });
}

async function verifyAppLock() {
    if (localStorage.getItem('chitchat_applock') !== 'true') return;
    if (isPromptingBiometrics) return; 

    isPromptingBiometrics = true;
    if (appLockScreen) appLockScreen.classList.remove('hidden');

    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativeBiometric) {
        try {
            await window.Capacitor.Plugins.NativeBiometric.verifyIdentity({ reason: 'Unlock Chit Chat', title: 'App Locked' });
            if (appLockScreen) appLockScreen.classList.add('hidden');
            setTimeout(() => { isPromptingBiometrics = false; }, 1000);
        } catch (e) { 
            console.error('Biometric error', e); 
            isPromptingBiometrics = false; 
        }
    } else {
        const lockHeading = document.querySelector('#app-lock-screen h2');
        if (lockHeading) lockHeading.innerText = "Web Mode: Click to Unlock";
        const unlockBtn = document.getElementById('unlock-app-btn');
        if (unlockBtn) {
            unlockBtn.onclick = () => {
                if (appLockScreen) appLockScreen.classList.add('hidden');
                isPromptingBiometrics = false;
            };
        }
    }
}

const unlockAppBtn = document.getElementById('unlock-app-btn');
if (unlockAppBtn) unlockAppBtn.onclick = verifyAppLock;
if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) { 
    try { window.Capacitor.Plugins.App.addListener('appStateChange', (state) => { if (state.isActive) verifyAppLock(); }); } catch(e){} 
}
verifyAppLock(); 

function closeLightbox() { 
    if (lightbox) lightbox.classList.add('hidden'); 
    if (lightboxImg) lightboxImg.src = ''; 
}
if (lightbox) {
    lightbox.addEventListener('click', closeLightbox); 
    lightbox.addEventListener('touchstart', closeLightbox, { passive: true });
}

function saveUserLocally() {
    try {
        localStorage.setItem('chitchat_user', JSON.stringify(currentUser));
    } catch (e) {
        console.warn('Failed to save user to localStorage:', e);
        // If avatar string is too large, fallback to saving without base64 or clear old items if needed
        try {
            const copy = { ...currentUser };
            if (copy.avatar && copy.avatar.startsWith('data:')) {
                // If storing custom image exceeded quota, fallback to standard dicebear URL for local persistence
                copy.avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(copy.name || 'Guest')}`;
            }
            localStorage.setItem('chitchat_user', JSON.stringify(copy));
        } catch (e2) {
            console.error('LocalStorage error:', e2);
        }
    }
}

function syncUserAvatarUI() {
    if (!currentUser) return;
    const url = currentUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.name || 'Guest')}`;
    
    const elements = [
        document.getElementById('avatar-preview'),
        document.getElementById('settings-avatar-preview'),
        document.getElementById('settings-card-avatar'),
        document.getElementById('lobby-user-avatar')
    ];

    elements.forEach(img => {
        if (img) {
            img.src = url;
            img.onerror = function() {
                this.onerror = null;
                this.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.name || 'Guest')}`;
            };
        }
    });
}

if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) {
    try { window.Capacitor.Plugins.LocalNotifications.requestPermissions(); } catch(e){}
} else if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
    try { Notification.requestPermission(); } catch(e){}
}

function getSweetheartSvgDataUrl(customColor) {
    const currentTheme = (typeof document !== 'undefined' && document.body) ? (document.body.getAttribute('data-theme') || 'emerald') : 'emerald';
    let c1 = '#4ade80', c2 = '#22c55e', c3 = '#15803d';

    if (customColor && customColor.startsWith('#')) {
        c1 = customColor; c2 = customColor; c3 = customColor;
    } else if (currentTheme === 'pink') {
        c1 = '#fb7185'; c2 = '#f43f5e'; c3 = '#be123c';
    } else if (currentTheme === 'dark') {
        c1 = '#34d399'; c2 = '#10b981'; c3 = '#047857';
    } else if (currentTheme === 'light') {
        c1 = '#34d399'; c2 = '#10b981'; c3 = '#059669';
    } else if (currentTheme === 'emerald') {
        c1 = '#4ade80'; c2 = '#22c55e'; c3 = '#15803d';
    } else {
        const computedAccent = (typeof document !== 'undefined' && document.body) ? getComputedStyle(document.body).getPropertyValue('--accent').trim() : '';
        c1 = computedAccent || '#10b981';
        c2 = c1;
        c3 = c1;
    }

    const enc1 = encodeURIComponent(c1);
    const enc2 = encodeURIComponent(c2);
    const enc3 = encodeURIComponent(c3);

    return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' width='200' height='200'%3E%3Cdefs%3E%3CradialGradient id='hg' cx='40%25' cy='35%25' r='65%25'%3E%3Cstop offset='0%25' stop-color='${enc1}' stop-opacity='0.9'/%3E%3Cstop offset='50%25' stop-color='${enc2}' stop-opacity='0.8'/%3E%3Cstop offset='100%25' stop-color='${enc3}' stop-opacity='0.7'/%3E%3C/radialGradient%3E%3ClinearGradient id='hh' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23ffffff' stop-opacity='0.45'/%3E%3Cstop offset='45%25' stop-color='%23ffffff' stop-opacity='0.1'/%3E%3Cstop offset='100%25' stop-color='%23000000' stop-opacity='0.2'/%3E%3C/linearGradient%3E%3Cfilter id='f' x='-20%25' y='-20%25' width='140%25' height='140%25'%3E%3CfeGaussianBlur stdDeviation='5' result='b'/%3E%3CfeComposite in='SourceGraphic' in2='b' operator='over'/%3E%3C/filter%3E%3C/defs%3E%3Cpath d='M 100 68 C 75 32, 35 42, 35 85 C 35 125, 100 162, 100 162 C 100 162, 165 125, 165 85 C 165 42, 125 32, 100 68 Z' fill='url(%23hg)' filter='url(%23f)'/%3E%3Cpath d='M 100 68 C 75 32, 35 42, 35 85 C 35 125, 100 162, 100 162 C 100 162, 165 125, 165 85 C 165 42, 125 32, 100 68 Z' fill='url(%23hh)'/%3E%3Cg transform='translate(136, 68)'%3E%3Cpath d='M 0 -13 Q 0 0 13 0 Q 0 0 0 13 Q 0 0 -13 0 Q 0 0 0 -13 Z' fill='%23ffffff' opacity='0.95'/%3E%3Ccircle cx='0' cy='0' r='2.5' fill='%23ffffff'/%3E%3C/g%3E%3Cg transform='translate(78, 120)'%3E%3Cpath d='M 0 -10 Q 0 0 10 0 Q 0 0 0 10 Q 0 0 -10 0 Q 0 0 0 -10 Z' fill='%23ffffff' opacity='0.95'/%3E%3Ccircle cx='0' cy='0' r='2' fill='%23ffffff'/%3E%3C/g%3E%3C/svg%3E")`;
}

function getFlirtSvgDataUrl(customColor) {
    const currentTheme = (typeof document !== 'undefined' && document.body) ? (document.body.getAttribute('data-theme') || 'emerald') : 'emerald';
    let pFill = '#22c55e', pShadow = '#14532d', sFill = '#4ade80', sShadow = '#166534', txtColor = 'rgba(255,255,255,0.95)';
    
    if (customColor && customColor.startsWith('#')) {
        pFill = customColor; pShadow = customColor;
        sFill = customColor; sShadow = customColor;
    } else if (currentTheme === 'pink') {
        pFill = '#f43f5e'; pShadow = '#881337';
        sFill = '#fb7185'; sShadow = '#9f1239';
    } else if (currentTheme === 'dark') {
        pFill = '#10b981'; pShadow = '#022c22';
        sFill = '#34d399'; sShadow = '#064e3b';
    } else if (currentTheme === 'light') {
        pFill = '#10b981'; pShadow = '#065f46';
        sFill = '#34d399'; sShadow = '#047857';
    } else if (currentTheme === 'emerald') {
        pFill = '#22c55e'; pShadow = '#14532d';
        sFill = '#4ade80'; sShadow = '#166534';
    } else {
        const computedAccent = (typeof document !== 'undefined' && document.body) ? getComputedStyle(document.body).getPropertyValue('--accent').trim() : '';
        if (computedAccent) {
            pFill = computedAccent; pShadow = computedAccent;
            sFill = computedAccent; sShadow = computedAccent;
        }
    }

    const epFill = encodeURIComponent(pFill);
    const epShadow = encodeURIComponent(pShadow);
    const esFill = encodeURIComponent(sFill);
    const esShadow = encodeURIComponent(sShadow);
    const etxt = encodeURIComponent(txtColor);

    const hD = "M 0 -18 C -22 -38, -44 -16, -44 8 C -44 32, 0 62, 0 62 C 0 62, 44 32, 44 8 C 44 -16, 22 -38, 0 -18 Z";

    const svg = `%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 320 480' preserveAspectRatio='xMidYMid slice'%3E` +
        `%3Cdefs%3E` +
        `%3ClinearGradient id='hl' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E` +
        `%3Cstop offset='0%25' stop-color='%23ffffff' stop-opacity='0.42'/%3E` +
        `%3Cstop offset='100%25' stop-color='%23000000' stop-opacity='0.22'/%3E` +
        `%3C/linearGradient%3E` +
        `%3C/defs%3E` +
        `%3Cg transform='translate(135, 205) rotate(-10) scale(1.35)'%3E` +
        `%3Cpath d='${hD}' fill='${epShadow}' transform='translate(6, 8)'/%3E` +
        `%3Cpath d='${hD}' fill='${epFill}'/%3E` +
        `%3Cpath d='${hD}' fill='url(%23hl)'/%3E` +
        `%3C/g%3E` +
        `%3Cg transform='translate(205, 305) rotate(12) scale(0.95)'%3E` +
        `%3Cpath d='${hD}' fill='${esShadow}' transform='translate(5, 6.5)'/%3E` +
        `%3Cpath d='${hD}' fill='${esFill}'/%3E` +
        `%3Cpath d='${hD}' fill='url(%23hl)'/%3E` +
        `%3Ctext x='0' y='8' font-size='15' font-weight='900' font-family='sans-serif' fill='${etxt}' text-anchor='middle' letter-spacing='1'%3Exoxo%3C/text%3E` +
        `%3C/g%3E` +
        `%3Cg transform='translate(125, 400) rotate(-6) scale(0.9)'%3E` +
        `%3Cpath d='${hD}' fill='${epShadow}' transform='translate(4.5, 6)'/%3E` +
        `%3Cpath d='${hD}' fill='${epFill}'/%3E` +
        `%3Cpath d='${hD}' fill='url(%23hl)'/%3E` +
        `%3C/g%3E` +
        `%3Cg transform='translate(225, 115) rotate(14) scale(1.0)'%3E` +
        `%3Cpath d='${hD}' fill='${esShadow}' transform='translate(5, 6.5)'/%3E` +
        `%3Cpath d='${hD}' fill='${esFill}'/%3E` +
        `%3Cpath d='${hD}' fill='url(%23hl)'/%3E` +
        `%3C/g%3E` +
        `%3Cg transform='translate(85, 75) rotate(-14) scale(0.85)'%3E` +
        `%3Cpath d='${hD}' fill='${epShadow}' transform='translate(4, 5)'/%3E` +
        `%3Cpath d='${hD}' fill='${epFill}'/%3E` +
        `%3Cpath d='${hD}' fill='url(%23hl)'/%3E` +
        `%3C/g%3E` +
        `%3Cg transform='translate(295, 215) rotate(-8) scale(0.85)'%3E` +
        `%3Cpath d='${hD}' fill='${esShadow}' transform='translate(4, 5)'/%3E` +
        `%3Cpath d='${hD}' fill='${esFill}'/%3E` +
        `%3Cpath d='${hD}' fill='url(%23hl)'/%3E` +
        `%3C/g%3E` +
        `%3C/svg%3E`;

    return `url("data:image/svg+xml,${svg}")`;
}

const WALLPAPER_PATTERNS = {
    'default': {
        name: 'Default Clean',
        bgImage: 'radial-gradient(rgba(100, 116, 139, 0.22) 1.2px, transparent 1.2px)',
        bgSize: '18px 18px',
        bgRepeat: 'repeat'
    },
    'sweetheart': {
        name: 'Sweetheart',
        get bgImage() {
            return getSweetheartSvgDataUrl();
        },
        bgSize: 'min(70vw, 280px) min(70vw, 280px)',
        bgRepeat: 'no-repeat',
        bgPosition: 'center center'
    },
    'flirt': {
        name: 'Flirt',
        get bgImage() {
            return getFlirtSvgDataUrl();
        },
        bgSize: 'cover',
        bgRepeat: 'no-repeat',
        bgPosition: 'center center'
    },
    'thinking-of-you': {
        name: 'Thinking of you',
        bgImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'%3E%3Cpath d='M22 20 C17 12, 6 14, 6 24 C6 34, 22 46, 22 46 C22 46, 38 34, 38 24 C38 14, 27 12, 22 20 Z' fill='rgba(99,102,241,0.26)'/%3E%3Cpath d='M48 38 C44 32, 35 33, 35 40 C35 47, 48 56, 48 56 C48 56, 61 47, 61 40 C61 33, 52 32, 48 38 Z' fill='rgba(168,85,247,0.22)'/%3E%3Cg transform='translate(46, 14)'%3E%3Ccircle cx='0' cy='0' r='2' fill='rgba(140,140,170,0.35)'/%3E%3Ccircle cx='0' cy='-5' r='2.2' fill='none' stroke='rgba(140,140,170,0.35)' stroke-width='1'/%3E%3Ccircle cx='5' cy='0' r='2.2' fill='none' stroke='rgba(140,140,170,0.35)' stroke-width='1'/%3E%3Ccircle cx='0' cy='5' r='2.2' fill='none' stroke='rgba(140,140,170,0.35)' stroke-width='1'/%3E%3Ccircle cx='-5' cy='0' r='2.2' fill='none' stroke='rgba(140,140,170,0.35)' stroke-width='1'/%3E%3C/g%3E%3Cg transform='translate(12, 48)'%3E%3Ccircle cx='0' cy='0' r='1.8' fill='rgba(140,140,170,0.3)'/%3E%3Ccircle cx='0' cy='-4.5' r='2' fill='none' stroke='rgba(140,140,170,0.3)' stroke-width='1'/%3E%3Ccircle cx='4.5' cy='0' r='2' fill='none' stroke='rgba(140,140,170,0.3)' stroke-width='1'/%3E%3Ccircle cx='0' cy='4.5' r='2' fill='none' stroke='rgba(140,140,170,0.3)' stroke-width='1'/%3E%3Ccircle cx='-4.5' cy='0' r='2' fill='none' stroke='rgba(140,140,170,0.3)' stroke-width='1'/%3E%3C/g%3E%3Cpath d='M26 44 Q 34 40, 40 48 T 52 44' fill='none' stroke='rgba(140,140,170,0.25)' stroke-width='1.2' stroke-linecap='round'/%3E%3Cpath d='M10 26 Q 16 18, 26 12' fill='none' stroke='rgba(140,140,170,0.22)' stroke-width='1' stroke-dasharray='2,2'/%3E%3Ccircle cx='28' cy='12' r='1.2' fill='rgba(168,85,247,0.3)'/%3E%3C/svg%3E")`,
        bgSize: '64px 64px',
        bgRepeat: 'repeat'
    }
};

function applyTheme(themeChoice) {
    if (!themeChoice || themeChoice === 'light') {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('chitchat_theme', 'light');
    } else {
        document.body.setAttribute('data-theme', themeChoice);
        localStorage.setItem('chitchat_theme', themeChoice);
    }
}

const savedGlobalWallpaper = localStorage.getItem('chitchat_global_wallpaper');
if (savedGlobalWallpaper) {
    applyChatWallpaper(savedGlobalWallpaper);
}

try { history.replaceState({screen: 'exit'}, '', '#exit'); } catch(e){}
const savedUser = localStorage.getItem('chitchat_user');
if (savedUser) {
    try {
        currentUser = JSON.parse(savedUser);
        if (usernameInput) usernameInput.value = currentUser.name || '';
        syncUserAvatarUI();
        const setUsername = document.getElementById('settings-username');
        if (setUsername) setUsername.value = currentUser.name || '';
        const setAbout = document.getElementById('settings-about');
        if (setAbout) setAbout.value = currentUser.about || '';
        const setBubbleColor = document.getElementById('settings-bubble-color');
        if (setBubbleColor) setBubbleColor.value = currentUser.color || '#dcf8c6';
    } catch(e) {
        console.error('Error loading saved user', e);
    }
}

// Starting Page Setup Logic
const btnRandomAvatar = document.getElementById('btn-random-avatar');
if (btnRandomAvatar) {
    btnRandomAvatar.onclick = () => {
        hapticFeedback('medium');
        const randomSeed = Math.random().toString(36).substring(2, 8);
        const styles = ['bottts', 'adventurer', 'lorelei', 'fun-emoji', 'personas', 'avataaars'];
        const randomStyle = styles[Math.floor(Math.random() * styles.length)];
        const newUrl = `https://api.dicebear.com/7.x/${randomStyle}/svg?seed=${randomSeed}`;
        currentUser.avatar = newUrl;
        syncUserAvatarUI();
    };
}

// Upload Photo Triggers
const btnTriggerUpload = document.getElementById('btn-trigger-upload');
const btnUploadAvatarText = document.getElementById('btn-upload-avatar-text');
const avatarPreviewContainer = document.getElementById('avatar-preview-container');

if (btnTriggerUpload) btnTriggerUpload.onclick = (e) => { e.stopPropagation(); if (profilePicUpload) profilePicUpload.click(); };
if (btnUploadAvatarText) btnUploadAvatarText.onclick = () => { if (profilePicUpload) profilePicUpload.click(); };
if (avatarPreviewContainer) avatarPreviewContainer.onclick = () => { if (profilePicUpload) profilePicUpload.click(); };

// Real-time Theme Selector Pills
document.querySelectorAll('.login-theme-pills .theme-pill').forEach(pill => {
    pill.onclick = () => {
        hapticFeedback('light');
        const themeChoice = pill.dataset.themeChoice;
        applyTheme(themeChoice);
    };
});

// Hide Splash/Loading screen & initialize starting route
function initAppView() {
    const lScreen = document.getElementById('loading-screen');
    if (lScreen) lScreen.classList.add('hidden');
    
    const savedUserStr = localStorage.getItem('chitchat_user');
    let hasName = false;
    if (currentUser && currentUser.name && currentUser.name.trim()) {
        hasName = true;
    } else if (savedUserStr) {
        try {
            const parsed = JSON.parse(savedUserStr);
            if (parsed && parsed.name && parsed.name.trim()) {
                currentUser = parsed;
                hasName = true;
            }
        } catch(e){}
    }
    
    if (hasName) {
        if (loginScreen) loginScreen.classList.add('hidden');
        if (roomListScreen) roomListScreen.classList.remove('hidden');
        renderRoomList();
        try { history.replaceState({screen: 'lobby'}, '', '#lobby'); } catch(e){}
    } else {
        if (loginScreen) loginScreen.classList.remove('hidden');
        if (roomListScreen) roomListScreen.classList.add('hidden');
        try { history.replaceState({screen: 'login'}, '', '#login'); } catch(e){}
    }
}

initAppView();
setTimeout(initAppView, 100);
setTimeout(initAppView, 500);
document.addEventListener('DOMContentLoaded', initAppView);

if (profilePicUpload) {
    profilePicUpload.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => { 
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const size = 180;
                    canvas.width = size;
                    canvas.height = size;
                    
                    let minDim = Math.min(img.width, img.height);
                    let sx = (img.width - minDim) / 2;
                    let sy = (img.height - minDim) / 2;
                    ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
                    
                    currentUser.avatar = canvas.toDataURL('image/jpeg', 0.8);
                    syncUserAvatarUI();
                    document.querySelectorAll('.preset-avatar-item').forEach(el => el.classList.remove('active'));
                    saveUserLocally(); 
                    if (socket) socket.emit('update profile', currentUser);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(this.files[0]);
        }
    });
}

const loginBtn = document.getElementById('login-btn');
if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        hapticFeedback('light'); 
        if (usernameInput) currentUser.name = usernameInput.value.trim();
        if (!currentUser.name) {
            if (usernameInput) {
                usernameInput.focus();
                usernameInput.style.borderColor = '#ef4444';
                setTimeout(() => { usernameInput.style.borderColor = ''; }, 1500);
            }
            return;
        }
        if (!currentUser.avatar) { 
            currentUser.avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.name)}`; 
            const setAvatarPrev = document.getElementById('settings-avatar-preview');
            if (setAvatarPrev) setAvatarPrev.src = currentUser.avatar; 
        }
        const setUsername = document.getElementById('settings-username');
        if (setUsername) setUsername.value = currentUser.name;
        if (loginScreen) loginScreen.classList.add('hidden'); 
        if (roomListScreen) roomListScreen.classList.remove('hidden');
        renderRoomList();
        saveUserLocally(); 
        try { history.replaceState({screen: 'lobby'}, '', '#lobby'); } catch(e){}
        if (socket) socket.emit('update profile', currentUser);
    });
}

const settingsBtn = document.getElementById('settings-btn');
if (settingsBtn) {
    settingsBtn.onclick = () => { 
        hapticFeedback('light'); 
        updateSettingsModalUI();
        if (roomListScreen) roomListScreen.classList.add('hidden');
        if (chatScreen) chatScreen.classList.add('hidden');
        if (profileScreen) profileScreen.classList.add('hidden');
        if (settingsScreen) settingsScreen.classList.remove('hidden'); 
        try { history.pushState({ screen: 'settings' }, '', '#settings'); } catch(e){}
    };
}

function updateSettingsModalUI() {
    const cardAvatar = document.getElementById('settings-card-avatar');
    const cardName = document.getElementById('settings-card-name');
    const cardAbout = document.getElementById('settings-card-about');
    
    if (cardAvatar) cardAvatar.src = currentUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser.name || 'Guest'}`;
    if (cardName) cardName.textContent = currentUser.name || 'Guest User';
    if (cardAbout) cardAbout.textContent = currentUser.about || 'Hey there! I am using Chit Chat.';

    // Calculate Storage Usage
    const usageText = document.getElementById('storage-usage-text');
    if (usageText) {
        let total = 0;
        for (let x in localStorage) {
            if (localStorage.hasOwnProperty(x)) {
                total += ((localStorage[x].length + x.length) * 2);
            }
        }
        let formatted = (total / 1024).toFixed(1) + ' KB';
        if (total > 1024 * 1024) formatted = (total / (1024 * 1024)).toFixed(2) + ' MB';
        usageText.textContent = `Calculated usage: ${formatted}`;
    }

    // Active Theme highlight
    const currentTheme = document.body.getAttribute('data-theme') || 'light';
    document.querySelectorAll('.theme-card-btn').forEach(btn => {
        if (btn.dataset.themeVal === currentTheme) btn.classList.add('active');
        else btn.classList.remove('active');
    });
}

// Restore saved theme on initial load
const savedThemeSetting = localStorage.getItem('chitchat_theme');
if (savedThemeSetting && savedThemeSetting !== 'light') {
    document.body.setAttribute('data-theme', savedThemeSetting);
}

// Close Settings page
const closeSettingsPageBtn = document.getElementById('close-settings-page-btn');
if (closeSettingsPageBtn) {
    closeSettingsPageBtn.onclick = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        hapticFeedback('light');
        settingsScreen.classList.add('hidden');
        roomListScreen.classList.remove('hidden');
        history.pushState({ screen: 'lobby' }, '', '#lobby');
    };
}

// Theme selector grid logic
document.querySelectorAll('.theme-card-btn').forEach(btn => {
    btn.onclick = () => {
        hapticFeedback('medium');
        const selectedTheme = btn.dataset.themeVal;
        if (selectedTheme === 'light') {
            document.body.removeAttribute('data-theme');
        } else {
            document.body.setAttribute('data-theme', selectedTheme);
        }
        localStorage.setItem('chitchat_theme', selectedTheme);
        playUiSound('pop');
        updateSettingsModalUI();
    };
});

// Clear Cache Button
const clearCacheBtn = document.getElementById('btn-clear-cache');
if (clearCacheBtn) {
    clearCacheBtn.onclick = () => {
        hapticFeedback('heavy');
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith('wallpaper_') || k.startsWith('chat_draft_'))) {
                keysToRemove.push(k);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        showToast('✨ Cache & temporary wallpapers cleared!');
        updateSettingsModalUI();
    };
}

// Sync and Update Profile UI
function updateProfileScreenUI() {
    syncUserAvatarUI();
    const usernameInput = document.getElementById('settings-username');
    const aboutInput = document.getElementById('settings-about');
    const colorInput = document.getElementById('settings-bubble-color');
    const hexLabel = document.getElementById('bubble-color-hex');
    const nameCharCount = document.getElementById('name-char-count');
    const aboutCharCount = document.getElementById('about-char-count');
    const liveBubble = document.getElementById('profile-live-bubble-preview');
    const liveName = document.getElementById('profile-live-preview-name');

    if (usernameInput) {
        usernameInput.value = currentUser.name || '';
        if (nameCharCount) nameCharCount.textContent = `${usernameInput.value.length}/20`;
        if (liveName) liveName.textContent = currentUser.name || 'User';
    }
    if (aboutInput) {
        aboutInput.value = currentUser.about || '';
        if (aboutCharCount) aboutCharCount.textContent = `${aboutInput.value.length}/60`;
    }
    if (colorInput) {
        colorInput.value = currentUser.color || '#dcf8c6';
        if (hexLabel) hexLabel.textContent = colorInput.value;
        if (liveBubble) liveBubble.style.backgroundColor = colorInput.value;
    }

    // Highlight active preset avatar if matches
    document.querySelectorAll('.avatar-preset-item').forEach(img => {
        if (img.src === currentUser.avatar) {
            img.classList.add('active');
        } else {
            img.classList.remove('active');
        }
    });

    // Highlight active color swatch
    document.querySelectorAll('.color-swatch-btn').forEach(btn => {
        if (btn.dataset.color.toLowerCase() === (currentUser.color || '#dcf8c6').toLowerCase()) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Attach inputs & quick action listeners for profile screen
const profileRandomBtn = document.getElementById('profile-btn-random-avatar');
if (profileRandomBtn) {
    profileRandomBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        hapticFeedback('medium');
        const randomSeed = Math.random().toString(36).substring(2, 8);
        const styles = ['bottts', 'adventurer', 'lorelei', 'fun-emoji', 'personas', 'spark'];
        const randomStyle = styles[Math.floor(Math.random() * styles.length)];
        const newUrl = `https://api.dicebear.com/7.x/${randomStyle}/svg?seed=${randomSeed}`;
        currentUser.avatar = newUrl;
        
        syncUserAvatarUI();
        document.querySelectorAll('.avatar-preset-item').forEach(el => el.classList.remove('active'));
        saveUserLocally();
        if (socket) socket.emit('update profile', currentUser);
        showToast('🎲 Random avatar generated!');
    };
}

const profileUploadBtn = document.getElementById('profile-btn-upload-avatar');
if (profileUploadBtn) {
    profileUploadBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('profile-pic-upload').click();
    };
}

// Quick status chips listener
document.querySelectorAll('.status-chip-btn').forEach(chip => {
    chip.onclick = (e) => {
        e.preventDefault();
        hapticFeedback('light');
        const statusText = chip.dataset.status;
        const aboutInput = document.getElementById('settings-about');
        const aboutCharCount = document.getElementById('about-char-count');
        if (aboutInput) {
            aboutInput.value = statusText;
            if (aboutCharCount) aboutCharCount.textContent = `${statusText.length}/60`;
        }
    };
});

// Color Swatches listener
document.querySelectorAll('.color-swatch-btn').forEach(swatch => {
    swatch.onclick = (e) => {
        e.preventDefault();
        hapticFeedback('light');
        const chosenColor = swatch.dataset.color;
        const colorInput = document.getElementById('settings-bubble-color');
        const hexLabel = document.getElementById('bubble-color-hex');
        const liveBubble = document.getElementById('profile-live-bubble-preview');

        if (colorInput) colorInput.value = chosenColor;
        if (hexLabel) hexLabel.textContent = chosenColor;
        if (liveBubble) liveBubble.style.backgroundColor = chosenColor;

        document.querySelectorAll('.color-swatch-btn').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
    };
});

// Username real-time preview sync
const settingsUsernameInput = document.getElementById('settings-username');
if (settingsUsernameInput) {
    settingsUsernameInput.addEventListener('input', (e) => {
        const val = e.target.value;
        const nameCharCount = document.getElementById('name-char-count');
        const liveName = document.getElementById('profile-live-preview-name');
        if (nameCharCount) nameCharCount.textContent = `${val.length}/20`;
        if (liveName) liveName.textContent = val.trim() || 'User';
    });
}

// About status real-time counter sync
const settingsAboutInput = document.getElementById('settings-about');
if (settingsAboutInput) {
    settingsAboutInput.addEventListener('input', (e) => {
        const val = e.target.value;
        const aboutCharCount = document.getElementById('about-char-count');
        if (aboutCharCount) aboutCharCount.textContent = `${val.length}/60`;
    });
}

// Bubble color hex & live preview sync
const bubbleColorInput = document.getElementById('settings-bubble-color');
const bubbleHexLabel = document.getElementById('bubble-color-hex');
if (bubbleColorInput && bubbleHexLabel) {
    bubbleColorInput.value = currentUser.color || '#dcf8c6';
    bubbleHexLabel.textContent = bubbleColorInput.value;
    bubbleColorInput.addEventListener('input', (e) => {
        const chosenVal = e.target.value;
        bubbleHexLabel.textContent = chosenVal;
        const liveBubble = document.getElementById('profile-live-bubble-preview');
        if (liveBubble) liveBubble.style.backgroundColor = chosenVal;

        // Deselect swatches if custom color doesn't match any swatch
        document.querySelectorAll('.color-swatch-btn').forEach(s => {
            if (s.dataset.color.toLowerCase() === chosenVal.toLowerCase()) {
                s.classList.add('active');
            } else {
                s.classList.remove('active');
            }
        });
    });
}

// Avatar Presets selection
const avatarPresetsRow = document.getElementById('avatar-presets-row');
if (avatarPresetsRow) {
    avatarPresetsRow.addEventListener('click', (e) => {
        const item = e.target.closest('.avatar-preset-item');
        if (item) {
            hapticFeedback('light');
            avatarPresetsRow.querySelectorAll('.avatar-preset-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            currentUser.avatar = item.src;
            const avatarPreview = document.getElementById('settings-avatar-preview');
            if (avatarPreview) avatarPreview.src = item.src;
            const mainAvatarPreview = document.getElementById('avatar-preview');
            if (mainAvatarPreview) mainAvatarPreview.src = item.src;
            const lobbyAvatar = document.getElementById('lobby-user-avatar');
            if (lobbyAvatar) lobbyAvatar.src = item.src;
            saveUserLocally();
        }
    });
}

const btnOpenProfile = document.getElementById('btn-open-profile');
if (btnOpenProfile) {
    btnOpenProfile.onclick = () => {
        hapticFeedback('light');
        updateProfileScreenUI();
        if (settingsScreen) settingsScreen.classList.add('hidden');
        if (roomListScreen) roomListScreen.classList.add('hidden'); 
        if (profileScreen) profileScreen.classList.remove('hidden'); 
        try { history.pushState({screen: 'profile'}, '', '#profile'); } catch(e){}
    };
}

const lobbyProfileBtn = document.getElementById('lobby-profile-btn');
if (lobbyProfileBtn) {
    lobbyProfileBtn.onclick = () => {
        hapticFeedback('light');
        updateProfileScreenUI();
        if (roomListScreen) roomListScreen.classList.add('hidden');
        if (settingsScreen) settingsScreen.classList.add('hidden');
        if (chatScreen) chatScreen.classList.add('hidden');
        if (profileScreen) profileScreen.classList.remove('hidden');
        try { history.pushState({screen: 'profile'}, '', '#profile'); } catch(e){}
    };
}

const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
    btnLogout.onclick = () => { if(confirm("Are you sure you want to completely reset the app and log out? 😿")) { localStorage.clear(); window.location.reload(); } };
}

const closeProfileBtn = document.getElementById('close-profile-btn');
if (closeProfileBtn) {
    closeProfileBtn.onclick = (e) => { 
        e.preventDefault(); 
        hapticFeedback('light'); 
        if (profileScreen) profileScreen.classList.add('hidden'); 
        if (settingsScreen) settingsScreen.classList.remove('hidden'); 
        updateSettingsModalUI();
        try { history.pushState({screen: 'settings'}, '', '#settings'); } catch(e){}
    };
}

const backBtn = document.getElementById('back-btn');
if (backBtn) {
    backBtn.onclick = (e) => { 
        e.preventDefault(); e.stopPropagation(); hapticFeedback('light'); 
        if (chatScreen) chatScreen.classList.add('hidden'); 
        if (roomListScreen) roomListScreen.classList.remove('hidden'); 
        if (socket) socket.emit('leave room'); 
        activeRoomId = null; isGhostMode = false; 
        if (ghostBtn) ghostBtn.classList.remove('active'); 
        currentlyTyping.clear();
        try { history.pushState({screen: 'lobby'}, '', '#lobby'); } catch(e){}
    };
}

window.addEventListener('popstate', (e) => {
    const state = e.state ? e.state.screen : '';
    if (state === 'settings') {
        if (chatScreen) chatScreen.classList.add('hidden');
        if (profileScreen) profileScreen.classList.add('hidden');
        if (roomListScreen) roomListScreen.classList.add('hidden');
        if (settingsScreen) settingsScreen.classList.remove('hidden');
        updateSettingsModalUI();
    } else if (state === 'profile') {
        if (settingsScreen) settingsScreen.classList.add('hidden');
        if (roomListScreen) roomListScreen.classList.add('hidden');
        if (chatScreen) chatScreen.classList.add('hidden');
        if (profileScreen) profileScreen.classList.remove('hidden');
        updateProfileScreenUI();
    } else if (state === 'lobby') {
        if (activeRoomId) {
            if (chatScreen) chatScreen.classList.add('hidden'); 
            if (roomListScreen) roomListScreen.classList.remove('hidden');
            if (socket) socket.emit('leave room'); activeRoomId = null; isGhostMode = false; 
            if (ghostBtn) ghostBtn.classList.remove('active'); currentlyTyping.clear();
        }
        if (profileScreen) profileScreen.classList.add('hidden');
        if (settingsScreen) settingsScreen.classList.add('hidden');
        if (roomListScreen) roomListScreen.classList.remove('hidden');
    } else if (state === 'exit') {
        if (roomListScreen && !roomListScreen.classList.contains('hidden')) { if (confirm("Are you sure you want to exit Chit Chat? 😿")) history.back(); else try { history.pushState({screen: 'lobby'}, '', '#lobby'); } catch(e){} 
        } else { history.back(); }
    }
});

const saveProfileBtn = document.getElementById('save-profile-btn');
if (saveProfileBtn) {
    saveProfileBtn.onclick = () => {
        hapticFeedback('medium');
        const setUsername = document.getElementById('settings-username');
        const setAbout = document.getElementById('settings-about');
        const setBubbleColor = document.getElementById('settings-bubble-color');
        if(setUsername && setUsername.value.trim()) currentUser.name = setUsername.value.trim();
        if(setAbout && setAbout.value.trim()) currentUser.about = setAbout.value.trim();
        if (setBubbleColor) currentUser.color = setBubbleColor.value; 
        syncUserAvatarUI();
        if (socket) socket.emit('update profile', currentUser);
        saveUserLocally(); 
        showToast('✨ Profile updated successfully!');
        if (profileScreen) profileScreen.classList.add('hidden'); 
        if (settingsScreen) settingsScreen.classList.remove('hidden');
        updateSettingsModalUI();
        try { history.pushState({screen: 'settings'}, '', '#settings'); } catch(e){}
    };
}

let currentCategoryFilter = 'all';

function renderRoomList() {
    const listEl = document.getElementById('rooms-ul') || roomsUl;
    if (!listEl) return;
    listEl.innerHTML = '';
    
    // Update lobby header user avatar
    const lobbyAvatar = document.getElementById('lobby-user-avatar');
    if (lobbyAvatar && currentUser && currentUser.avatar) {
        lobbyAvatar.src = currentUser.avatar;
    }

    const listToRender = (globalRoomList && globalRoomList.length > 0) ? globalRoomList : defaultRooms;
    
    const emptyState = document.getElementById('empty-rooms-state');
    if (!listToRender || listToRender.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
    } else {
        if (emptyState) emptyState.classList.add('hidden');
        
        listToRender.forEach(room => {
            const li = document.createElement('li'); 
            li.className = 'room-card-item';
            
            const roomNameLower = (room.name || '').toLowerCase();
            const isAI = roomNameLower.includes('ai') || roomNameLower.includes('bot') || roomNameLower.includes('lounge');
            const logoUrl = room.logo || `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(room.id || 'room')}`;
            const unreadCount = unreadCounts[room.id] || 0;
            const badgeHTML = unreadCount > 0 ? `<span class="unread-badge-pill">${unreadCount}</span>` : '';

            let subtitleText = '';
            if (isAI) {
                subtitleText = `24/7 Smart Companion • Ask anything`;
            } else if (room.isPrivate) {
                subtitleText = `Passcode protected room`;
            } else {
                subtitleText = `Public group • Tap to join chat`;
            }

            li.innerHTML = `
                <div class="room-avatar-box ${isAI ? 'ai-glow' : ''}">
                    <img src="${logoUrl}" alt="Room Avatar" class="room-avatar-img">
                    <span class="room-status-dot ${room.isPrivate ? 'private-dot' : 'online-dot'}"></span>
                </div>
                <div class="room-card-info">
                    <div class="room-card-top-row">
                        <span class="room-card-name">${escapeHTML(room.name || 'Chat Room')}</span>
                    </div>
                    <div class="room-card-sub-row">
                        <span class="room-card-subtitle">${subtitleText}</span>
                    </div>
                </div>
                <div class="room-card-right">
                    ${badgeHTML}
                    <span class="room-chevron">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </span>
                </div>
            `;
            
            li.onclick = () => joinRoomPrompt(room);
            listEl.appendChild(li);
        });
    }
}

if (socket) {
    socket.on('room list', (rooms) => { 
        globalRoomList = (rooms && rooms.length > 0) ? rooms : defaultRooms; 
        renderRoomList(); 
    });
    socket.on('global room alert', (alertData) => { 
        const roomId = (typeof alertData === 'object' && alertData.roomId) ? alertData.roomId : alertData;
        if (activeRoomId !== roomId) { 
            unreadCounts[roomId] = (unreadCounts[roomId] || 0) + 1; 
            renderRoomList(); 

            if (typeof alertData === 'object' && alertData.sender && alertData.sender !== currentUser.name) {
                playUiSound('receive');
                hapticFeedback('medium');
                showInAppNotificationBanner(alertData);
                triggerSystemNotification(alertData.sender, alertData.roomName, alertData.text, alertData.avatar, alertData.roomId);
            }
        } 
    });
}

const showCreateRoomBtn = document.getElementById('show-create-room-btn');
if (showCreateRoomBtn) showCreateRoomBtn.onclick = () => { hapticFeedback('light'); if (createRoomModal) createRoomModal.classList.remove('hidden'); };

const newRoomPrivate = document.getElementById('new-room-private');
if (newRoomPrivate) {
    newRoomPrivate.onchange = (e) => {
        const passContainer = document.getElementById('password-input-container');
        if (passContainer) passContainer.classList.toggle('hidden', !e.target.checked);
    };
}

const createRoomSubmit = document.getElementById('create-room-submit');
if (createRoomSubmit) {
    createRoomSubmit.onclick = () => {
        const nameInp = document.getElementById('new-room-name');
        const privInp = document.getElementById('new-room-private');
        const passInp = document.getElementById('new-room-pass');
        const name = nameInp ? nameInp.value : '';
        const isPrivate = privInp ? privInp.checked : false;
        const password = passInp ? passInp.value : '';
        if(name) { 
            if (socket) socket.emit('create room', { name, isPrivate, password }); 
            if (createRoomModal) createRoomModal.classList.add('hidden'); 
        }
    };
}

let pendingJoinRoom = null;
function joinRoomPrompt(room) {
    hapticFeedback('light'); 
    if(room.isPrivate) { 
        pendingJoinRoom = room; 
        const joinPass = document.getElementById('join-room-pass');
        if (joinPass) joinPass.value = ''; 
        if (passwordModal) passwordModal.classList.remove('hidden');
    } else { currentRoomPassword = ''; joinRoom(room.id, '', false); }
}

const joinRoomSubmit = document.getElementById('join-room-submit');
if (joinRoomSubmit) {
    joinRoomSubmit.onclick = () => { 
        const joinPass = document.getElementById('join-room-pass');
        currentRoomPassword = joinPass ? joinPass.value : ''; 
        if (pendingJoinRoom) joinRoom(pendingJoinRoom.id, currentRoomPassword, false); 
        if (passwordModal) passwordModal.classList.add('hidden'); 
    };
}

function joinRoom(roomId, password, isReconnect) { socket.emit('join room', { roomId, password, user: currentUser, isReconnect }); }

socket.on('connect', () => { 
    loadingScreen.classList.add('hidden');
    if (currentUser.name) { socket.emit('update profile', currentUser); loginScreen.classList.add('hidden'); roomListScreen.classList.remove('hidden'); }
    if (currentUser.name && activeRoomId) joinRoom(activeRoomId, currentRoomPassword, true); 
});

socket.on('join error', (msg) => alert(msg));
socket.on('chat history', (data) => {
    if (activeRoomId !== data.room.id) {
        history.pushState({screen: 'chat', roomId: data.room.id}, '', '#chat');
    }
    roomListScreen.classList.add('hidden'); chatScreen.classList.remove('hidden');
    
    const isRoomSwitch = activeRoomId !== data.room.id;
    if (isRoomSwitch) {
        currentlyTyping.clear();
        updateHeaderSubtitle();
    }
    activeRoomId = data.room.id; 
    unreadCounts[activeRoomId] = 0; 
    renderRoomList();
    
    setSendBtnState(activeRoomId === 'ai_lounge' ? 'send' : 'mic');
    
    updateGroupHeader(data.room);
    const savedWallpaper = (activeRoomId && localStorage.getItem('wallpaper_' + activeRoomId)) || localStorage.getItem('chitchat_global_wallpaper');
    applyChatWallpaper(savedWallpaper);

    if (isRoomSwitch || messages.querySelectorAll('li').length === 0) {
        messages.innerHTML = '';
        data.history.forEach(msg => displayMessage(msg, true));
    }
    checkEmptyMessages();
    socket.emit('mark read');
});

document.addEventListener('visibilitychange', () => { if (!document.hidden && activeRoomId) { socket.emit('mark read'); } });

// ==========================
// 🔔 NOTIFICATIONS SYSTEM
// ==========================
const togglePushNotifications = document.getElementById('toggle-push-notifications');
const btnRequestPushPermission = document.getElementById('btn-request-push-permission');
let currentPushEndpoint = localStorage.getItem('chitchat_push_endpoint') || null;

function updateNotifStatusText() {
    const statusText = document.getElementById('notif-permission-status-text');
    if (!statusText) return;

    if (!('Notification' in window)) {
        statusText.textContent = 'In-app notifications enabled (Browser Push unsupported)';
        if (btnRequestPushPermission) btnRequestPushPermission.style.display = 'none';
    } else if (Notification.permission === 'granted') {
        statusText.textContent = 'Browser & Web Push Notifications Active 🔔';
        if (btnRequestPushPermission) {
            btnRequestPushPermission.textContent = 'Test Server Push 🔔';
            btnRequestPushPermission.style.display = 'inline-block';
        }
    } else if (Notification.permission === 'denied') {
        statusText.textContent = 'Notifications blocked in browser settings';
        if (btnRequestPushPermission) {
            btnRequestPushPermission.textContent = 'Blocked in Browser Settings ⚠️';
            btnRequestPushPermission.style.display = 'inline-block';
        }
    } else {
        statusText.textContent = 'Tap below to request Web Push permissions';
        if (btnRequestPushPermission) {
            btnRequestPushPermission.textContent = 'Request Notification Access 🔔';
            btnRequestPushPermission.style.display = 'inline-block';
        }
    }

    checkShowPushPromptCard();
}

function checkShowPushPromptCard() {
    const promptCard = document.getElementById('push-permission-prompt-card');
    if (!promptCard) return;

    const isDismissed = localStorage.getItem('chitchat_push_prompt_dismissed') === 'true';
    if ('Notification' in window && Notification.permission === 'default' && !isDismissed) {
        promptCard.classList.remove('hidden');
    } else {
        promptCard.classList.add('hidden');
    }
}

// Convert VAPID base64 string to Uint8Array
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function registerWebPushSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Web Push API not supported on this browser');
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        
        if (Notification.permission !== 'granted') {
            const perm = await Notification.requestPermission();
            updateNotifStatusText();
            if (perm !== 'granted') return;
        }

        const res = await fetch('/api/push/vapid-public-key');
        const { publicKey } = await res.json();
        if (!publicKey) return;

        const convertedVapidKey = urlBase64ToUint8Array(publicKey);

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });
        }

        if (subscription && subscription.endpoint) {
            currentPushEndpoint = subscription.endpoint;
            localStorage.setItem('chitchat_push_endpoint', subscription.endpoint);
        }

        await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userName: currentUser ? currentUser.name : 'Guest',
                subscription: subscription
            })
        });

        console.log('Web Push subscription registered successfully!');
        showToast('🔔 Web Push Notifications Enabled!');
        updateNotifStatusText();
    } catch (err) {
        console.error('Failed to register Web Push subscription:', err);
    }
}

if (togglePushNotifications) {
    const savedPush = localStorage.getItem('chitchat_push_notif');
    togglePushNotifications.checked = savedPush !== 'false';
    updateNotifStatusText();

    togglePushNotifications.addEventListener('change', (e) => {
        localStorage.setItem('chitchat_push_notif', e.target.checked);
        if (e.target.checked) {
            registerWebPushSubscription();
        } else {
            updateNotifStatusText();
        }
    });
}

if (btnRequestPushPermission) {
    btnRequestPushPermission.addEventListener('click', async () => {
        if ('Notification' in window && Notification.permission === 'granted') {
            if (currentPushEndpoint) {
                try {
                    const res = await fetch('/api/push/send-test', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            endpoint: currentPushEndpoint,
                            userName: currentUser ? currentUser.name : 'Guest'
                        })
                    });
                    const resData = await res.json();
                    if (resData.success) {
                        showToast('🔔 Web Push sent to server! Watch for notification.');
                    } else {
                        showToast('⚠️ Test push: ' + (resData.error || 'Re-subscribing...'));
                        registerWebPushSubscription();
                    }
                } catch (e) {
                    showToast('⚠️ Error testing push notification');
                }
            } else {
                triggerSystemNotification('ChitChat Test', 'Lobby', 'Test Web Push Notification working! 🎉', currentUser ? currentUser.avatar : null, 'lobby');
                registerWebPushSubscription();
            }
        } else {
            registerWebPushSubscription();
        }
    });
}

// Visual Push Prompt Card Actions
const btnEnablePushPrompt = document.getElementById('btn-enable-push-prompt');
const btnDismissPushPrompt = document.getElementById('btn-dismiss-push-prompt');

if (btnEnablePushPrompt) {
    btnEnablePushPrompt.addEventListener('click', () => {
        registerWebPushSubscription();
        const promptCard = document.getElementById('push-permission-prompt-card');
        if (promptCard) promptCard.classList.add('hidden');
    });
}

if (btnDismissPushPrompt) {
    btnDismissPushPrompt.addEventListener('click', () => {
        localStorage.setItem('chitchat_push_prompt_dismissed', 'true');
        const promptCard = document.getElementById('push-permission-prompt-card');
        if (promptCard) promptCard.classList.add('hidden');
    });
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(() => {
            updateNotifStatusText();
            registerWebPushSubscription();
        });
    } else if (Notification.permission === 'granted') {
        registerWebPushSubscription();
    }
}

function openRoomById(roomId) {
    if (!roomId) return;
    const room = globalRoomList.find(r => r.id === roomId);
    if (room) {
        joinRoomPrompt(room);
    } else {
        joinRoom(roomId, '', false);
    }
}

function triggerSystemNotification(sender, roomName, text, avatar, roomId) {
    const isPushEnabled = togglePushNotifications ? togglePushNotifications.checked : true;
    if (!isPushEnabled) return;

    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            const title = `${sender}${roomName ? ' in ' + roomName : ''}`;
            const notif = new Notification(title, {
                body: text || 'Sent a message',
                icon: avatar || '/icon.svg',
                tag: 'chitchat-msg-' + roomId,
                renotify: true
            });
            notif.onclick = function() {
                window.focus();
                if (roomId) openRoomById(roomId);
                notif.close();
            };
        } catch (e) {
            console.error('System notification error:', e);
        }
    } else if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications) {
        Capacitor.Plugins.LocalNotifications.schedule({
            notifications: [{
                title: `${sender} in ${roomName || 'Chat'}`,
                body: text || "Sent a message",
                id: Math.floor(Math.random() * 100000),
                schedule: { at: new Date(Date.now() + 100) }
            }]
        });
    }
}

let notifBannerTimer = null;
function showInAppNotificationBanner(alertData) {
    const banner = document.getElementById('in-app-notification-banner');
    if (!banner) return;

    const avatarImg = document.getElementById('notif-banner-avatar');
    const senderEl = document.getElementById('notif-banner-sender');
    const roomEl = document.getElementById('notif-banner-room');
    const textEl = document.getElementById('notif-banner-text');

    if (avatarImg) avatarImg.src = alertData.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=Guest';
    if (senderEl) senderEl.textContent = alertData.sender || 'Friend';
    if (roomEl) roomEl.textContent = alertData.roomName || alertData.roomId || 'Room';
    if (textEl) textEl.textContent = alertData.text || 'Sent a message';

    banner.onclick = (e) => {
        if (e.target.closest('#notif-banner-close')) {
            e.stopPropagation();
            banner.classList.add('hidden');
            return;
        }
        banner.classList.add('hidden');
        if (alertData.roomId) openRoomById(alertData.roomId);
    };

    banner.classList.remove('hidden');

    if (notifBannerTimer) clearTimeout(notifBannerTimer);
    notifBannerTimer = setTimeout(() => {
        banner.classList.add('hidden');
    }, 4500);
}

// ==========================
// 🔔 WEB AUDIO SYNTH & SOUNDS
// ==========================
let audioCtx = null;
const toggleSoundEffects = document.getElementById('toggle-sound-effects');

if (toggleSoundEffects) {
    const savedSound = localStorage.getItem('chitchat_sound');
    toggleSoundEffects.checked = savedSound !== 'false';
    toggleSoundEffects.addEventListener('change', (e) => {
        localStorage.setItem('chitchat_sound', e.target.checked);
    });
}

function playUiSound(type = 'send') {
    if (toggleSoundEffects && !toggleSoundEffects.checked) return;
    try {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) audioCtx = new AudioContext();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        if (!audioCtx) return;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;
        if (type === 'send') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'receive') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(750, now);
            osc.frequency.setValueAtTime(1020, now + 0.08);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
            osc.start(now);
            osc.stop(now + 0.18);
        } else if (type === 'pop') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.06);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
            osc.start(now);
            osc.stop(now + 0.06);
        }
    } catch (e) {
        // audio fail safe
    }
}

function checkEmptyMessages() {
    const messageItems = messages.querySelectorAll('li:not(.system-message)');
    let emptyEl = messages.querySelector('.empty-chat-state');
    if (messageItems.length === 0) {
        if (!emptyEl) {
            emptyEl = document.createElement('div');
            emptyEl.className = 'empty-chat-state';
            emptyEl.innerHTML = `
                <div class="empty-icon">😸</div>
                <h4>No messages yet</h4>
                <p>Start the chat with a message or a fun poll!</p>
            `;
            messages.appendChild(emptyEl);
        }
    } else if (emptyEl) {
        emptyEl.remove();
    }
}

const floatingTypingBubble = document.getElementById('floating-typing-bubble');
const floatingTypingAvatar = document.getElementById('floating-typing-avatar');
const floatingTypingName = document.getElementById('floating-typing-name');

if (floatingTypingBubble) {
    floatingTypingBubble.addEventListener('click', () => {
        hapticFeedback('light');
        if (messages) messages.scrollTop = messages.scrollHeight;
    });
}

function updateHeaderSubtitle() {
    if (currentlyTyping.size > 0) {
        const users = Array.from(currentlyTyping.values());
        const namesList = users.map(u => u.name);
        
        let subtitleText = '';
        if (namesList.length === 1) {
            subtitleText = `${namesList[0]} is typing...`;
        } else if (namesList.length === 2) {
            subtitleText = `${namesList[0]} & ${namesList[1]} are typing...`;
        } else {
            subtitleText = `${namesList[0]} & ${namesList.length - 1} others are typing...`;
        }

        onlineUsersText.textContent = subtitleText;
        onlineUsersText.classList.add('typing-text-active');

        // Update Floating Animated Typing Bubble
        if (floatingTypingBubble && floatingTypingAvatar && floatingTypingName) {
            const firstUser = users[users.length - 1]; // most recent typing user
            floatingTypingAvatar.src = firstUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(firstUser.name)}`;
            
            const statusLabel = floatingTypingBubble.querySelector('.typing-status-label');

            if (users.length === 1) {
                floatingTypingName.textContent = firstUser.name;
                if (statusLabel) statusLabel.textContent = 'is typing';
            } else if (users.length === 2) {
                floatingTypingName.textContent = `${users[0].name} & ${users[1].name}`;
                if (statusLabel) statusLabel.textContent = 'are typing';
            } else {
                floatingTypingName.textContent = `${firstUser.name} & ${users.length - 1} others`;
                if (statusLabel) statusLabel.textContent = 'are typing';
            }

            if (floatingTypingBubble.classList.contains('hidden')) {
                floatingTypingBubble.classList.remove('hidden');
                // Scroll down if user is near bottom
                if (messages && (messages.scrollHeight - messages.scrollTop - messages.clientHeight < 120)) {
                    messages.scrollTop = messages.scrollHeight;
                }
            }
        }
    } else {
        onlineUsersText.textContent = baseOnlineText;
        onlineUsersText.classList.remove('typing-text-active');

        if (floatingTypingBubble) {
            floatingTypingBubble.classList.add('hidden');
        }
    }
}

socket.on('room users', (usersList) => {
    if (usersList.length <= 1) { baseOnlineText = "Only you are here"; } else { baseOnlineText = "Online: You, " + usersList.filter(u => u !== currentUser.name).join(', '); }
    updateHeaderSubtitle();
});

socket.on('user typing', (data) => {
    if (data.isTyping) {
        currentlyTyping.set(data.name, {
            name: data.name,
            avatar: data.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(data.name)}`
        });
    } else {
        currentlyTyping.delete(data.name);
    }
    updateHeaderSubtitle();
});

[createRoomModal, passwordModal, msgOptionsModal, viewProfileModal, groupInfoModal, createPollModal, appSettingsModal].forEach(modal => {
    if (modal) {
        modal.addEventListener('click', (e) => { if(e.target === modal) modal.classList.add('hidden'); });
    }
});

function updateGroupHeader(room) { 
    if (currentRoomName) currentRoomName.textContent = room.name; 
    if (currentRoomLogo) currentRoomLogo.src = room.logo || `https://api.dicebear.com/7.x/shapes/svg?seed=${room.id}`; 
}
if (socket) socket.on('group info updated', updateGroupHeader);

if (headerClickArea) {
    headerClickArea.onclick = () => { 
        hapticFeedback('light'); 
        if (infoRoomLogo && currentRoomLogo) infoRoomLogo.src = currentRoomLogo.src; 
        if (infoRoomName && currentRoomName) infoRoomName.value = currentRoomName.textContent; 
        if (groupInfoModal) groupInfoModal.classList.remove('hidden'); 
    };
}

const saveGroupInfoBtn = document.getElementById('save-group-info-btn');
if (saveGroupInfoBtn) {
    saveGroupInfoBtn.onclick = () => { 
        const newName = infoRoomName ? infoRoomName.value.trim() : ''; 
        if(newName) { 
            if (socket) socket.emit('update group info', { roomId: activeRoomId, name: newName }); 
            if (groupInfoModal) groupInfoModal.classList.add('hidden'); 
        } 
    };
}

if (groupPicUpload) {
    groupPicUpload.addEventListener('change', function() { 
        if (this.files && this.files[0]) { 
            const reader = new FileReader(); 
            reader.onload = (e) => { 
                if (infoRoomLogo) infoRoomLogo.src = e.target.result; 
                if (socket) socket.emit('update group info', { roomId: activeRoomId, logo: e.target.result }); 
            }; 
            reader.readAsDataURL(this.files[0]); 
        } 
    });
}

function applyChatWallpaper(wallpaperVal) {
    if (!chatScreen) return;
    
    chatScreen.style.removeProperty('background-image');
    chatScreen.style.removeProperty('background-color');
    chatScreen.style.removeProperty('background-size');
    chatScreen.style.removeProperty('background-position');
    chatScreen.style.removeProperty('background-repeat');
    chatScreen.style.removeProperty('background-attachment');
    chatScreen.classList.remove('has-custom-wallpaper');

    if (!wallpaperVal || wallpaperVal === 'default' || wallpaperVal === 'pattern:default') {
        return;
    }

    const patternKey = wallpaperVal.replace('pattern:', '');
    if (WALLPAPER_PATTERNS[patternKey]) {
        const p = WALLPAPER_PATTERNS[patternKey];
        chatScreen.classList.add('has-custom-wallpaper');
        chatScreen.style.setProperty('background-image', p.bgImage, 'important');
        chatScreen.style.setProperty('background-size', p.bgSize, 'important');
        chatScreen.style.setProperty('background-repeat', p.bgRepeat || 'repeat', 'important');
        if (p.bgPosition) {
            chatScreen.style.setProperty('background-position', p.bgPosition, 'important');
        } else {
            chatScreen.style.removeProperty('background-position');
        }
        return;
    }

    if (wallpaperVal.startsWith('#') || wallpaperVal.startsWith('rgb')) {
        chatScreen.classList.add('has-custom-wallpaper');
        chatScreen.style.setProperty('background-color', wallpaperVal, 'important');
        
        // Overlay current pattern design over custom background color
        const activeCard = document.querySelector('.wp-card.active');
        const activeWp = activeCard ? activeCard.dataset.wp : 'default';
        const pKey = activeWp ? activeWp.replace('pattern:', '') : 'default';
        if (WALLPAPER_PATTERNS[pKey]) {
            const p = WALLPAPER_PATTERNS[pKey];
            chatScreen.style.setProperty('background-image', p.bgImage, 'important');
            chatScreen.style.setProperty('background-size', p.bgSize, 'important');
            chatScreen.style.setProperty('background-repeat', p.bgRepeat || 'repeat', 'important');
            if (p.bgPosition) {
                chatScreen.style.setProperty('background-position', p.bgPosition, 'important');
            } else {
                chatScreen.style.removeProperty('background-position');
            }
        }
        return;
    }

    // Uploaded image wallpaper
    chatScreen.classList.add('has-custom-wallpaper');
    chatScreen.style.setProperty('background-image', `url("${wallpaperVal}")`, 'important');
    chatScreen.style.setProperty('background-size', 'cover', 'important');
    chatScreen.style.setProperty('background-position', 'center', 'important');
    chatScreen.style.setProperty('background-repeat', 'no-repeat', 'important');
    chatScreen.style.setProperty('background-attachment', 'fixed', 'important');
}

function setAndSaveWallpaper(wallpaperVal) {
    if (wallpaperVal) {
        localStorage.setItem('chitchat_global_wallpaper', wallpaperVal);
        if (activeRoomId) {
            localStorage.setItem('wallpaper_' + activeRoomId, wallpaperVal);
        }
    } else {
        localStorage.removeItem('chitchat_global_wallpaper');
        if (activeRoomId) {
            localStorage.removeItem('wallpaper_' + activeRoomId);
        }
    }
    applyChatWallpaper(wallpaperVal);
}

const btnChangeWallpaper = document.getElementById('btn-change-wallpaper');
if (btnChangeWallpaper) {
    btnChangeWallpaper.onclick = () => { if (wallpaperUpload) wallpaperUpload.click(); };
}

if (wallpaperUpload) {
    wallpaperUpload.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                setAndSaveWallpaper(dataUrl);
                if (groupInfoModal) groupInfoModal.classList.add('hidden');
                showToast('🖼️ Custom wallpaper uploaded!');
            };
            reader.readAsDataURL(this.files[0]);
            this.value = '';
        }
    });
}

const btnResetWallpaper = document.getElementById('btn-reset-wallpaper');
if (btnResetWallpaper) {
    btnResetWallpaper.onclick = () => {
        setAndSaveWallpaper(null);
        if (groupInfoModal) groupInfoModal.classList.add('hidden');
        showToast('Default wallpaper restored!');
    };
}

const btnOpenSearch = document.getElementById('btn-open-search');
if (btnOpenSearch) {
    btnOpenSearch.onclick = () => { 
        if (groupInfoModal) groupInfoModal.classList.add('hidden'); 
        if (chatSearchContainer) chatSearchContainer.classList.remove('hidden'); 
        if (chatSearchInput) chatSearchInput.focus(); 
    };
}

const closeSearchBtn = document.getElementById('close-search-btn');
if (closeSearchBtn) {
    closeSearchBtn.onclick = () => { 
        if (chatSearchContainer) chatSearchContainer.classList.add('hidden'); 
        if (chatSearchInput) chatSearchInput.value = ''; 
        document.querySelectorAll('#messages li').forEach(li => { 
            li.style.display = 'flex'; 
            const txtNode = li.querySelector('.message-text'); 
            if(txtNode) txtNode.innerHTML = txtNode.innerHTML.replace(/<span class="highlight">(.*?)<\/span>/g, '$1'); 
        }); 
    };
}

if (chatSearchInput) {
    chatSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('#messages li').forEach(li => {
            if(li.classList.contains('system-message')) { li.style.display = query ? 'none' : 'flex'; return; }
            const textNode = li.querySelector('.message-text');
            if(!textNode) return; 
            let rawText = textNode.textContent.replace('(edited)', '').trim();
            if (query === '') { li.style.display = 'flex'; textNode.innerHTML = escapeHTML(rawText) + (li.innerHTML.includes('(edited)') ? `<span class="edited-tag">(edited)</span>` : '');
            } else if (rawText.toLowerCase().includes(query)) { li.style.display = 'flex'; const regex = new RegExp(`(${query})`, "gi"); textNode.innerHTML = escapeHTML(rawText).replace(regex, `<span class="highlight">$1</span>`) + (li.innerHTML.includes('(edited)') ? `<span class="edited-tag">(edited)</span>` : '');
            } else { li.style.display = 'none'; }
        });
    });
}

if (ghostBtn) {
    ghostBtn.onclick = () => { hapticFeedback('medium'); isGhostMode = !isGhostMode; ghostBtn.classList.toggle('active', isGhostMode); };
}

const pollToggleMultiple = document.getElementById('poll-toggle-multiple');
const pollToggleAnonymous = document.getElementById('poll-toggle-anonymous');
const closePollModalBtn = document.getElementById('close-poll-modal-btn');

if (closePollModalBtn) {
    closePollModalBtn.onclick = () => { createPollModal.classList.add('hidden'); };
}

function updatePollOptionNumbers() {
    const rows = pollOptionsContainer.querySelectorAll('.poll-opt-row');
    const badge = document.getElementById('poll-count-badge');
    if (badge) badge.textContent = `${rows.length} / 10`;
    rows.forEach((row, i) => {
        const numSpan = row.querySelector('.poll-opt-num');
        if (numSpan) numSpan.textContent = i + 1;
        const inp = row.querySelector('.poll-opt-input');
        if (inp) inp.placeholder = `Option ${i + 1}`;
        const removeBtn = row.querySelector('.poll-opt-remove-btn');
        if (removeBtn) {
            removeBtn.style.visibility = rows.length > 2 ? 'visible' : 'hidden';
        }
    });
}

function resetPollForm() {
    pollQuestion.value = '';
    if (pollToggleMultiple) pollToggleMultiple.checked = false;
    if (pollToggleAnonymous) pollToggleAnonymous.checked = false;
    pollOptionsContainer.innerHTML = `
        <div class="poll-opt-row">
            <span class="poll-opt-num">1</span>
            <input type="text" class="premium-input poll-opt-input" placeholder="Option 1" style="margin-bottom:0;">
            <button type="button" class="poll-opt-remove-btn" title="Remove option">✕</button>
        </div>
        <div class="poll-opt-row">
            <span class="poll-opt-num">2</span>
            <input type="text" class="premium-input poll-opt-input" placeholder="Option 2" style="margin-bottom:0;">
            <button type="button" class="poll-opt-remove-btn" title="Remove option">✕</button>
        </div>
    `;
    updatePollOptionNumbers();
}

// Preset Chips Click Handler
document.querySelectorAll('.poll-preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        hapticFeedback('light');
        const q = chip.dataset.q;
        const opts = (chip.dataset.opts || '').split(',');
        if (q) pollQuestion.value = q;
        if (opts.length >= 2) {
            pollOptionsContainer.innerHTML = opts.map((optText, i) => `
                <div class="poll-opt-row">
                    <span class="poll-opt-num">${i + 1}</span>
                    <input type="text" class="premium-input poll-opt-input" value="${escapeHTML(optText.trim())}" placeholder="Option ${i + 1}" style="margin-bottom:0;">
                    <button type="button" class="poll-opt-remove-btn" title="Remove option">✕</button>
                </div>
            `).join('');
            updatePollOptionNumbers();
        }
        showToast('⚡ Preset loaded!');
    });
});

pollOptionsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('poll-opt-remove-btn')) {
        const row = e.target.closest('.poll-opt-row');
        if (row && pollOptionsContainer.querySelectorAll('.poll-opt-row').length > 2) {
            hapticFeedback('light');
            row.remove();
            updatePollOptionNumbers();
        }
    }
});

pollBtn.onclick = () => { hapticFeedback('light'); createPollModal.classList.remove('hidden'); updatePollOptionNumbers(); };

addPollOptBtn.onclick = () => {
    const currentRows = pollOptionsContainer.querySelectorAll('.poll-opt-row');
    if (currentRows.length >= 10) {
        showToast('Maximum 10 options allowed per poll!');
        return;
    }
    hapticFeedback('light');
    const newIndex = currentRows.length + 1;
    const row = document.createElement('div');
    row.className = 'poll-opt-row';
    row.innerHTML = `
        <span class="poll-opt-num">${newIndex}</span>
        <input type="text" class="premium-input poll-opt-input" placeholder="Option ${newIndex}" style="margin-bottom:0;">
        <button type="button" class="poll-opt-remove-btn" title="Remove option">✕</button>
    `;
    pollOptionsContainer.appendChild(row);
    updatePollOptionNumbers();
};

sendPollBtn.onclick = () => {
    const q = pollQuestion.value.trim();
    const opts = Array.from(document.querySelectorAll('.poll-opt-input')).map(i => i.value.trim()).filter(v => v);
    if (q && opts.length >= 2) {
        hapticFeedback('heavy');
        const isMultiple = pollToggleMultiple ? pollToggleMultiple.checked : false;
        const isAnonymous = pollToggleAnonymous ? pollToggleAnonymous.checked : false;
        const pollData = { 
            question: q, 
            options: opts.map(o => ({ text: o, votes: [] })),
            isMultiple,
            isAnonymous,
            isClosed: false
        };
        socket.emit('chat message', {
            user: currentUser.name,
            avatar: currentUser.avatar,
            color: currentUser.color,
            text: '',
            poll: pollData,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isGhost: isGhostMode,
            roomId: activeRoomId || 'lobby'
        });
        createPollModal.classList.add('hidden');
        resetPollForm();
    } else {
        showToast('Please enter a question and at least 2 options!');
    }
};

// ==========================
// ✅ INPUT + TYPING FIX
// ==========================
function setSendBtnState(state) {
    if (!sendMicBtn) return;
    sendMicBtn.dataset.state = state;
    const sendMicIcon = document.getElementById('send-mic-icon');
    if (!sendMicIcon) return;
    
    if (state === 'send') {
        sendMicIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
    } else if (state === 'check') {
        sendMicIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else {
        sendMicIcon.innerHTML = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
    }
}

if (input) {
    const handleInputChange = () => { 
        if (editingMsgId) { 
            setSendBtnState('check'); 
        } else if ((input.value && input.value.trim()) || activeRoomId === 'ai_lounge') { 
            setSendBtnState('send'); 
        } else { 
            setSendBtnState('mic'); 
        }

        if (!typingSent) {
            if (socket) socket.emit('typing', true);
            typingSent = true;
        }

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            if (socket) socket.emit('typing', false);
            typingSent = false;
        }, 1500);
    };

    input.addEventListener('input', handleInputChange);
    input.addEventListener('keyup', handleInputChange);

    const handleEnterKey = (e) => { 
        if (e.key === 'Enter' && !e.shiftKey) { 
            e.preventDefault(); 
            sendMessage(); 
        } 
    };

    input.addEventListener('keypress', handleEnterKey);
    input.addEventListener('keydown', handleEnterKey);
}

function sendMessage() {
    if (!input) return;
    const text = input.value ? input.value.trim() : '';
    if (!text && !editingMsgId && activeRoomId !== 'ai_lounge') return;



    if (socket) socket.emit('typing', false); 

    const targetRoomId = activeRoomId || 'lobby';

    if (editingMsgId) { 
        if (socket) socket.emit('edit message', { msgId: editingMsgId, newText: text, roomId: targetRoomId }); 
        editingMsgId = null;
    } else { 
        if (socket) socket.emit('chat message', { 
            user: currentUser.name || 'Guest', 
            avatar: currentUser.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.name || 'Guest')}`, 
            color: currentUser.color || '#dcf8c6', 
            text, 
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
            replyTo: replyingTo, 
            isGhost: isGhostMode,
            roomId: targetRoomId,
            senderEndpoint: currentPushEndpoint
        }); 
        playUiSound('send');
    }

    input.value = ''; 
    setSendBtnState(activeRoomId === 'ai_lounge' ? 'send' : 'mic'); 
    replyingTo = null; 
    if (replyPreviewContainer) replyPreviewContainer.classList.add('hidden');
}

// ==========================
// ✅ SAFE FILE UPLOAD CHECK
// ==========================
if (attachBtn) {
    attachBtn.onclick = () => { hapticFeedback('light'); if (imageUpload) imageUpload.click(); };
}

if (imageUpload) {
    imageUpload.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const file = this.files[0];
            const targetRoomId = activeRoomId || 'lobby';
            
            if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
                showToast('Unsupported file type!');
                return;
            }

            hapticFeedback('heavy'); const reader = new FileReader(); 
            reader.onload = (e) => {
                const fileData = e.target.result;
                if (file.type.startsWith('video/')) {
                    if (file.size > 20 * 1024 * 1024) return showToast('Video is too large! Limit is 20MB.');
                    if (socket) socket.emit('chat message', { user: currentUser.name, avatar: currentUser.avatar, color: currentUser.color, text: '', uploadedImage: fileData, isVideo: true, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isGhost: isGhostMode, roomId: targetRoomId });
                } else if (file.type === 'image/gif') {
                    if (socket) socket.emit('chat message', { user: currentUser.name, avatar: currentUser.avatar, color: currentUser.color, text: '', uploadedImage: fileData, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isGhost: isGhostMode, roomId: targetRoomId });
                } else {
                    const img = new Image(); img.src = fileData;
                    img.onload = () => {
                        const canvas = document.createElement('canvas'); let w = img.width, h = img.height;
                        if(w > 600) { h *= 600/w; w = 600; } canvas.width = w; canvas.height = h;
                        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                        if (socket) socket.emit('chat message', { user: currentUser.name, avatar: currentUser.avatar, color: currentUser.color, text: '', uploadedImage: canvas.toDataURL('image/jpeg', 0.8), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isGhost: isGhostMode, roomId: targetRoomId });
                    };
                }
                imageUpload.value = '';
            }; 
            reader.readAsDataURL(file);
        }
    });
}

let pressTimer;
messages.addEventListener('touchstart', (e) => {
    if (e.target.closest('.poll-card') || e.target.closest('.custom-audio-player') || e.target.classList.contains('chat-image') || e.target.classList.contains('chat-video') || e.target.classList.contains('avatar-small')) return;
    const li = e.target.closest('li.my-message, li.other-message'); if (!li) return;
    pressTimer = setTimeout(() => {
        hapticFeedback('medium'); selectedMsgId = li.id.replace('msg-', '');
        if (li.classList.contains('my-message') && li.querySelector('.message-text')) document.getElementById('opt-edit').classList.remove('hidden');
        else document.getElementById('opt-edit').classList.add('hidden');
        msgOptionsModal.classList.remove('hidden');
    }, 500); 
}, { passive: true });
messages.addEventListener('touchend', () => clearTimeout(pressTimer));
messages.addEventListener('touchmove', () => clearTimeout(pressTimer));

function triggerReplyForMessage(li) {
    if (!li) return;
    hapticFeedback('medium');
    selectedMsgId = li.id.replace('msg-', '');
    const sender = li.dataset.sender || 'User';
    const textNode = li.querySelector('.message-text');
    let msgText = textNode ? textNode.innerText.replace('(edited)', '').trim() : '';
    if (!msgText) {
        if (li.querySelector('.poll-question')) msgText = '📊 Poll: ' + li.querySelector('.poll-question').innerText;
        else if (li.querySelector('.chat-image')) msgText = '📷 Photo';
        else if (li.querySelector('.chat-video')) msgText = '🎥 Video';
        else if (li.querySelector('.custom-audio-player')) msgText = '🎤 Voice Note';
        else msgText = 'Attachment';
    }
    replyingTo = {
        msgId: li.id,
        user: sender,
        text: msgText
    };
    document.getElementById('reply-preview-text').innerHTML = `
        <span class="reply-preview-title">${escapeHTML(replyingTo.user)}</span>
        <span class="reply-preview-sub">${escapeHTML(replyingTo.text)}</span>
    `;
    replyPreviewContainer.classList.remove('hidden');
    input.focus();
}

let touchStartX = 0; let touchCurrentX = 0; let swipedElement = null;
messages.addEventListener('touchstart', (e) => {
    if (e.target.closest('.poll-card') || e.target.closest('.custom-audio-player') || e.target.classList.contains('chat-image') || e.target.classList.contains('chat-video')) return;
    const li = e.target.closest('li.my-message, li.other-message'); if (!li) return;
    touchStartX = e.touches[0].clientX; swipedElement = li; swipedElement.style.transition = 'none';
}, { passive: true });

messages.addEventListener('touchmove', (e) => {
    if (!swipedElement) return;
    touchCurrentX = e.touches[0].clientX; const diffX = touchCurrentX - touchStartX;
    if (diffX > 10 && diffX < 80) swipedElement.style.transform = `translateX(${diffX}px)`; 
}, { passive: true });

messages.addEventListener('touchend', () => {
    if (!swipedElement) return;
    const diffX = touchCurrentX - touchStartX; 
    swipedElement.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)'; 
    swipedElement.style.transform = `translateX(0px)`;
    if (diffX > 45) { 
        triggerReplyForMessage(swipedElement);
    }
    swipedElement = null; touchStartX = 0; touchCurrentX = 0;
});

document.querySelectorAll('.react-btn').forEach(btn => {
    btn.onclick = (e) => { hapticFeedback('light'); if (socket) socket.emit('react message', { msgId: selectedMsgId, emoji: e.target.innerText }); if (msgOptionsModal) msgOptionsModal.classList.add('hidden'); };
});

const optDelete = document.getElementById('opt-delete');
if (optDelete) optDelete.onclick = () => { if (socket) socket.emit('delete message', selectedMsgId); if (msgOptionsModal) msgOptionsModal.classList.add('hidden'); };

const optPin = document.getElementById('opt-pin');
if (optPin) optPin.onclick = () => { const li = document.getElementById(`msg-${selectedMsgId}`); if (li && socket) socket.emit('pin message', { msg: { user: li.dataset.sender, text: li.querySelector('.message-text')?.innerText || 'Attachment' }}); if (msgOptionsModal) msgOptionsModal.classList.add('hidden'); };

const optStar = document.getElementById('opt-star');
if (optStar) optStar.onclick = () => {
    const li = document.getElementById(`msg-${selectedMsgId}`);
    if (!li) return;
    hapticFeedback('medium');
    let starred = JSON.parse(localStorage.getItem('starred_messages_' + activeRoomId) || '[]');
    const existingIndex = starred.findIndex(m => m.id === selectedMsgId);
    if (existingIndex > -1) {
        starred.splice(existingIndex, 1);
        const starBadge = li.querySelector('.starred-badge');
        if (starBadge) starBadge.remove();
    } else {
        const textNode = li.querySelector('.message-text');
        let msgText = textNode ? textNode.innerText.replace('(edited)', '').trim() : 'Attachment';
        starred.push({
            id: selectedMsgId,
            user: li.dataset.sender || 'User',
            text: msgText,
            time: li.querySelector('.meta-row span')?.innerText || ''
        });
        let metaRow = li.querySelector('.meta-row');
        if (metaRow && !metaRow.querySelector('.starred-badge')) {
            const badge = document.createElement('span');
            badge.className = 'starred-badge';
            badge.textContent = '⭐';
            metaRow.appendChild(badge);
        }
    }
    localStorage.setItem('starred_messages_' + activeRoomId, JSON.stringify(starred));
    if (msgOptionsModal) msgOptionsModal.classList.add('hidden');
};

const btnViewStarred = document.getElementById('btn-view-starred');
if (btnViewStarred) btnViewStarred.onclick = () => {
    if (groupInfoModal) groupInfoModal.classList.add('hidden');
    const listEl = document.getElementById('starred-messages-list');
    let starred = JSON.parse(localStorage.getItem('starred_messages_' + activeRoomId) || '[]');
    if (listEl) {
        if (starred.length === 0) {
            listEl.innerHTML = `<p style="text-align: center; color: var(--text-secondary); font-size: 13.5px; padding: 20px 0;">No starred messages yet. Long-press any message to star it! ⭐</p>`;
        } else {
            listEl.innerHTML = starred.map(m => `
                <div class="starred-item-card" onclick="const sm = document.getElementById('starred-messages-modal'); if(sm) sm.classList.add('hidden'); scrollToQuoteMessage('msg-${m.id}')" style="background: var(--input-bg); padding: 10px 14px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: var(--accent);">
                        <span>${escapeHTML(m.user)}</span>
                        <span style="color: var(--text-secondary); font-size: 11px;">${escapeHTML(m.time)}</span>
                    </div>
                    <div style="font-size: 13.5px; color: var(--text-primary);">${escapeHTML(m.text)}</div>
                </div>
            `).join('');
        }
    }
    const starredModal = document.getElementById('starred-messages-modal');
    if (starredModal) starredModal.classList.remove('hidden');
};

const closeStarredModalBtn = document.getElementById('close-starred-modal-btn');
if (closeStarredModalBtn) closeStarredModalBtn.onclick = () => {
    const starredModal = document.getElementById('starred-messages-modal');
    if (starredModal) starredModal.classList.add('hidden');
};

const scrollBottomBtn = document.getElementById('scroll-bottom-btn');
const unreadBadge = document.getElementById('unread-count-badge');
let unreadScrolledCount = 0;

if (scrollBottomBtn) {
    if (messages) {
        messages.addEventListener('scroll', () => {
            const isScrolledUp = messages.scrollHeight - messages.scrollTop - messages.clientHeight > 150;
            if (isScrolledUp) {
                scrollBottomBtn.classList.add('visible');
            } else {
                scrollBottomBtn.classList.remove('visible');
                unreadScrolledCount = 0;
                if (unreadBadge) unreadBadge.classList.add('hidden');
            }
        });
    }

    scrollBottomBtn.onclick = () => {
        hapticFeedback('light');
        if (messages) messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
        unreadScrolledCount = 0;
        if (unreadBadge) unreadBadge.classList.add('hidden');
    };
}

const optEdit = document.getElementById('opt-edit');
if (optEdit) optEdit.onclick = () => { 
    const li = document.getElementById(`msg-${selectedMsgId}`); 
    if (li && input) {
        const textEl = li.querySelector('.message-text');
        if (textEl) input.value = textEl.innerText.replace('(edited)', '').trim();
    }
    editingMsgId = selectedMsgId; 
    setSendBtnState('check'); 
    if (input) input.focus(); 
    if (msgOptionsModal) msgOptionsModal.classList.add('hidden'); 
};

const optReply = document.getElementById('opt-reply');
if (optReply) optReply.onclick = () => { 
    const li = document.getElementById(`msg-${selectedMsgId}`); 
    if (li) triggerReplyForMessage(li);
    if (msgOptionsModal) msgOptionsModal.classList.add('hidden'); 
};

const cancelReplyBtn = document.getElementById('cancel-reply-btn');
if (cancelReplyBtn) cancelReplyBtn.onclick = () => { replyingTo = null; if (replyPreviewContainer) replyPreviewContainer.classList.add('hidden'); };

const unpinBtn = document.getElementById('unpin-btn');
if (unpinBtn) unpinBtn.onclick = () => { if (socket) socket.emit('unpin message'); };

window.scrollToQuoteMessage = function(targetId) {
    if (!targetId) return;
    const targetEl = document.getElementById(targetId) || document.getElementById('msg-' + targetId);
    if (targetEl) {
        hapticFeedback('light');
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetEl.classList.remove('highlight-flash');
        void targetEl.offsetWidth; // reflow
        targetEl.classList.add('highlight-flash');
        setTimeout(() => {
            targetEl.classList.remove('highlight-flash');
        }, 1400);
    }
};

socket.on('pinned updated', (pinnedMsg) => {
    const pinnedBanner = document.getElementById('pinned-banner');
    if (pinnedMsg) { document.getElementById('pinned-user').textContent = pinnedMsg.user; document.getElementById('pinned-text').textContent = pinnedMsg.text; pinnedBanner.classList.remove('hidden');
    } else { pinnedBanner.classList.add('hidden'); }
});

socket.on('chat message', (data) => {
    if (data.roomId && data.roomId !== activeRoomId) return;
    displayMessage(data, false);
    
    if (data.user !== currentUser.name) {
        playUiSound('receive');
        
        if (document.hidden) {
            const roomObj = globalRoomList.find(r => r.id === activeRoomId);
            const rName = roomObj ? roomObj.name : (currentRoomName ? currentRoomName.textContent : 'Room');
            let summaryText = data.text || (data.isAudio ? '🎤 Voice Note' : (data.uploadedImage ? '📷 Photo' : 'Attachment'));
            triggerSystemNotification(data.user, rName, summaryText, data.avatar, activeRoomId);
        }
        
        if (!document.hidden && activeRoomId) socket.emit('mark read');
    }
});

socket.on('poll updated', (updatedMsg) => {
    if (updatedMsg.roomId && updatedMsg.roomId !== activeRoomId) return;
    const li = document.getElementById(`msg-${updatedMsg.id}`);
    if (li) { const isMe = updatedMsg.user === currentUser.name; const isStacked = li.classList.contains('stacked'); li.innerHTML = getMessageInnerHTML(updatedMsg, isMe, isStacked); }
});

socket.on('messages read', () => { document.querySelectorAll('.ticks.delivered').forEach(el => { el.classList.remove('delivered'); el.classList.add('read'); }); });

socket.on('update reactions', (data) => { 
    const li = document.getElementById(`msg-${data.id}`);
    if(li) {
        let badge = li.querySelector('.reaction-badge');
        let reactString = Object.entries(data.reactions).map(([emoji, count]) => `${emoji} ${count}`).join(' ');
        if (!badge) { badge = document.createElement('div'); badge.className = 'reaction-badge'; badge.id = `reaction-count-${data.id}`; li.appendChild(badge); }
        badge.innerHTML = reactString;
    } 
});

socket.on('message edited', (data) => {
    const el = document.getElementById(`msg-${data.id}`);
    if (el) {
        const textNode = el.querySelector('.message-text');
        if (textNode) {
            textNode.innerHTML = escapeHTML(data.newText) + `<span class="edited-tag">(edited)</span>`;
        } else {
            const bubble = el.querySelector('.msg-bubble');
            if (bubble) {
                bubble.innerHTML = `<span class="message-text">${escapeHTML(data.newText)} <span class="edited-tag">(edited)</span></span>`;
            }
        }
    }
    if (data && data.newText && typeof data.newText === 'string' && /theshmil|galliya/i.test(data.newText)) {
        triggerKissAnimation();
    }
});

function formatAudioTime(seconds) {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function generateWaveformBarsHTML() {
    const heights = [35, 60, 85, 40, 75, 100, 50, 90, 65, 30, 80, 95, 45, 70, 85, 40, 60, 30, 50, 25];
    return heights.map(h => `<div class="wave-bar" style="height: ${h}%;"></div>`).join('');
}

function updateWaveformProgress(container, currentTime, duration) {
    if (!container) return;
    const waveBars = container.querySelectorAll('.wave-bar');
    const timeLabel = container.querySelector('.audio-time-label');
    
    if (timeLabel) {
        timeLabel.textContent = formatAudioTime(currentTime) + (duration ? ` / ${formatAudioTime(duration)}` : '');
    }

    if (!duration || waveBars.length === 0) return;
    const progress = Math.min(1, Math.max(0, currentTime / duration));
    const activeCount = Math.floor(progress * waveBars.length);

    waveBars.forEach((bar, idx) => {
        if (idx <= activeCount && progress > 0) {
            bar.classList.add('played');
        } else {
            bar.classList.remove('played');
        }
    });
}

function resetAudioPlayerUI(container) {
    if (!container) return;
    const playIcon = container.querySelector('.play-icon');
    const pauseIcon = container.querySelector('.pause-icon');
    const timeLabel = container.querySelector('.audio-time-label');
    const waveBars = container.querySelectorAll('.wave-bar');

    if (playIcon) playIcon.classList.remove('hidden');
    if (pauseIcon) pauseIcon.classList.add('hidden');
    if (timeLabel) timeLabel.textContent = '0:00';
    waveBars.forEach(bar => bar.classList.remove('played'));
}

function getMessageInnerHTML(data, isMe, isStacked) {
    let contentText = escapeHTML(data.text || '');
    if(data.isEdited) contentText += `<span class="edited-tag">(edited)</span>`;
    
    let content = '';
    if (data.poll) {
        const isMultiple = !!data.poll.isMultiple;
        const isAnonymous = !!data.poll.isAnonymous;
        const isClosed = !!data.poll.isClosed;

        // Unique voters set
        const uniqueVoters = new Set();
        data.poll.options.forEach(opt => {
            if (opt.votes) opt.votes.forEach(v => uniqueVoters.add(v));
        });
        const totalVotersCount = uniqueVoters.size;
        const totalVotesCast = data.poll.options.reduce((sum, opt) => sum + (opt.votes ? opt.votes.length : 0), 0);
        const maxVotes = Math.max(...data.poll.options.map(o => o.votes ? o.votes.length : 0));

        // User's voted option indices
        const userVotedIndices = [];
        data.poll.options.forEach((opt, idx) => {
            if (opt.votes && opt.votes.includes(currentUser.name)) {
                userVotedIndices.push(idx);
            }
        });

        let pollOptsHTML = data.poll.options.map((opt, idx) => {
            const voteCount = opt.votes ? opt.votes.length : 0;
            const percent = totalVotesCast > 0 ? Math.round((voteCount / totalVotesCast) * 100) : 0;
            const isSelected = userVotedIndices.includes(idx);
            const isWinning = totalVotesCast > 0 && voteCount > 0 && voteCount === maxVotes;

            let icon = '';
            if (isMultiple) {
                icon = isSelected 
                    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="6" fill="var(--accent)"/><path d="m7 12 3.5 3.5 7-7" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
                    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="6"/></svg>`;
            } else {
                icon = isSelected 
                    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9.5" stroke="var(--accent)" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="var(--accent)"/></svg>`
                    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2"><circle cx="12" cy="12" r="9.5"/></svg>`;
            }

            // Voter avatars preview for public polls
            let voterAvatarsHTML = '';
            if (!isAnonymous && opt.votes && opt.votes.length > 0) {
                const previewVoters = opt.votes.slice(0, 3);
                const extraCount = opt.votes.length - 3;
                voterAvatarsHTML = `
                    <div class="poll-opt-voters-avatars">
                        ${previewVoters.map(vName => `<span class="poll-voter-dot" title="${escapeHTML(vName)}">${escapeHTML(vName.charAt(0).toUpperCase())}</span>`).join('')}
                        ${extraCount > 0 ? `<span class="poll-voter-more">+${extraCount}</span>` : ''}
                    </div>
                `;
            }

            return `
                <button class="poll-option-btn ${isSelected ? 'selected-option' : ''} ${isWinning ? 'winning-option' : ''} ${isClosed ? 'disabled-option' : ''}" 
                        data-msgid="${data.id}" data-optidx="${idx}" ${isClosed ? 'disabled' : ''}>
                    <div class="poll-bar" style="width: ${percent}%;"></div>
                    <div class="poll-text-row">
                        <div class="poll-opt-left">
                            <span class="poll-radio-icon">${icon}</span>
                            <span class="poll-opt-text">${escapeHTML(opt.text)}</span>
                            ${isWinning ? `<span class="poll-crown-badge" title="Leading Option"><svg width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b" stroke="#d97706" stroke-width="1.5"><path d="M2 20h20v-2H2v2zm1-3h18l-3-9-4 4-3-7-3 7-4-4-3 9z"/></svg></span>` : ''}
                        </div>
                        <div class="poll-opt-right">
                            ${voterAvatarsHTML}
                            <span class="poll-opt-count">${percent}% ${voteCount > 0 ? `(${voteCount})` : ''}</span>
                        </div>
                    </div>
                </button>
            `;
        }).join('');

        const isCreator = data.user === currentUser.name;

        content = `
            <div class="poll-card ${isClosed ? 'poll-card-closed' : ''}" data-msgid="${data.id}">
                <div class="poll-header">
                    <div class="poll-badge-row">
                        <span class="poll-badge">POLL</span>
                        <span class="poll-type-tag">
                            ${isMultiple 
                                ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m9 12 2 2 4-4"/></svg> Multi-choice`
                                : `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg> Single-choice`}
                        </span>
                        ${isAnonymous ? `
                            <span class="poll-anon-tag">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Anonymous
                            </span>` : ''}
                        ${isClosed ? `
                            <span class="poll-closed-tag">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Closed
                            </span>` : ''}
                    </div>
                    <div class="poll-question">${escapeHTML(data.poll.question)}</div>
                </div>
                <div class="poll-options-list">${pollOptsHTML}</div>
                <div class="poll-footer">
                    <span class="poll-total-votes">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        ${totalVotersCount} ${totalVotersCount === 1 ? 'voter' : 'voters'}
                    </span>
                    <div class="poll-footer-actions">
                        <button class="btn-view-poll-votes" data-msgid="${data.id}" title="View Voter Breakdown" type="button">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Results
                        </button>
                        ${isCreator && !isClosed ? `
                            <button class="btn-close-poll" data-msgid="${data.id}" title="End voting for this poll" type="button">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> End
                            </button>` : ''}
                    </div>
                </div>
            </div>
        `;
    } 
    else if (data.uploadedImage || data.image) {
        const imgSrc = data.uploadedImage || data.image;
        if (data.isAudio) {
            content = `
                <div class="custom-audio-player" data-audio-src="${escapeHTML(imgSrc)}">
                    <button class="cozy-play-btn play-pause-btn" title="Play Voice Note" type="button">
                        <svg class="play-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        <svg class="pause-icon hidden" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>
                    </button>
                    <div class="cozy-audio-body">
                        <div class="cozy-waveform-track" title="Tap to seek">
                            ${generateWaveformBarsHTML()}
                        </div>
                        <div class="cozy-audio-meta">
                            <span class="audio-time-label">0:00</span>
                            <button class="audio-speed-btn" title="Change playback speed" type="button" data-speed="1">1x</button>
                            <span class="audio-type-badge">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>
                                Voice Note
                            </span>
                        </div>
                    </div>
                </div>`;
        }
        else if (data.isVideo) content = `${contentText ? `<span class="message-text" style="display:block; margin-bottom:6px;">${contentText}</span>` : ''}<video src="${escapeHTML(imgSrc)}" class="chat-video" controls playsinline></video>`;
        else content = `${contentText ? `<span class="message-text" style="display:block; margin-bottom:6px;">${contentText}</span>` : ''}<img src="${escapeHTML(imgSrc)}" class="chat-image">`;
    } 
    else { content = `<span class="message-text">${contentText}</span>`; }

    if (data.linkPreview) {
        content += `<a href="${escapeHTML(data.linkPreview.url)}" target="_blank" class="link-preview-card">${data.linkPreview.img ? `<img src="${escapeHTML(data.linkPreview.img)}" class="link-preview-img" style="display:block;">` : ''}<div class="link-preview-content"><div class="link-preview-title">${escapeHTML(data.linkPreview.title)}</div>${data.linkPreview.desc ? `<div class="link-preview-desc">${escapeHTML(data.linkPreview.desc)}</div>` : ''}</div></a>`;
    }
    
    let replyHTML = ''; 
    if (data.replyTo && data.replyTo.user) {
        const targetId = data.replyTo.msgId ? (data.replyTo.msgId.startsWith('msg-') ? data.replyTo.msgId : 'msg-' + data.replyTo.msgId) : '';
        replyHTML = `
            <div class="replied-to" onclick="scrollToQuoteMessage('${targetId}')">
                <div class="replied-to-bar"></div>
                <div class="replied-to-body">
                    <span class="replied-to-user">${escapeHTML(data.replyTo.user)}</span>
                    <span class="replied-to-text">${escapeHTML(data.replyTo.text).substring(0, 120)}</span>
                </div>
            </div>`;
    }
    let reactionsHTML = ''; if (data.reactions && Object.keys(data.reactions).length > 0) reactionsHTML = `<div class="reaction-badge" id="reaction-count-${data.id}">${Object.entries(data.reactions).map(([e, c]) => `${e} ${c}`).join(' ')}</div>`;
    let tickClass = data.status === 'read' ? 'read' : 'delivered';
    
    if (isMe) {
        return `
            <div class="msg-bubble">
                ${replyHTML}${content}
                <div class="meta-row"><span>${data.isGhost ? '⏱️ ' : ''}${data.time}</span><span class="ticks ${tickClass}">✔✔</span></div>
                ${reactionsHTML}
            </div>`;
    } else {
        const avatarHTML = !isStacked 
            ? `<img src="${escapeHTML(data.avatar)}" class="avatar-small" data-name="${escapeHTML(data.user)}" title="${escapeHTML(data.user)}">` 
            : `<div class="avatar-placeholder"></div>`;
        return `
            ${avatarHTML}
            <div class="msg-bubble">
                ${!isStacked ? `<span class="sender-name">${escapeHTML(data.user)}</span>` : ''}
                ${replyHTML}${content}
                <div class="meta-row"><span>${data.isGhost ? '⏱️ ' : ''}${data.time}</span></div>
                ${reactionsHTML}
            </div>`;
    }
}

// ==========================
// ✅ GHOST MODE FIX
// ==========================
// ==========================
// 📊 POLL MESSAGES & VOTERS BREAKDOWN MODAL
// ==========================
const pollMessagesMap = new Map();
let currentViewPollId = null;

const pollVotersModal = document.getElementById('poll-voters-modal');
const closePvModalBtn = document.getElementById('close-pv-modal-btn');
const pollVotersList = document.getElementById('poll-voters-list');

if (closePvModalBtn && pollVotersModal) {
    closePvModalBtn.onclick = () => {
        pollVotersModal.classList.add('hidden');
        currentViewPollId = null;
    };
    pollVotersModal.addEventListener('click', (e) => {
        if (e.target === pollVotersModal) {
            pollVotersModal.classList.add('hidden');
            currentViewPollId = null;
        }
    });
}

function openPollVotersModal(msgData) {
    if (!msgData || !msgData.poll) return;
    currentViewPollId = msgData.id;
    
    const pvTitle = document.getElementById('pv-modal-title');
    const pvSub = document.getElementById('pv-modal-sub');
    
    if (pvTitle) pvTitle.textContent = msgData.poll.question || 'Poll Results';
    if (pvSub) {
        pvSub.innerHTML = msgData.poll.isAnonymous 
            ? `<span style="display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Anonymous Poll (Voters hidden)</span>` 
            : `<span style="display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> ${msgData.poll.isMultiple ? 'Multiple Choice Breakdown' : 'Single Choice Breakdown'}</span>`;
    }

    renderPollVotersList(msgData.poll);
    if (pollVotersModal) pollVotersModal.classList.remove('hidden');
}

function renderPollVotersList(poll) {
    if (!pollVotersList) return;
    if (poll.isAnonymous) {
        pollVotersList.innerHTML = `
            <div style="text-align: center; padding: 24px 16px; color: var(--text-secondary); background: var(--input-bg); border-radius: 16px; border: 1px dashed var(--border-color);">
                <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(139, 92, 246, 0.12); color: #8b5cf6; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px auto;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg>
                </div>
                <strong style="font-size: 15px; color: var(--text-primary); display: block;">Anonymous Poll</strong>
                <p style="font-size: 12.5px; margin-top: 4px; color: var(--text-secondary);">Individual names and avatars are kept private for this poll.</p>
            </div>
        `;
        return;
    }

    pollVotersList.innerHTML = poll.options.map((opt, i) => {
        const votes = opt.votes || [];
        return `
            <div style="background: var(--input-bg); border: 1px solid var(--border-color); border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 14px;">
                    <span style="color: var(--text-primary);">${i + 1}. ${escapeHTML(opt.text)}</span>
                    <span style="color: var(--accent); font-size: 13px; background: rgba(16, 185, 129, 0.12); padding: 2px 8px; border-radius: 10px;">${votes.length} ${votes.length === 1 ? 'vote' : 'votes'}</span>
                </div>
                ${votes.length > 0 ? `
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px;">
                        ${votes.map(vName => `
                            <div style="display: flex; align-items: center; gap: 6px; background: var(--bg-screen); border: 1px solid var(--border-color); padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; color: var(--text-primary);">
                                <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(vName)}" style="width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--border-color);">
                                <span>${escapeHTML(vName)}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : `<div style="font-size: 12px; color: var(--text-secondary); font-style: italic;">No votes yet for this option</div>`}
            </div>
        `;
    }).join('');
}

if (socket) {
    socket.on('poll updated', (data) => {
        if (data && data.poll) {
            pollMessagesMap.set(data.id, data);
            const li = document.getElementById(`msg-${data.id}`);
            if (li) {
                const isMe = data.user === currentUser.name;
                const isStacked = li.classList.contains('stacked');
                li.innerHTML = getMessageInnerHTML(data, isMe, isStacked);
                playUiSound('pop');
            }
            if (currentViewPollId === data.id) {
                renderPollVotersList(data.poll);
            }
        }
    });
}

// ==========================
// 💋 INSTAGRAM-STYLE FLOATING KISS EMOJI ANIMATION
// ==========================
function triggerKissAnimation() {
    try {
        hapticFeedback('heavy');
        playUiSound('pop');
    } catch(e){}

    const existing = document.getElementById('kiss-animation-container');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id = 'kiss-animation-container';
    container.className = 'kiss-animation-container';

    // Ambient pink backdrop glow
    const backdrop = document.createElement('div');
    backdrop.className = 'kiss-overlay-backdrop';
    container.appendChild(backdrop);

    // Cute emoji selection for a sweet aesthetic shower
    const cuteEmojis = ['💋', '💋', '💋', '💖', '💕', '🌸', '✨', '💗', '🎀'];
    
    // Generate 14 lightweight floating emojis floating up from bottom to top
    const kissCount = 14;
    for (let i = 0; i < kissCount; i++) {
        const el = document.createElement('div');
        el.className = 'floating-kiss-emoji';
        el.textContent = cuteEmojis[Math.floor(Math.random() * cuteEmojis.length)];
        
        // Cute sizing & smooth bottom-to-top floating parameters
        const left = Math.random() * 88 + 6; // 6% to 94%
        const startBottom = -(Math.random() * 12 + 6); // -6vh to -18vh (starting below bottom)
        const fontSize = Math.floor(Math.random() * 18 + 24); // 24px to 42px
        const duration = (Math.random() * 1.0 + 3.0).toFixed(2); // 3.0s to 4.0s (smooth constant speed)
        const delay = (Math.random() * 0.8).toFixed(2); // 0s to 0.8s delay
        const initRot = (Math.random() * 30 - 15).toFixed(1); // -15deg to +15deg
        const endRot = (Math.random() * 40 - 20).toFixed(1); // -20deg to +20deg
        const sway = (Math.random() * 40 - 20).toFixed(1); // -20px to +20px sway

        el.style.left = `${left}%`;
        el.style.bottom = `${startBottom}vh`;
        el.style.fontSize = `${fontSize}px`;
        el.style.animationDuration = `${duration}s`;
        el.style.animationDelay = `${delay}s`;
        el.style.setProperty('--sway', `${sway}px`);
        el.style.setProperty('--init-rot', `${initRot}deg`);
        el.style.setProperty('--end-rot', `${endRot}deg`);

        container.appendChild(el);
    }

    document.body.appendChild(container);

    setTimeout(() => {
        if (container && container.parentNode) {
            container.remove();
        }
    }, 5500);
}

function displayMessage(data, isHistory) {
    checkEmptyMessages();
    if (data && data.poll) {
        pollMessagesMap.set(data.id, data);
    }

    // 💋 Trigger Instagram-style kiss animation when "Theshmil" or "Galliya" is sent/received
    if (!isHistory && data && data.text && typeof data.text === 'string') {
        if (/theshmil|galliya/i.test(data.text)) {
            triggerKissAnimation();
        }
    }

    const li = document.createElement('li'); li.id = `msg-${data.id}`; li.dataset.sender = data.user;
    if (data.type === 'system') { li.className = 'system-message'; li.textContent = data.text; messages.appendChild(li); messages.scrollTop = messages.scrollHeight; return; }

    const isMe = data.user === currentUser.name;
    const lastMsg = messages.lastElementChild;
    const isStacked = (lastMsg && !lastMsg.classList.contains('system-message') && lastMsg.dataset.sender === data.user);

    li.className = isMe ? 'my-message' : 'other-message';
    if(isStacked) li.classList.add('stacked');
    if(data.isGhost) li.classList.add('ghost-message');
    if (data.color) li.style.setProperty('--bubble-color', data.color);

    li.innerHTML = getMessageInnerHTML(data, isMe, isStacked);
    messages.appendChild(li); messages.scrollTop = messages.scrollHeight;

    if (!isMe && !isHistory) {
        playUiSound('receive');
    }

    if (data.isGhost && !isHistory) {
        setTimeout(() => {
            if (li) li.remove();
            checkEmptyMessages();
            if (isMe) socket.emit('delete message', data.id); // Sync for all
        }, 10000);
    }
}

// ==========================
// ✅ COZY AUDIO PLAYER LOGIC
// ==========================
let currentPlayingAudio = null;
let currentPlayingContainer = null;

document.getElementById('messages').addEventListener('click', (e) => { 
    const speedBtn = e.target.closest('.audio-speed-btn');
    if (speedBtn) {
        e.stopPropagation();
        hapticFeedback('light');
        const playerContainer = speedBtn.closest('.custom-audio-player');
        const speeds = [1, 1.5, 2];
        let currSpeed = parseFloat(speedBtn.dataset.speed || 1);
        let nextIndex = (speeds.indexOf(currSpeed) + 1) % speeds.length;
        let newSpeed = speeds[nextIndex];
        speedBtn.dataset.speed = newSpeed;
        speedBtn.textContent = newSpeed + 'x';
        if (currentPlayingAudio && currentPlayingContainer === playerContainer) {
            currentPlayingAudio.playbackRate = newSpeed;
        }
        return;
    }

    const playBtn = e.target.closest('.play-pause-btn');
    const track = e.target.closest('.cozy-waveform-track');

    if (!playBtn && !track) return;

    const playerContainer = (playBtn || track).closest('.custom-audio-player'); 
    if (!playerContainer) return;

    const audioSrc = playerContainer.dataset.audioSrc;
    const playIcon = playerContainer.querySelector('.play-icon');
    const pauseIcon = playerContainer.querySelector('.pause-icon');
    const playerSpeedBtn = playerContainer.querySelector('.audio-speed-btn');

    // Handle Waveform seeking if audio is currently active
    if (track && !playBtn) {
        if (currentPlayingAudio && currentPlayingContainer === playerContainer) {
            const rect = track.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const fraction = Math.min(1, Math.max(0, clickX / rect.width));
            if (currentPlayingAudio.duration) {
                currentPlayingAudio.currentTime = fraction * currentPlayingAudio.duration;
                updateWaveformProgress(playerContainer, currentPlayingAudio.currentTime, currentPlayingAudio.duration);
            }
            return;
        }
    }

    // Toggle Play/Pause
    if (currentPlayingAudio && currentPlayingContainer === playerContainer) {
        if (currentPlayingAudio.paused) { 
            currentPlayingAudio.play(); 
            if (playIcon) playIcon.classList.add('hidden');
            if (pauseIcon) pauseIcon.classList.remove('hidden');
            hapticFeedback('light');
        } else { 
            currentPlayingAudio.pause(); 
            if (playIcon) playIcon.classList.remove('hidden');
            if (pauseIcon) pauseIcon.classList.add('hidden');
            hapticFeedback('light');
        }
    } else {
        // 🔥 Stop previous audio
        if (currentPlayingAudio) {
            currentPlayingAudio.pause();
            resetAudioPlayerUI(currentPlayingContainer);
            currentPlayingAudio = null;
            currentPlayingContainer = null;
        }

        hapticFeedback('light');
        currentPlayingAudio = new Audio(audioSrc); 
        currentPlayingContainer = playerContainer;

        const currentSpeed = parseFloat(playerSpeedBtn ? (playerSpeedBtn.dataset.speed || 1) : 1);
        currentPlayingAudio.playbackRate = currentSpeed;

        if (playIcon) playIcon.classList.add('hidden');
        if (pauseIcon) pauseIcon.classList.remove('hidden');

        currentPlayingAudio.play().catch(err => console.log('Audio playback error:', err)); 

        currentPlayingAudio.addEventListener('loadedmetadata', () => {
            updateWaveformProgress(playerContainer, 0, currentPlayingAudio.duration);
        });

        currentPlayingAudio.addEventListener('timeupdate', () => { 
            updateWaveformProgress(playerContainer, currentPlayingAudio.currentTime, currentPlayingAudio.duration);
        });

        currentPlayingAudio.addEventListener('ended', () => { 
            resetAudioPlayerUI(playerContainer);
            currentPlayingAudio = null;
            currentPlayingContainer = null;
        });
    }
});

document.getElementById('messages').addEventListener('click', (e) => { 
    const pollOpt = e.target.closest('.poll-option-btn');
    if (pollOpt) {
        if (pollOpt.classList.contains('disabled-option') || pollOpt.disabled) {
            showToast('This poll is closed 🔒');
            return;
        }
        hapticFeedback('light'); 
        socket.emit('vote poll', { msgId: pollOpt.dataset.msgid, optionIndex: parseInt(pollOpt.dataset.optidx) }); 
        return; 
    }

    const closePollBtn = e.target.closest('.btn-close-poll');
    if (closePollBtn) {
        hapticFeedback('medium');
        socket.emit('close poll', { msgId: closePollBtn.dataset.msgid });
        showToast('Poll voting closed 🔒');
        return;
    }

    const viewVotesBtn = e.target.closest('.btn-view-poll-votes');
    if (viewVotesBtn) {
        hapticFeedback('light');
        const msgId = viewVotesBtn.dataset.msgid;
        const msgData = pollMessagesMap.get(msgId);
        if (msgData) {
            openPollVotersModal(msgData);
        }
        return;
    }

    if(e.target.classList.contains('chat-image')) { document.getElementById('lightbox-img').src = e.target.src; document.getElementById('lightbox').classList.remove('hidden'); } 
    if(e.target.classList.contains('avatar-small')) { const friendName = e.target.dataset.name; socket.emit('get user info', friendName); }
});

// Lobby search & Category filters
const lobbySearchInput = document.getElementById('lobby-search-input');
const clearLobbySearchBtn = document.getElementById('clear-lobby-search-btn');

// Quick Emoji Drawer
const emojiBtn = document.getElementById('emoji-btn');
const emojiDrawer = document.getElementById('emoji-drawer');
const closeEmojiDrawer = document.getElementById('close-emoji-drawer');

if (emojiBtn && emojiDrawer) {
    emojiBtn.addEventListener('click', () => {
        hapticFeedback('light');
        emojiDrawer.classList.toggle('hidden');
    });
}

if (closeEmojiDrawer && emojiDrawer) {
    closeEmojiDrawer.addEventListener('click', () => {
        emojiDrawer.classList.add('hidden');
    });
}

document.querySelectorAll('.emoji-item').forEach(item => {
    item.addEventListener('click', () => {
        hapticFeedback('light');
        input.value += item.textContent;
        input.focus();
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
});

const availableThemes = ['emerald', 'light', 'dark', 'pink']; 
let currentThemeIndex = 0;
const savedTheme = localStorage.getItem('chitchat_theme') || 'emerald';
currentThemeIndex = availableThemes.indexOf(savedTheme); 
if(currentThemeIndex === -1) currentThemeIndex = 0;

const THEME_ICONS_SVG = {
    emerald: `<span style="font-size:16px; line-height:1;">🌱</span>`,
    
    light: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="sunHGrad" x1="0" y1="0" x2="24" y2="24"><stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#d97706"/></linearGradient></defs><circle cx="12" cy="12" r="4.5" fill="url(#sunHGrad)"/><path d="M12 1.5V3.5M12 20.5V22.5M1.5 12H3.5M20.5 12H22.5M4.57 4.57L5.99 5.99M18.01 18.01L19.43 19.43M4.57 19.43L5.99 18.01M18.01 5.99L19.43 4.57" stroke="url(#sunHGrad)" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    
    dark: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="moonHGrad" x1="0" y1="0" x2="24" y2="24"><stop offset="0%" stop-color="#818cf8"/><stop offset="100%" stop-color="#4f46e5"/></linearGradient></defs><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" fill="url(#moonHGrad)"/><path d="M19 4L19.6 5.4L21 6L19.6 6.6L19 8L18.4 6.6L17 6L18.4 5.4L19 4Z" fill="#a5b4fc"/></svg>`,
    
    pink: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="roseHGrad" x1="0" y1="0" x2="24" y2="24"><stop offset="0%" stop-color="#f472b6"/><stop offset="100%" stop-color="#db2777"/></linearGradient></defs><path d="M12 3C12 3 16.5 7 16.5 11C16.5 13.4853 14.4853 15.5 12 15.5C9.51472 15.5 7.5 13.4853 7.5 11C7.5 7 12 3 12 3Z" fill="url(#roseHGrad)"/><path d="M5 13.5C2.5 12 2 9.5 3.5 7.5C5 5.5 7.5 6 9 8.5C9 8.5 7.5 11.5 5 13.5Z" fill="url(#roseHGrad)" opacity="0.75"/><path d="M19 13.5C21.5 12 22 9.5 20.5 7.5C19 5.5 16.5 6 15 8.5C15 8.5 16.5 11.5 19 13.5Z" fill="url(#roseHGrad)" opacity="0.75"/></svg>`
};

function applyTheme(themeName) {
    if (!themeName || themeName === 'light') {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('chitchat_theme', 'light');
    } else {
        document.body.setAttribute('data-theme', themeName);
        localStorage.setItem('chitchat_theme', themeName);
    }

    if (typeof availableThemes !== 'undefined') {
        currentThemeIndex = availableThemes.indexOf(themeName);
        if (currentThemeIndex === -1) currentThemeIndex = 0;
    }

    const themeIcon = document.getElementById('theme-btn-icon');
    if (themeIcon && typeof THEME_ICONS_SVG !== 'undefined') {
        themeIcon.innerHTML = THEME_ICONS_SVG[themeName] || THEME_ICONS_SVG.emerald;
    }

    document.querySelectorAll('.login-theme-pills .theme-pill').forEach(pill => {
        const isMatch = pill.dataset.themeChoice === themeName || (!pill.dataset.themeChoice && themeName === 'light');
        pill.classList.toggle('active', isMatch);
    });

    document.querySelectorAll('.theme-selector-grid .theme-card-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.themeVal === themeName);
    });

    // Update sweetheart & flirt preview cards in customization studio modal
    const sweetheartPreview = document.querySelector('.wp-pattern-sweetheart');
    if (sweetheartPreview) {
        sweetheartPreview.style.backgroundImage = getSweetheartSvgDataUrl();
    }
    const flirtPreview = document.querySelector('.wp-pattern-flirt');
    if (flirtPreview) {
        flirtPreview.style.backgroundImage = getFlirtSvgDataUrl();
    }

    // Refresh active wallpaper if sweetheart or flirt is active
    const savedWallpaper = (typeof activeRoomId !== 'undefined' && activeRoomId && localStorage.getItem('wallpaper_' + activeRoomId)) || localStorage.getItem('chitchat_global_wallpaper');
    const activeCard = document.querySelector('.wp-card.active');
    const activeWp = activeCard ? activeCard.dataset.wp : (savedWallpaper ? savedWallpaper.replace('pattern:', '') : '');
    
    if ((activeWp === 'sweetheart' || activeWp === 'flirt') && typeof applyChatWallpaper === 'function') {
        applyChatWallpaper('pattern:' + activeWp);
    }
}

applyTheme(availableThemes[currentThemeIndex]);

const btnThemeCycle = document.getElementById('btn-theme-cycle');
if (btnThemeCycle) {
    btnThemeCycle.onclick = () => {
        hapticFeedback('light'); 
        currentThemeIndex = (currentThemeIndex + 1) % availableThemes.length;
        const newTheme = availableThemes[currentThemeIndex]; 
        applyTheme(newTheme);
    };
}

document.querySelectorAll('.theme-selector-grid .theme-card-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        hapticFeedback('light');
        const themeVal = btn.dataset.themeVal;
        if (themeVal) {
            applyTheme(themeVal);
        }
    });
});

let mediaRecorder; 
let audioChunks = []; 
let isRecording = false; 
let recordingTimerInterval = null;
let recordingSeconds = 0;
let isRecordingCancelled = false;
let recordStartTime = 0;

const recOverlay = document.getElementById('recording-overlay');
const inputPill = document.getElementById('input-pill');
const recTimer = document.getElementById('recording-timer');
const cancelRecBtn = document.getElementById('cancel-rec-btn');
const sendRecBtn = document.getElementById('send-rec-btn');

function updateRecTimerDisplay() {
    const mins = Math.floor(recordingSeconds / 60);
    const secs = recordingSeconds % 60;
    if (recTimer) recTimer.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

async function startRecording(e) {
    if (e && e.cancelable) e.preventDefault(); 
    if (input.value.trim() || activeRoomId === 'ai_lounge') return; 
    if (isRecording) return;

    hapticFeedback('medium'); 
    isRecordingCancelled = false;
    recordStartTime = Date.now();

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });

        // Determine best supported MIME type
        let options = {};
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            options.mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            options.mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
            options.mimeType = 'audio/ogg';
        }

        mediaRecorder = new MediaRecorder(stream, options);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => { 
            if (event.data && event.data.size > 0) {
                audioChunks.push(event.data); 
            }
        };

        mediaRecorder.onstop = () => {
            clearInterval(recordingTimerInterval);
            if (recOverlay) recOverlay.classList.add('hidden');
            if (inputPill) inputPill.classList.remove('hidden');

            if (!isRecordingCancelled && audioChunks.length > 0) {
                const finalMime = mediaRecorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunks, { type: finalMime }); 
                const reader = new FileReader();
                reader.onload = (event) => { 
                    socket.emit('chat message', { 
                        user: currentUser.name, 
                        avatar: currentUser.avatar, 
                        color: currentUser.color, 
                        text: '', 
                        uploadedImage: event.target.result, 
                        isAudio: true, 
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
                        isGhost: isGhostMode,
                        roomId: activeRoomId || 'lobby'
                    }); 
                };
                reader.readAsDataURL(audioBlob); 
            }
            audioChunks = []; 
            stream.getTracks().forEach(track => track.stop()); 
            isRecording = false;
        };

        mediaRecorder.start(100); // collect 100ms chunks continuously
        isRecording = true;

        recordingSeconds = 0;
        updateRecTimerDisplay();
        clearInterval(recordingTimerInterval);
        recordingTimerInterval = setInterval(() => {
            recordingSeconds++;
            updateRecTimerDisplay();
        }, 1000);

        if (recOverlay) recOverlay.classList.remove('hidden');
        if (inputPill) inputPill.classList.add('hidden');

    } catch(err) { 
        isRecording = false; 
        console.error('Microphone access error:', err);
        showToast("Please allow Microphone access to send Voice Notes! 🎤"); 
    }
}

function stopRecording(cancel = false) {
    isRecordingCancelled = cancel;
    if (isRecording && mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
            mediaRecorder.stop();
        } catch(err) {
            console.error('Error stopping MediaRecorder:', err);
        }
        isRecording = false;
        hapticFeedback(cancel ? 'light' : 'heavy'); 
    }
}

if (cancelRecBtn) {
    cancelRecBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        stopRecording(true);
    };
}
if (sendRecBtn) {
    sendRecBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        stopRecording(false);
    };
}

// ==========================
// ✅ THE FLAWLESS SEND & MIC BUTTON HANDLERS
// ==========================
sendMicBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const hasText = input && input.value && input.value.trim().length > 0;
    if (hasText || sendMicBtn.dataset.state === 'send' || sendMicBtn.dataset.state === 'check') {
        sendMessage();
    } else if (sendMicBtn.dataset.state === 'mic') {
        if (!isRecording) {
            startRecording(e);
        }
    }
});

function handleHoldRelease(e) {
    if (isRecording && (Date.now() - recordStartTime > 1200)) {
        stopRecording(false);
    }
}

sendMicBtn.addEventListener('touchend', handleHoldRelease);
sendMicBtn.addEventListener('mouseup', handleHoldRelease);
sendMicBtn.addEventListener('contextmenu', e => e.preventDefault());

// Register Service Worker for PWA Installation
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('Service Worker registered successfully', reg);
        }).catch(err => {
            console.log('Service Worker registration failed:', err);
        });
    });
}

// ==========================================================================
// CUSTOMIZATION STUDIO HANDLERS
// ==========================================================================

// Customization Studio Logic
const openCustomizationBtn = document.getElementById('open-customization-btn');
const customizationModal = document.getElementById('customization-modal');
const closeCustomizationModal = document.getElementById('close-customization-modal');

if (openCustomizationBtn) {
    openCustomizationBtn.onclick = () => {
        if (appSettingsModal) appSettingsModal.classList.add('hidden');
        hapticFeedback('medium');
        if (customizationModal) customizationModal.classList.remove('hidden');
    };
}
if (closeCustomizationModal) {
    closeCustomizationModal.onclick = () => {
        if (customizationModal) customizationModal.classList.add('hidden');
    };
}

// Wallpaper preset pattern buttons
document.querySelectorAll('.wp-card').forEach(card => {
    card.onclick = () => {
        document.querySelectorAll('.wp-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        hapticFeedback('light');
        const wpType = card.dataset.wp;
        const val = (wpType === 'default') ? null : `pattern:${wpType}`;
        setAndSaveWallpaper(val);
        const name = WALLPAPER_PATTERNS[wpType] ? WALLPAPER_PATTERNS[wpType].name : 'Pattern';
        showToast(`✨ ${name} design applied!`);
    };
});

// Solid color wallpaper tint apply
const btnApplyColorWp = document.getElementById('btn-apply-color-wp');
const custColorPicker = document.getElementById('cust-color-picker');
if (btnApplyColorWp && custColorPicker) {
    btnApplyColorWp.onclick = () => {
        const color = custColorPicker.value;
        setAndSaveWallpaper(color);
        showToast('🎨 Custom color tint applied!');
    };
}

// Bubble Style Picker
document.querySelectorAll('.bubble-style-card').forEach(card => {
    card.onclick = () => {
        document.querySelectorAll('.bubble-style-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const styleName = card.dataset.bubbleStyle || 'rounded';
        document.body.setAttribute('data-bubble-style', styleName);
        localStorage.setItem('chitchat_bubble_style', styleName);
        hapticFeedback('light');
    };
});

// Saved bubble style
const savedBubbleStyle = localStorage.getItem('chitchat_bubble_style');
if (savedBubbleStyle) {
    document.body.setAttribute('data-bubble-style', savedBubbleStyle);
    document.querySelectorAll('.bubble-style-card').forEach(card => {
        card.classList.toggle('active', card.dataset.bubbleStyle === savedBubbleStyle);
    });
}

// Font Size Slider
const fontSizeSlider = document.getElementById('font-size-slider');
const fontSizeValue = document.getElementById('font-size-value');
if (fontSizeSlider && fontSizeValue) {
    fontSizeSlider.oninput = (e) => {
        const size = e.target.value + 'px';
        fontSizeValue.textContent = size;
        document.documentElement.style.setProperty('--chat-font-size', size);
        localStorage.setItem('chitchat_font_size', size);
    };
}

const savedFontSize = localStorage.getItem('chitchat_font_size');
if (savedFontSize) {
    document.documentElement.style.setProperty('--chat-font-size', savedFontSize);
    if (fontSizeSlider) fontSizeSlider.value = parseInt(savedFontSize);
    if (fontSizeValue) fontSizeValue.textContent = savedFontSize;
}

// Floating Particle Effect on Reaction
function triggerReactionParticles(x, y, emoji = '✨') {
    const toggle = document.getElementById('toggle-reaction-fx');
    if (toggle && !toggle.checked) return;

    for (let i = 0; i < 6; i++) {
        const p = document.createElement('span');
        p.className = 'reaction-particle';
        p.textContent = emoji;
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        const dx = (Math.random() - 0.5) * 100 + 'px';
        const dy = (Math.random() * -80 - 20) + 'px';
        p.style.setProperty('--dx', dx);
        p.style.setProperty('--dy', dy);
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 800);
    }
}

// Hook double click on messages to particle burst
const messagesListEl = document.getElementById('messages');
if (messagesListEl) {
    messagesListEl.addEventListener('dblclick', (e) => {
        triggerReactionParticles(e.clientX, e.clientY, '❤️');
        showToast('❤️ Reacted!');
    });
}

// Service Worker Registration & Web Push Init
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((reg) => {
            console.log('Service Worker registered with scope:', reg.scope);
            if (Notification.permission === 'granted') {
                registerWebPushSubscription();
            }
        }).catch(err => {
            console.error('Service Worker registration failed:', err);
        });
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'OPEN_ROOM' && event.data.roomId) {
            openRoomById(event.data.roomId);
        }
    });
}
