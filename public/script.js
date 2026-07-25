// Connects directly to local server!
const socket = io();

function hapticFeedback(type = 'light') {
    if (!navigator.vibrate) return;
    if (type === 'light') navigator.vibrate(30); 
    else if (type === 'medium') navigator.vibrate(50); 
    else if (type === 'heavy') navigator.vibrate([40, 60, 40]); 
}

function escapeHTML(str) { const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }

const loadingScreen = document.getElementById('loading-screen');
const appLockScreen = document.getElementById('app-lock-screen'); 
const loginScreen = document.getElementById('login-screen');
const roomListScreen = document.getElementById('room-list-screen');
const chatScreen = document.getElementById('chat-screen');
const profileScreen = document.getElementById('profile-screen');

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
let globalRoomList = [];
let currentlyTyping = new Set();
let baseOnlineText = "Tap to change info";

let typingTimeout;
let typingSent = false;
let globalAudio = null;
let globalAudioBtn = null;
let globalAudioFill = null;

let isPromptingBiometrics = false;
const toggleAppLock = document.getElementById('toggle-app-lock');
toggleAppLock.checked = localStorage.getItem('chitchat_applock') === 'true';

toggleAppLock.addEventListener('change', (e) => {
    localStorage.setItem('chitchat_applock', e.target.checked);
});

async function verifyAppLock() {
    if (localStorage.getItem('chitchat_applock') !== 'true') return;
    if (isPromptingBiometrics) return; 

    isPromptingBiometrics = true;
    appLockScreen.classList.remove('hidden');

    if (window.Capacitor && window.Capacitor.Plugins.NativeBiometric) {
        try {
            await Capacitor.Plugins.NativeBiometric.verifyIdentity({ reason: 'Unlock Chit Chat', title: 'App Locked' });
            appLockScreen.classList.add('hidden');
            setTimeout(() => { isPromptingBiometrics = false; }, 1000);
        } catch (e) { 
            console.error('Biometric error', e); 
            isPromptingBiometrics = false; 
        }
    } else {
        document.querySelector('#app-lock-screen h2').innerText = "Web Mode: Click to Unlock";
        document.getElementById('unlock-app-btn').onclick = () => {
            appLockScreen.classList.add('hidden');
            isPromptingBiometrics = false;
        };
    }
}

document.getElementById('unlock-app-btn').onclick = verifyAppLock;
if (window.Capacitor && window.Capacitor.Plugins.App) { Capacitor.Plugins.App.addListener('appStateChange', (state) => { if (state.isActive) verifyAppLock(); }); }
verifyAppLock(); 

function closeLightbox() { lightbox.classList.add('hidden'); lightboxImg.src = ''; }
lightbox.addEventListener('click', closeLightbox); lightbox.addEventListener('touchstart', closeLightbox, { passive: true });

function saveUserLocally() { localStorage.setItem('chitchat_user', JSON.stringify(currentUser)); }

if (window.Capacitor && Capacitor.Plugins.LocalNotifications) {
    Capacitor.Plugins.LocalNotifications.requestPermissions();
} else if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission();
}

history.replaceState({screen: 'exit'}, '', '#exit');
const savedUser = localStorage.getItem('chitchat_user');
if (savedUser) {
    try {
        currentUser = JSON.parse(savedUser);
        usernameInput.value = currentUser.name || '';
        if (currentUser.avatar) { avatarPreview.src = currentUser.avatar; document.getElementById('settings-avatar-preview').src = currentUser.avatar; }
        document.getElementById('settings-username').value = currentUser.name || '';
        document.getElementById('settings-about').value = currentUser.about || '';
        document.getElementById('settings-bubble-color').value = currentUser.color || '#dcf8c6';
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
        avatarPreview.src = newUrl;
        document.getElementById('settings-avatar-preview').src = newUrl;
    };
}

// Upload Photo Triggers
const btnTriggerUpload = document.getElementById('btn-trigger-upload');
const btnUploadAvatarText = document.getElementById('btn-upload-avatar-text');
const avatarPreviewContainer = document.getElementById('avatar-preview-container');

if (btnTriggerUpload) btnTriggerUpload.onclick = (e) => { e.stopPropagation(); profilePicUpload.click(); };
if (btnUploadAvatarText) btnUploadAvatarText.onclick = () => profilePicUpload.click();
if (avatarPreviewContainer) avatarPreviewContainer.onclick = () => profilePicUpload.click();

// Real-time Theme Selector Pills
document.querySelectorAll('.login-theme-pills .theme-pill').forEach(pill => {
    pill.onclick = () => {
        hapticFeedback('light');
        const themeChoice = pill.dataset.themeChoice;
        applyTheme(themeChoice);
    };
});

loadingScreen.classList.add('hidden');
if (currentUser && currentUser.name) {
    loginScreen.classList.add('hidden');
    roomListScreen.classList.remove('hidden');
    history.pushState({screen: 'lobby'}, '', '#lobby');
} else {
    loginScreen.classList.remove('hidden');
    history.pushState({screen: 'login'}, '', '#login');
}

profilePicUpload.addEventListener('change', function() {
    if (this.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => { 
            currentUser.avatar = e.target.result; 
            avatarPreview.src = e.target.result; 
            document.getElementById('settings-avatar-preview').src = e.target.result; 
            document.querySelectorAll('.preset-avatar-item').forEach(el => el.classList.remove('active'));
            saveUserLocally(); 
        };
        reader.readAsDataURL(this.files[0]);
    }
});

document.getElementById('login-btn').addEventListener('click', () => {
    hapticFeedback('light'); 
    currentUser.name = usernameInput.value.trim();
    if (!currentUser.name) {
        usernameInput.focus();
        usernameInput.style.borderColor = '#ef4444';
        setTimeout(() => { usernameInput.style.borderColor = ''; }, 1500);
        return;
    }
    if (!currentUser.avatar) { 
        currentUser.avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.name)}`; 
        document.getElementById('settings-avatar-preview').src = currentUser.avatar; 
    }
    document.getElementById('settings-username').value = currentUser.name;
    loginScreen.classList.add('hidden'); roomListScreen.classList.remove('hidden');
    saveUserLocally(); history.replaceState({screen: 'lobby'}, '', '#lobby'); 
    socket.emit('update profile', currentUser);
});

document.getElementById('settings-btn').onclick = () => { 
    hapticFeedback('light'); 
    updateSettingsModalUI();
    appSettingsModal.classList.remove('hidden'); 
};

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

// Close Settings modal
const closeSettingsBtn = document.getElementById('close-settings-modal-btn');
if (closeSettingsBtn) {
    closeSettingsBtn.onclick = () => {
        hapticFeedback('light');
        appSettingsModal.classList.add('hidden');
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
        alert('✨ Cache & temporary wallpapers cleared successfully!');
        updateSettingsModalUI();
    };
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
            document.getElementById('settings-avatar-preview').src = item.src;
            if (avatarPreview) avatarPreview.src = item.src;
            saveUserLocally();
        }
    });
}

// Bubble color hex sync
const bubbleColorInput = document.getElementById('settings-bubble-color');
const bubbleHexLabel = document.getElementById('bubble-color-hex');
if (bubbleColorInput && bubbleHexLabel) {
    bubbleColorInput.value = currentUser.color || '#dcf8c6';
    bubbleHexLabel.textContent = bubbleColorInput.value;
    bubbleColorInput.addEventListener('input', (e) => {
        bubbleHexLabel.textContent = e.target.value;
    });
}

// Sound effects toggle
const soundToggle = document.getElementById('toggle-sound-effects');
if (soundToggle) {
    soundToggle.addEventListener('change', (e) => {
        localStorage.setItem('chitchat_sound_enabled', e.target.checked);
        if (e.target.checked) playUiSound('send');
    });
}

// Haptic feedback toggle
const hapticToggle = document.getElementById('toggle-haptic-feedback');
if (hapticToggle) {
    hapticToggle.addEventListener('change', (e) => {
        localStorage.setItem('chitchat_haptic_enabled', e.target.checked);
        if (e.target.checked) hapticFeedback('heavy');
    });
}

// App passcode lock toggle
const lockToggle = document.getElementById('toggle-app-lock');
if (lockToggle) {
    lockToggle.addEventListener('change', (e) => {
        localStorage.setItem('chitchat_lock_enabled', e.target.checked);
        if (e.target.checked) {
            alert('🔒 App Passcode Lock enabled! Your chat session is protected.');
        } else {
            alert('🔓 App Passcode Lock disabled.');
        }
    });
}

document.getElementById('btn-open-profile').onclick = () => {
    appSettingsModal.classList.add('hidden');
    roomListScreen.classList.add('hidden'); profileScreen.classList.remove('hidden'); 
    history.pushState({screen: 'profile'}, '', '#profile');
};

document.getElementById('btn-logout').onclick = () => { if(confirm("Are you sure you want to completely reset the app and log out? 😿")) { localStorage.clear(); window.location.reload(); } };

document.getElementById('close-profile-btn').onclick = (e) => { 
    e.preventDefault(); hapticFeedback('light'); profileScreen.classList.add('hidden'); roomListScreen.classList.remove('hidden'); history.pushState({screen: 'lobby'}, '', '#lobby');
};

document.getElementById('back-btn').onclick = (e) => { 
    e.preventDefault(); e.stopPropagation(); hapticFeedback('light'); chatScreen.classList.add('hidden'); roomListScreen.classList.remove('hidden'); 
    socket.emit('leave room'); activeRoomId = null; isGhostMode = false; ghostBtn.classList.remove('active'); currentlyTyping.clear();
    history.pushState({screen: 'lobby'}, '', '#lobby');
};

window.addEventListener('popstate', (e) => {
    const state = e.state ? e.state.screen : '';
    if (state === 'lobby') {
        if (activeRoomId) {
            chatScreen.classList.add('hidden'); roomListScreen.classList.remove('hidden');
            socket.emit('leave room'); activeRoomId = null; isGhostMode = false; ghostBtn.classList.remove('active'); currentlyTyping.clear();
        } else if (!profileScreen.classList.contains('hidden')) {
            profileScreen.classList.add('hidden'); roomListScreen.classList.remove('hidden');
        }
    } else if (state === 'exit') {
        if (!roomListScreen.classList.contains('hidden')) { if (confirm("Are you sure you want to exit Chit Chat? 😿")) history.back(); else history.pushState({screen: 'lobby'}, '', '#lobby'); 
        } else { history.back(); }
    }
});

document.getElementById('save-profile-btn').onclick = () => {
    if(document.getElementById('settings-username').value.trim()) currentUser.name = document.getElementById('settings-username').value.trim();
    if(document.getElementById('settings-about').value.trim()) currentUser.about = document.getElementById('settings-about').value.trim();
    currentUser.color = document.getElementById('settings-bubble-color').value; 
    socket.emit('update profile', currentUser);
    saveUserLocally(); profileScreen.classList.add('hidden'); roomListScreen.classList.remove('hidden');
};

function renderRoomList() {
    roomsUl.innerHTML = '';
    globalRoomList.forEach(room => {
        const li = document.createElement('li'); li.className = 'room-item';
        const logoUrl = room.logo || `https://api.dicebear.com/7.x/shapes/svg?seed=${room.id}`;
        const unreadCount = unreadCounts[room.id] || 0;
        const badgeHTML = unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : '';
        li.innerHTML = `<img src="${escapeHTML(logoUrl)}"><div class="room-info"><span class="room-name">${escapeHTML(room.name)}</span><span class="room-status">${room.isPrivate ? '🔒 Private' : '🌐 Public'}</span></div>${badgeHTML}`;
        li.onclick = () => joinRoomPrompt(room);
        roomsUl.appendChild(li);
    });
}

socket.on('room list', (rooms) => { globalRoomList = rooms; renderRoomList(); });
socket.on('global room alert', (roomId) => { if (activeRoomId !== roomId) { unreadCounts[roomId] = (unreadCounts[roomId] || 0) + 1; renderRoomList(); } });

document.getElementById('show-create-room-btn').onclick = () => { hapticFeedback('light'); createRoomModal.classList.remove('hidden'); }
document.getElementById('new-room-private').onchange = (e) => document.getElementById('password-input-container').classList.toggle('hidden', !e.target.checked);
document.getElementById('create-room-submit').onclick = () => {
    const name = document.getElementById('new-room-name').value;
    const isPrivate = document.getElementById('new-room-private').checked;
    const password = document.getElementById('new-room-pass').value;
    if(name) { socket.emit('create room', { name, isPrivate, password }); createRoomModal.classList.add('hidden'); }
};

let pendingJoinRoom = null;
function joinRoomPrompt(room) {
    hapticFeedback('light'); 
    if(room.isPrivate) { pendingJoinRoom = room; document.getElementById('join-room-pass').value = ''; passwordModal.classList.remove('hidden');
    } else { currentRoomPassword = ''; joinRoom(room.id, '', false); }
}
document.getElementById('join-room-submit').onclick = () => { currentRoomPassword = document.getElementById('join-room-pass').value; joinRoom(pendingJoinRoom.id, currentRoomPassword, false); passwordModal.classList.add('hidden'); };

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
    activeRoomId = data.room.id; 
    unreadCounts[activeRoomId] = 0; 
    renderRoomList();
    
    setSendBtnState(activeRoomId === 'ai_lounge' ? 'send' : 'mic');
    
    updateGroupHeader(data.room);
    const savedWallpaper = localStorage.getItem('wallpaper_' + activeRoomId);
    if (savedWallpaper) chatScreen.style.backgroundImage = `url(${savedWallpaper})`;
    else { chatScreen.style.backgroundImage = ''; }

    if (isRoomSwitch || messages.querySelectorAll('li').length === 0) {
        messages.innerHTML = '';
        data.history.forEach(msg => displayMessage(msg, true));
    }
    checkEmptyMessages();
    socket.emit('mark read');
});

document.addEventListener('visibilitychange', () => { if (!document.hidden && activeRoomId) { socket.emit('mark read'); } });

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

function updateHeaderSubtitle() {
    const typingBanner = document.getElementById('typing-indicator');
    const typingText = document.getElementById('typing-text');
    if (currentlyTyping.size > 0) {
        const names = Array.from(currentlyTyping).join(', ');
        onlineUsersText.textContent = `${names} is typing...`;
        onlineUsersText.classList.add('typing-text-active');
        if (typingBanner && typingText) {
            typingText.textContent = `${names} is typing...`;
            typingBanner.classList.remove('hidden');
        }
    } else {
        onlineUsersText.textContent = baseOnlineText;
        onlineUsersText.classList.remove('typing-text-active');
        if (typingBanner) typingBanner.classList.add('hidden');
    }
}

socket.on('room users', (usersList) => {
    if (usersList.length <= 1) { baseOnlineText = "Only you are here"; } else { baseOnlineText = "Online: You, " + usersList.filter(u => u !== currentUser.name).join(', '); }
    updateHeaderSubtitle();
});

socket.on('user typing', (data) => { if (data.isTyping) currentlyTyping.add(data.name); else currentlyTyping.delete(data.name); updateHeaderSubtitle(); });

[createRoomModal, passwordModal, msgOptionsModal, viewProfileModal, groupInfoModal, createPollModal, appSettingsModal].forEach(modal => {
    modal.addEventListener('click', (e) => { if(e.target === modal) modal.classList.add('hidden'); });
});

function updateGroupHeader(room) { currentRoomName.textContent = room.name; currentRoomLogo.src = room.logo || `https://api.dicebear.com/7.x/shapes/svg?seed=${room.id}`; }
socket.on('group info updated', updateGroupHeader);

headerClickArea.onclick = () => { hapticFeedback('light'); infoRoomLogo.src = currentRoomLogo.src; infoRoomName.value = currentRoomName.textContent; groupInfoModal.classList.remove('hidden'); };
document.getElementById('save-group-info-btn').onclick = () => { const newName = infoRoomName.value.trim(); if(newName) { socket.emit('update group info', { roomId: activeRoomId, name: newName }); groupInfoModal.classList.add('hidden'); } };
groupPicUpload.addEventListener('change', function() { if (this.files[0]) { const reader = new FileReader(); reader.onload = (e) => { infoRoomLogo.src = e.target.result; socket.emit('update group info', { roomId: activeRoomId, logo: e.target.result }); }; reader.readAsDataURL(this.files[0]); } });

document.getElementById('btn-change-wallpaper').onclick = () => wallpaperUpload.click();
wallpaperUpload.addEventListener('change', function() { if (this.files[0]) { const reader = new FileReader(); reader.onload = (e) => { localStorage.setItem('wallpaper_' + activeRoomId, e.target.result); chatScreen.style.backgroundImage = `url(${e.target.result})`; groupInfoModal.classList.add('hidden'); }; reader.readAsDataURL(this.files[0]); } });
document.getElementById('btn-reset-wallpaper').onclick = () => { localStorage.removeItem('wallpaper_' + activeRoomId); chatScreen.style.backgroundImage = ''; groupInfoModal.classList.add('hidden'); };

document.getElementById('btn-open-search').onclick = () => { groupInfoModal.classList.add('hidden'); chatSearchContainer.classList.remove('hidden'); chatSearchInput.focus(); };
document.getElementById('close-search-btn').onclick = () => { chatSearchContainer.classList.add('hidden'); chatSearchInput.value = ''; document.querySelectorAll('#messages li').forEach(li => { li.style.display = 'flex'; const txtNode = li.querySelector('.message-text'); if(txtNode) txtNode.innerHTML = txtNode.innerHTML.replace(/<span class="highlight">(.*?)<\/span>/g, '$1'); }); };

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

ghostBtn.onclick = () => { hapticFeedback('medium'); isGhostMode = !isGhostMode; ghostBtn.classList.toggle('active', isGhostMode); };

function updatePollOptionNumbers() {
    const rows = pollOptionsContainer.querySelectorAll('.poll-opt-row');
    const badge = document.getElementById('poll-count-badge');
    if (badge) badge.textContent = `${rows.length} / 8`;
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
    if (currentRows.length >= 8) {
        alert('Maximum 8 options allowed per poll!');
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
        const pollData = { question: q, options: opts.map(o => ({ text: o, votes: [] })) };
        socket.emit('chat message', {
            user: currentUser.name,
            avatar: currentUser.avatar,
            color: currentUser.color,
            text: '',
            poll: pollData,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isGhost: isGhostMode
        });
        createPollModal.classList.add('hidden');
        resetPollForm();
    } else {
        alert('Please enter a question and at least 2 options!');
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

input.addEventListener('input', () => { 
    if (editingMsgId) { 
        setSendBtnState('check'); 
    } else if (input.value.trim() || activeRoomId === 'ai_lounge') { 
        setSendBtnState('send'); 
    } else { 
        setSendBtnState('mic'); 
    }

    if (!typingSent) {
        socket.emit('typing', true);
        typingSent = true;
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('typing', false);
        typingSent = false;
    }, 1500);
});

// ==========================
// ✅ SEND MESSAGE FIX
// ==========================
function sendMessage() {
    const text = input.value.trim();
    if (!text && !editingMsgId && activeRoomId !== 'ai_lounge') return;

    socket.emit('typing', false); 

    if (editingMsgId) { 
        socket.emit('edit message', { msgId: editingMsgId, newText: text }); 
        editingMsgId = null;
    } else { 
        socket.emit('chat message', { 
            user: currentUser.name, 
            avatar: currentUser.avatar, 
            color: currentUser.color, 
            text, 
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
            replyTo: replyingTo, 
            isGhost: isGhostMode 
        }); 
        playUiSound('send');
    }

    input.value = ''; 
    setSendBtnState(activeRoomId === 'ai_lounge' ? 'send' : 'mic'); 
    replyingTo = null; 
    replyPreviewContainer.classList.add('hidden');
}

input.addEventListener('keypress', (e) => { 
    if (e.key === 'Enter') { 
        e.preventDefault(); 
        sendMessage(); 
    } 
});

// ==========================
// ✅ SAFE FILE UPLOAD CHECK
// ==========================
attachBtn.onclick = () => { hapticFeedback('light'); imageUpload.click(); };
imageUpload.addEventListener('change', function() {
    if (this.files[0]) {
        const file = this.files[0];
        
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            alert('Unsupported file type!');
            return;
        }

        hapticFeedback('heavy'); const reader = new FileReader(); 
        reader.onload = (e) => {
            const fileData = e.target.result;
            if (file.type.startsWith('video/')) {
                if (file.size > 20 * 1024 * 1024) return alert('Video is too large! Limit is 20MB.');
                socket.emit('chat message', { user: currentUser.name, avatar: currentUser.avatar, color: currentUser.color, text: '', uploadedImage: fileData, isVideo: true, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isGhost: isGhostMode });
            } else if (file.type === 'image/gif') {
                socket.emit('chat message', { user: currentUser.name, avatar: currentUser.avatar, color: currentUser.color, text: '', uploadedImage: fileData, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isGhost: isGhostMode });
            } else {
                const img = new Image(); img.src = fileData;
                img.onload = () => {
                    const canvas = document.createElement('canvas'); let w = img.width, h = img.height;
                    if(w > 600) { h *= 600/w; w = 600; } canvas.width = w; canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    socket.emit('chat message', { user: currentUser.name, avatar: currentUser.avatar, color: currentUser.color, text: '', uploadedImage: canvas.toDataURL('image/jpeg', 0.8), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), isGhost: isGhostMode });
                };
            }
            imageUpload.value = '';
        }; 
        reader.readAsDataURL(file);
    }
});

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
    btn.onclick = (e) => { hapticFeedback('light'); socket.emit('react message', { msgId: selectedMsgId, emoji: e.target.innerText }); msgOptionsModal.classList.add('hidden'); };
});

document.getElementById('opt-delete').onclick = () => { socket.emit('delete message', selectedMsgId); msgOptionsModal.classList.add('hidden'); };
document.getElementById('opt-pin').onclick = () => { const li = document.getElementById(`msg-${selectedMsgId}`); socket.emit('pin message', { msg: { user: li.dataset.sender, text: li.querySelector('.message-text')?.innerText || 'Attachment' }}); msgOptionsModal.classList.add('hidden'); };

document.getElementById('opt-star').onclick = () => {
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
    msgOptionsModal.classList.add('hidden');
};

document.getElementById('btn-view-starred').onclick = () => {
    groupInfoModal.classList.add('hidden');
    const listEl = document.getElementById('starred-messages-list');
    let starred = JSON.parse(localStorage.getItem('starred_messages_' + activeRoomId) || '[]');
    if (starred.length === 0) {
        listEl.innerHTML = `<p style="text-align: center; color: var(--text-secondary); font-size: 13.5px; padding: 20px 0;">No starred messages yet. Long-press any message to star it! ⭐</p>`;
    } else {
        listEl.innerHTML = starred.map(m => `
            <div class="starred-item-card" onclick="document.getElementById('starred-messages-modal').classList.add('hidden'); scrollToQuoteMessage('msg-${m.id}')" style="background: var(--input-bg); padding: 10px 14px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: var(--accent);">
                    <span>${escapeHTML(m.user)}</span>
                    <span style="color: var(--text-secondary); font-size: 11px;">${escapeHTML(m.time)}</span>
                </div>
                <div style="font-size: 13.5px; color: var(--text-primary);">${escapeHTML(m.text)}</div>
            </div>
        `).join('');
    }
    document.getElementById('starred-messages-modal').classList.remove('hidden');
};

document.getElementById('close-starred-modal-btn').onclick = () => {
    document.getElementById('starred-messages-modal').classList.add('hidden');
};

const scrollBottomBtn = document.getElementById('scroll-bottom-btn');
const unreadBadge = document.getElementById('unread-count-badge');
let unreadScrolledCount = 0;

if (scrollBottomBtn) {
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

    scrollBottomBtn.onclick = () => {
        hapticFeedback('light');
        messages.scrollTo({ top: messages.scrollHeight, behavior: 'smooth' });
        unreadScrolledCount = 0;
        if (unreadBadge) unreadBadge.classList.add('hidden');
    };
}
document.getElementById('opt-edit').onclick = () => { const li = document.getElementById(`msg-${selectedMsgId}`); input.value = li.querySelector('.message-text').innerText.replace('(edited)', '').trim(); editingMsgId = selectedMsgId; sendMicBtn.innerHTML = '✔'; input.focus(); msgOptionsModal.classList.add('hidden'); };
document.getElementById('opt-reply').onclick = () => { 
    const li = document.getElementById(`msg-${selectedMsgId}`); 
    triggerReplyForMessage(li);
    msgOptionsModal.classList.add('hidden'); 
};
document.getElementById('cancel-reply-btn').onclick = () => { replyingTo = null; replyPreviewContainer.classList.add('hidden'); };
document.getElementById('unpin-btn').onclick = () => socket.emit('unpin message');

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
    
    if (data.user !== currentUser.name && document.hidden) {
        if (window.Capacitor && Capacitor.Plugins.LocalNotifications) {
            Capacitor.Plugins.LocalNotifications.schedule({
                notifications: [{ title: `${data.user} in ${currentRoomName.textContent}`, body: data.text || "Sent an attachment", id: Math.floor(Math.random() * 100000), schedule: { at: new Date(Date.now() + 100) } }]
            });
        }
    }
    if (!document.hidden && activeRoomId && data.user !== currentUser.name) socket.emit('mark read');
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

socket.on('message edited', (data) => { const el = document.getElementById(`msg-${data.id}`); if (el) { const textNode = el.querySelector('.message-text'); textNode.innerHTML = escapeHTML(data.newText) + `<span class="edited-tag">(edited)</span>`; } });

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
        let totalVotes = data.poll.options.reduce((sum, opt) => sum + (opt.votes ? opt.votes.length : 0), 0);
        let userVotedOptIdx = -1;
        data.poll.options.forEach((opt, idx) => {
            if (opt.votes && opt.votes.includes(currentUser.name)) {
                userVotedOptIdx = idx;
            }
        });
        let maxVotes = Math.max(...data.poll.options.map(o => o.votes ? o.votes.length : 0));

        let pollOptsHTML = data.poll.options.map((opt, idx) => {
            let voteCount = opt.votes ? opt.votes.length : 0;
            let percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
            let isSelected = idx === userVotedOptIdx;
            let isWinning = totalVotes > 0 && voteCount === maxVotes;

            return `
                <button class="poll-option-btn ${isSelected ? 'selected-option' : ''} ${isWinning ? 'winning-option' : ''}" data-msgid="${data.id}" data-optidx="${idx}">
                    <div class="poll-bar" style="width: ${percent}%;"></div>
                    <div class="poll-text-row">
                        <div class="poll-opt-left">
                            <span class="poll-radio-icon">${isSelected ? '✅' : '⚪'}</span>
                            <span class="poll-opt-text">${escapeHTML(opt.text)}</span>
                        </div>
                        <div class="poll-opt-right">
                            <span class="poll-opt-count">${percent}% ${voteCount > 0 ? `(${voteCount})` : ''}</span>
                        </div>
                    </div>
                </button>
            `;
        }).join('');

        content = `
            <div class="poll-card">
                <div class="poll-header">
                    <span class="poll-badge">POLL</span>
                    <div class="poll-question">${escapeHTML(data.poll.question)}</div>
                </div>
                <div class="poll-options-list">${pollOptsHTML}</div>
                <div class="poll-footer">
                    <span class="poll-total-votes">👥 ${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'}</span>
                    <span class="poll-vote-status">${userVotedOptIdx !== -1 ? '✓ Voted' : 'Tap option to vote'}</span>
                </div>
            </div>
        `;
    } 
    else if (data.uploadedImage) {
        if (data.isAudio) {
            content = `
                <div class="custom-audio-player" data-audio-src="${escapeHTML(data.uploadedImage)}">
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
        else if (data.isVideo) content = `<video src="${data.uploadedImage}" class="chat-video" controls playsinline></video>`;
        else content = `<img src="${data.uploadedImage}" class="chat-image">`;
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
function displayMessage(data, isHistory) {
    checkEmptyMessages();
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
    if (pollOpt) { hapticFeedback('light'); socket.emit('vote poll', { msgId: pollOpt.dataset.msgid, optionIndex: parseInt(pollOpt.dataset.optidx) }); return; }

    if(e.target.classList.contains('chat-image')) { document.getElementById('lightbox-img').src = e.target.src; document.getElementById('lightbox').classList.remove('hidden'); } 
    if(e.target.classList.contains('avatar-small')) { const friendName = e.target.dataset.name; socket.emit('get user info', friendName); }
});

// Lobby search filter
const lobbySearchInput = document.getElementById('lobby-search-input');
if (lobbySearchInput) {
    lobbySearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const items = roomsUl.querySelectorAll('.room-item');
        items.forEach(item => {
            const name = item.querySelector('.room-name').textContent.toLowerCase();
            const status = item.querySelector('.room-status').textContent.toLowerCase();
            if (name.includes(query) || status.includes(query)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });
}

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
        const sendMicIcon = document.getElementById('send-mic-icon');
        if (sendMicIcon) sendMicIcon.textContent = '➤';
    });
});

const availableThemes = ['light', 'dark', 'pink']; let currentThemeIndex = 0;
const savedTheme = localStorage.getItem('chitchat_theme') || 'light';
currentThemeIndex = availableThemes.indexOf(savedTheme); if(currentThemeIndex === -1) currentThemeIndex = 0;
applyTheme(availableThemes[currentThemeIndex]);

document.getElementById('btn-theme-cycle').onclick = () => {
    hapticFeedback('light'); currentThemeIndex = (currentThemeIndex + 1) % availableThemes.length;
    const newTheme = availableThemes[currentThemeIndex]; applyTheme(newTheme); localStorage.setItem('chitchat_theme', newTheme);
};

function applyTheme(themeName) {
    document.body.setAttribute('data-theme', themeName);
    localStorage.setItem('chitchat_theme', themeName);
    const themeIcon = document.getElementById('theme-btn-icon');
    if (themeIcon) {
        if (themeName === 'dark') themeIcon.innerHTML = '🌙';
        else if (themeName === 'pink') themeIcon.innerHTML = '🌸';
        else themeIcon.innerHTML = '☀️';
    }
    document.querySelectorAll('.login-theme-pills .theme-pill').forEach(pill => {
        if (pill.dataset.themeChoice === themeName) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });
}

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
                        isGhost: isGhostMode 
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
        alert("Please allow Microphone access in your browser to send Voice Notes! 🎤"); 
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
    if (sendMicBtn.dataset.state === 'send' || sendMicBtn.dataset.state === 'check') {
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
