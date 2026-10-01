// Connects directly to local server!
const socket = io();

function hapticFeedback(type = 'light') {
    if (!navigator.vibrate) return;
    if (type === 'light') navigator.vibrate(30); 
    else if (type === 'medium') navigator.vibrate(50); 
    else if (type === 'heavy') navigator.vibrate([40, 60, 40]); 
}

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('data:image/') || trimmed.startsWith('blob:') || trimmed.startsWith('/')) {
        return trimmed;
    }
    return '';
}

function showToast(msg, options = {}) {
    let duration = 2200;
    let type = 'info';
    let sound = false;

    if (typeof options === 'number') {
        duration = options;
    } else if (typeof options === 'string') {
        type = options;
    } else if (typeof options === 'object' && options !== null) {
        if (options.duration) duration = options.duration;
        if (options.type) type = options.type;
        if (options.sound !== undefined) sound = options.sound;
    }

    let text = String(msg || '').trim();
    // Strip emojis completely from notification messages
    text = text.replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\u200d\ufe0f]/gu, '').replace(/\s+/g, ' ').trim();
    if (!text) return;

    let toast = document.getElementById('custom-app-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'custom-app-toast';
        document.body.appendChild(toast);
    }

    toast.className = `custom-toast-pill toast-${type}`;
    toast.innerHTML = `<span class="toast-message-text">${escapeHTML(text)}</span>`;

    if (sound) {
        try { playUiSound('pop'); } catch (e) {}
    }
    try { hapticFeedback('light'); } catch (e) {}

    toast.classList.remove('show');
    void toast.offsetWidth;
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
const btnOpenSearch = document.getElementById('btn-open-search');
const closeSearchBtn = document.getElementById('close-search-btn');
const wallpaperUpload = document.getElementById('wallpaper-upload');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');

let savedUserId = localStorage.getItem('chitchat_user_id');
if (!savedUserId) {
    savedUserId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('chitchat_user_id', savedUserId);
}

let currentUser = { id: savedUserId, name: '', avatar: '', about: 'Hey there! I am using Chit Chat.', color: '#dcf8c6' }; 
let activeRoomId = null;
let currentRoomPassword = ''; 
let replyingTo = null;
let selectedMsgId = null; 

let editingMsgId = null;
let isGhostMode = false;
let unreadCounts = {}; 
const defaultRooms = [
    { id: 'lobby', name: 'Lobby', logo: '/icon.svg', isPrivate: 0 },
    { id: 'ai_lounge', name: 'AI Lounge', logo: '/ai-icon.svg', isPrivate: 0 }
];
let globalRoomList = [...defaultRooms];
let currentlyTyping = new Map();
let baseOnlineText = "Tap to change info";

let typingTimeout;
let typingSent = false;
let globalAudio = null;
let globalAudioBtn = null;
let globalAudioFill = null;

// ==========================================================================
// App Passcode Lock & Security System
// ==========================================================================
const appLockTitle = document.getElementById('app-lock-title');
const appLockSubtitle = document.getElementById('app-lock-subtitle');
const lockIconContainer = document.getElementById('lock-icon-container');
const passcodeDotsBox = document.getElementById('passcode-dots-box');
const unlockAppBtn = document.getElementById('unlock-app-btn');
const keypadBioBtn = document.getElementById('keypad-bio-btn');
const keypadBackspaceBtn = document.getElementById('keypad-backspace-btn');

// Setup modal elements
const passcodeSetupModal = document.getElementById('passcode-setup-modal');
const passcodeSetupTitle = document.getElementById('passcode-setup-title');
const passcodeSetupDesc = document.getElementById('passcode-setup-desc');
const passcodeSetupDots = document.getElementById('passcode-setup-dots');
const closePasscodeSetupBtn = document.getElementById('close-passcode-setup-btn');
const setupKeypadCancelBtn = document.getElementById('setup-keypad-cancel-btn');
const setupKeypadBackspaceBtn = document.getElementById('setup-keypad-backspace-btn');
const changePasscodeBtn = document.getElementById('change-passcode-btn');
const appLockStatusSublabel = document.getElementById('app-lock-status-sublabel');
const toggleAppLock = document.getElementById('toggle-app-lock');
const toggleFingerprintUnlock = document.getElementById('toggle-fingerprint-unlock');
const setupFingerprintBtn = document.getElementById('setup-fingerprint-btn');
const fingerprintStatusSublabel = document.getElementById('fingerprint-status-sublabel');
const fingerprintSettingsRow = document.getElementById('fingerprint-settings-row');

let enteredPasscode = '';
let isAppLockedSession = false;
let isPromptingBiometrics = false;
let isVerifyingLock = false;

// Setup modal states: 'ENTER_OLD', 'ENTER_NEW', 'CONFIRM_NEW', 'VERIFY_DISABLE'
let setupMode = 'CREATE'; 
let setupStep = 'ENTER_NEW';
let setupFirstPin = '';
let setupCurrentInput = '';

function getStoredPasscode() {
    return localStorage.getItem('chitchat_passcode') || '1234';
}

function isAppLockActive() {
    return localStorage.getItem('chitchat_applock') === 'true';
}

function isBiometricEnabled() {
    return localStorage.getItem('chitchat_fingerprint') === 'true';
}

async function checkDeviceBiometricSupport() {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NativeBiometric) {
        return { supported: true, type: 'capacitor' };
    }
    if (window.PublicKeyCredential && typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        try {
            const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            if (available) {
                return { supported: true, type: 'webauthn' };
            }
        } catch(e) {
            console.warn('WebAuthn check error:', e);
        }
    }
    return { supported: false, type: 'none' };
}

async function updateBiometricSettingsUI() {
    const bioInfo = await checkDeviceBiometricSupport();
    const isEnrolled = isBiometricEnabled();

    if (toggleFingerprintUnlock) {
        toggleFingerprintUnlock.checked = isEnrolled;
    }

    if (fingerprintStatusSublabel) {
        if (!bioInfo.supported) {
            fingerprintStatusSublabel.textContent = 'No biometric sensor detected on this device';
            if (toggleFingerprintUnlock) toggleFingerprintUnlock.disabled = true;
        } else if (isEnrolled) {
            fingerprintStatusSublabel.textContent = 'Fingerprint active (Touch sensor to unlock)';
            if (toggleFingerprintUnlock) toggleFingerprintUnlock.disabled = false;
        } else {
            fingerprintStatusSublabel.textContent = 'Hardware sensor available (Tap toggle to enable)';
            if (toggleFingerprintUnlock) toggleFingerprintUnlock.disabled = false;
        }
    }
}

function updateAppLockSettingsUI() {
    const active = isAppLockActive();
    if (toggleAppLock) toggleAppLock.checked = active;
    if (changePasscodeBtn) {
        if (active) changePasscodeBtn.classList.remove('hidden');
        else changePasscodeBtn.classList.add('hidden');
    }
    if (appLockStatusSublabel) {
        if (active) appLockStatusSublabel.textContent = 'PIN Protection Active (Tap Change PIN to update)';
        else appLockStatusSublabel.textContent = 'Protect chats with a 4-digit PIN';
    }
    updateBiometricSettingsUI();
}

function renderPasscodeDots(containerEl, length) {
    if (!containerEl) return;
    const dots = containerEl.querySelectorAll('.passcode-dot');
    dots.forEach((dot, idx) => {
        if (idx < length) dot.classList.add('filled');
        else dot.classList.remove('filled');
    });
}

function shakePasscodeDots(containerEl) {
    if (!containerEl) return;
    containerEl.classList.remove('shake');
    void containerEl.offsetWidth;
    containerEl.classList.add('shake');
    try { hapticFeedback('heavy'); } catch(e) {}
    setTimeout(() => {
        containerEl.classList.remove('shake');
    }, 460);
}

function lockApp(autoBiometric = true) {
    if (!isAppLockActive()) return;
    isAppLockedSession = true;
    enteredPasscode = '';
    renderPasscodeDots(passcodeDotsBox, 0);
    if (appLockSubtitle) {
        appLockSubtitle.textContent = 'Enter your 4-digit passcode';
        appLockSubtitle.classList.remove('error');
    }
    if (lockIconContainer) lockIconContainer.classList.remove('unlocked');
    if (appLockScreen) {
        appLockScreen.classList.remove('hidden', 'unlocking');
    }

    // Auto-prompt fingerprint scanner if biometric unlock is enabled
    if (autoBiometric && isBiometricEnabled()) {
        setTimeout(() => {
            verifyBiometrics(true);
        }, 360);
    }
}

function unlockAppSuccess() {
    isAppLockedSession = false;
    try { hapticFeedback('heavy'); } catch(e) {}
    try { playUiSound('unlock'); } catch(e) {}
    if (appLockSubtitle) {
        appLockSubtitle.textContent = 'Unlocked! Welcome back';
        appLockSubtitle.classList.remove('error');
    }
    if (lockIconContainer) lockIconContainer.classList.add('unlocked');
    if (appLockScreen) appLockScreen.classList.add('unlocking');

    setTimeout(() => {
        if (appLockScreen) {
            appLockScreen.classList.add('hidden');
            appLockScreen.classList.remove('unlocking');
        }
        if (lockIconContainer) lockIconContainer.classList.remove('unlocked');
        if (appLockSubtitle) appLockSubtitle.textContent = 'Enter your 4-digit passcode';
        enteredPasscode = '';
        renderPasscodeDots(passcodeDotsBox, 0);
        isVerifyingLock = false;
    }, 320);
}

function handleLockKeypress(key) {
    if (isVerifyingLock) return;
    if (key >= '0' && key <= '9') {
        if (enteredPasscode.length < 4) {
            enteredPasscode += key;
            try { hapticFeedback('light'); } catch(e) {}
            try { playUiSound('tap'); } catch(e) {}
            renderPasscodeDots(passcodeDotsBox, enteredPasscode.length);
            if (enteredPasscode.length === 4) {
                checkEnteredPasscode();
            }
        }
    }
}

function handleLockBackspace() {
    if (isVerifyingLock) return;
    if (enteredPasscode.length > 0) {
        enteredPasscode = enteredPasscode.slice(0, -1);
        try { hapticFeedback('light'); } catch(e) {}
        try { playUiSound('tap'); } catch(e) {}
        try { hapticFeedback('light'); } catch(e) {}
        renderPasscodeDots(passcodeDotsBox, enteredPasscode.length);
    }
}

function checkEnteredPasscode() {
    isVerifyingLock = true;
    const correctPin = getStoredPasscode();
    if (enteredPasscode === correctPin) {
        unlockAppSuccess();
    } else {
        shakePasscodeDots(passcodeDotsBox);
        if (appLockSubtitle) {
            appLockSubtitle.textContent = 'Incorrect passcode. Try again';
            appLockSubtitle.classList.add('error');
        }
        setTimeout(() => {
            enteredPasscode = '';
            renderPasscodeDots(passcodeDotsBox, 0);
            isVerifyingLock = false;
        }, 460);
        setTimeout(() => {
            if (appLockSubtitle && !isVerifyingLock && enteredPasscode.length === 0) {
                appLockSubtitle.textContent = 'Enter your 4-digit passcode';
                appLockSubtitle.classList.remove('error');
            }
        }, 2000);
    }
}

async function registerWebAuthnBiometric() {
    if (!window.PublicKeyCredential) {
        throw new Error('WebAuthn not supported');
    }
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    const userName = (currentUser && currentUser.name) ? currentUser.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '') : 'chitchat_user';

    const credential = await navigator.credentials.create({
        publicKey: {
            challenge: challenge,
            rp: {
                name: 'Chit Chat',
                id: window.location.hostname
            },
            user: {
                id: userId,
                name: userName || 'chitchat_user',
                displayName: (currentUser && currentUser.name) || 'Chit Chat User'
            },
            pubKeyCredParams: [
                { alg: -7, type: 'public-key' },  // ES256
                { alg: -257, type: 'public-key' } // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: 'platform', // Built-in fingerprint / Touch ID / Windows Hello
                userVerification: 'required',
                residentKey: 'preferred'
            },
            timeout: 60000
        }
    });

    if (credential && credential.id) {
        localStorage.setItem('chitchat_bio_cred_id', credential.id);
        return true;
    }
    return false;
}

async function verifyBiometrics(isAutoPrompt = false) {
    if (isPromptingBiometrics || isVerifyingLock) return;

    const bioInfo = await checkDeviceBiometricSupport();

    // 1. Capacitor Native Biometric
    if (bioInfo.type === 'capacitor') {
        isPromptingBiometrics = true;
        try {
            await window.Capacitor.Plugins.NativeBiometric.verifyIdentity({
                reason: 'Scan your fingerprint to unlock Chit Chat',
                title: 'Unlock Chit Chat'
            });
            unlockAppSuccess();
            return;
        } catch(e) {
            console.warn('Native biometric error or cancel', e);
            if (!isAutoPrompt) {
                showToast('Biometric scan cancelled. Enter your 4-digit PIN');
            }
        } finally {
            setTimeout(() => { isPromptingBiometrics = false; }, 800);
        }
        return;
    }

    // 2. Web Authentication API (Fingerprint / Touch ID / Windows Hello)
    if (bioInfo.type === 'webauthn') {
        isPromptingBiometrics = true;
        try {
            const challenge = new Uint8Array(32);
            crypto.getRandomValues(challenge);

            const savedCredId = localStorage.getItem('chitchat_bio_cred_id');
            const getOptions = {
                publicKey: {
                    challenge: challenge,
                    rpId: window.location.hostname,
                    userVerification: 'required',
                    timeout: 60000
                }
            };

            if (savedCredId) {
                try {
                    const rawId = Uint8Array.from(atob(savedCredId.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
                    getOptions.publicKey.allowCredentials = [{
                        type: 'public-key',
                        id: rawId,
                        transports: ['internal']
                    }];
                } catch(e) {}
            }

            let assertion = null;
            try {
                assertion = await navigator.credentials.get(getOptions);
            } catch (err) {
                // If never registered on this device, prompt to register first
                if (!savedCredId && !isAutoPrompt) {
                    showToast('Touch your fingerprint sensor to register...');
                    const registered = await registerWebAuthnBiometric();
                    if (registered) {
                        localStorage.setItem('chitchat_fingerprint', 'true');
                        updateBiometricSettingsUI();
                        showToast('Fingerprint registered. Unlocking...');
                        unlockAppSuccess();
                        return;
                    }
                }
                throw err;
            }

            if (assertion) {
                unlockAppSuccess();
                return;
            }
        } catch (err) {
            console.warn('WebAuthn biometric error:', err);
            if (err.name === 'NotAllowedError') {
                if (!isAutoPrompt) showToast('Fingerprint cancelled. Enter your 4-digit PIN');
            } else if (err.name === 'SecurityError') {
                if (!isAutoPrompt) showToast('Biometrics require localhost or HTTPS');
            } else {
                if (!isAutoPrompt) showToast('Fingerprint unavailable. Enter your 4-digit PIN');
            }
        } finally {
            setTimeout(() => { isPromptingBiometrics = false; }, 800);
        }
        return;
    }

    // 3. Fallback when hardware sensor is not available
    if (!isAutoPrompt) {
        showToast('No fingerprint sensor detected on this device. Use your 4-digit PIN');
    }
}

// Bind lock keypad clicks
const lockKeypadButtons = document.querySelectorAll('.lock-keypad-grid .keypad-key[data-key]');
lockKeypadButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const key = btn.getAttribute('data-key');
        if (key !== null) handleLockKeypress(key);
    });
});

if (keypadBackspaceBtn) {
    keypadBackspaceBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleLockBackspace();
    });
}

if (keypadBioBtn) {
    keypadBioBtn.addEventListener('click', (e) => {
        e.preventDefault();
        verifyBiometrics(false);
    });
}

if (unlockAppBtn) {
    unlockAppBtn.addEventListener('click', (e) => {
        e.preventDefault();
        verifyBiometrics(false);
    });
}

if (lockIconContainer) {
    lockIconContainer.addEventListener('click', (e) => {
        e.preventDefault();
        verifyBiometrics(false);
    });
}

// Physical keyboard listener for lock screen
window.addEventListener('keydown', (e) => {
    if (appLockScreen && !appLockScreen.classList.contains('hidden')) {
        if (e.key >= '0' && e.key <= '9') {
            handleLockKeypress(e.key);
        } else if (e.key === 'Backspace') {
            handleLockBackspace();
        } else if (e.key === 'Escape') {
            enteredPasscode = '';
            renderPasscodeDots(passcodeDotsBox, 0);
        }
    }
});

// Setup Modal Logic
function openPasscodeSetup(mode = 'CREATE') {
    setupMode = mode;
    setupCurrentInput = '';
    setupFirstPin = '';
    renderPasscodeDots(passcodeSetupDots, 0);

    if (mode === 'CREATE') {
        setupStep = 'ENTER_NEW';
        if (passcodeSetupTitle) passcodeSetupTitle.textContent = 'Set 4-Digit Passcode';
        if (passcodeSetupDesc) passcodeSetupDesc.textContent = 'Choose a 4-digit PIN to secure your Chit Chat lobby';
    } else if (mode === 'CHANGE') {
        setupStep = 'ENTER_OLD';
        if (passcodeSetupTitle) passcodeSetupTitle.textContent = 'Enter Current PIN';
        if (passcodeSetupDesc) passcodeSetupDesc.textContent = 'Please enter your current 4-digit PIN first';
    } else if (mode === 'DISABLE') {
        setupStep = 'VERIFY_DISABLE';
        if (passcodeSetupTitle) passcodeSetupTitle.textContent = 'Turn Off Passcode';
        if (passcodeSetupDesc) passcodeSetupDesc.textContent = 'Enter your 4-digit PIN to turn off App Lock';
    }

    if (passcodeSetupModal) passcodeSetupModal.classList.remove('hidden');
}

function closePasscodeSetup() {
    if (passcodeSetupModal) passcodeSetupModal.classList.add('hidden');
    setupCurrentInput = '';
    setupFirstPin = '';
    renderPasscodeDots(passcodeSetupDots, 0);
    updateAppLockSettingsUI();
}

function handleSetupKeypress(key) {
    if (key >= '0' && key <= '9') {
        if (setupCurrentInput.length < 4) {
            setupCurrentInput += key;
            try { hapticFeedback('light'); } catch(e) {}
            renderPasscodeDots(passcodeSetupDots, setupCurrentInput.length);
            if (setupCurrentInput.length === 4) {
                processSetupStep();
            }
        }
    }
}

function handleSetupBackspace() {
    if (setupCurrentInput.length > 0) {
        setupCurrentInput = setupCurrentInput.slice(0, -1);
        try { hapticFeedback('light'); } catch(e) {}
        renderPasscodeDots(passcodeSetupDots, setupCurrentInput.length);
    }
}

function processSetupStep() {
    const currentStored = getStoredPasscode();

    if (setupStep === 'ENTER_OLD') {
        if (setupCurrentInput === currentStored) {
            try { hapticFeedback('medium'); } catch(e) {}
            setupStep = 'ENTER_NEW';
            setupCurrentInput = '';
            renderPasscodeDots(passcodeSetupDots, 0);
            if (passcodeSetupTitle) passcodeSetupTitle.textContent = 'Enter New PIN';
            if (passcodeSetupDesc) passcodeSetupDesc.textContent = 'Choose your new 4-digit passcode';
        } else {
            shakePasscodeDots(passcodeSetupDots);
            if (passcodeSetupDesc) passcodeSetupDesc.textContent = 'Incorrect current PIN. Try again';
            setTimeout(() => {
                setupCurrentInput = '';
                renderPasscodeDots(passcodeSetupDots, 0);
            }, 450);
        }
    } else if (setupStep === 'ENTER_NEW') {
        try { hapticFeedback('light'); } catch(e) {}
        setupFirstPin = setupCurrentInput;
        setupCurrentInput = '';
        setupStep = 'CONFIRM_NEW';
        renderPasscodeDots(passcodeSetupDots, 0);
        if (passcodeSetupTitle) passcodeSetupTitle.textContent = 'Confirm Passcode';
        if (passcodeSetupDesc) passcodeSetupDesc.textContent = 'Re-enter the 4-digit PIN to confirm';
    } else if (setupStep === 'CONFIRM_NEW') {
        if (setupCurrentInput === setupFirstPin) {
            try { hapticFeedback('heavy'); } catch(e) {}
            localStorage.setItem('chitchat_passcode', setupFirstPin);
            localStorage.setItem('chitchat_applock', 'true');
            updateAppLockSettingsUI();
            showToast('Passcode saved');
            closePasscodeSetup();
        } else {
            shakePasscodeDots(passcodeSetupDots);
            if (passcodeSetupDesc) passcodeSetupDesc.textContent = 'PINs did not match! Setting restarted';
            setTimeout(() => {
                setupCurrentInput = '';
                setupFirstPin = '';
                setupStep = 'ENTER_NEW';
                renderPasscodeDots(passcodeSetupDots, 0);
                if (passcodeSetupTitle) passcodeSetupTitle.textContent = 'Set 4-Digit Passcode';
            }, 600);
        }
    } else if (setupStep === 'VERIFY_DISABLE') {
        if (setupCurrentInput === currentStored) {
            try { hapticFeedback('medium'); } catch(e) {}
            localStorage.setItem('chitchat_applock', 'false');
            updateAppLockSettingsUI();
            showToast('Passcode lock turned off');
            closePasscodeSetup();
        } else {
            shakePasscodeDots(passcodeSetupDots);
            if (passcodeSetupDesc) passcodeSetupDesc.textContent = 'Incorrect PIN. Lock remains active';
            setTimeout(() => {
                setupCurrentInput = '';
                renderPasscodeDots(passcodeSetupDots, 0);
            }, 450);
        }
    }
}

// Bind setup keypad buttons
const setupKeypadButtons = document.querySelectorAll('.passcode-modal-keypad .setup-keypad-key[data-key]');
setupKeypadButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const key = btn.getAttribute('data-key');
        if (key !== null) handleSetupKeypress(key);
    });
});

if (setupKeypadBackspaceBtn) {
    setupKeypadBackspaceBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleSetupBackspace();
    });
}

if (setupKeypadCancelBtn) {
    setupKeypadCancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        closePasscodeSetup();
    });
}

if (closePasscodeSetupBtn) {
    closePasscodeSetupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        closePasscodeSetup();
    });
}

// Settings Toggle & Change PIN button
if (toggleAppLock) {
    updateAppLockSettingsUI();
    toggleAppLock.addEventListener('change', (e) => {
        if (e.target.checked) {
            if (!localStorage.getItem('chitchat_passcode')) {
                openPasscodeSetup('CREATE');
            } else {
                localStorage.setItem('chitchat_applock', 'true');
                updateAppLockSettingsUI();
                showToast('Passcode lock enabled');
            }
        } else {
            // Require entering current passcode to disable!
            e.target.checked = true; // keep checked until confirmed
            openPasscodeSetup('DISABLE');
        }
    });
}

if (changePasscodeBtn) {
    changePasscodeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openPasscodeSetup('CHANGE');
    });
}

if (toggleFingerprintUnlock) {
    toggleFingerprintUnlock.addEventListener('change', async (e) => {
        if (e.target.checked) {
            const bioInfo = await checkDeviceBiometricSupport();
            if (!bioInfo.supported) {
                e.target.checked = false;
                showToast('No biometric sensor detected on this device');
                return;
            }

            // Ensure App Lock is enabled with PIN as fallback
            if (!isAppLockActive()) {
                if (!localStorage.getItem('chitchat_passcode')) {
                    showToast('Set a 4-digit PIN first');
                    e.target.checked = false;
                    openPasscodeSetup('CREATE');
                    return;
                }
                localStorage.setItem('chitchat_applock', 'true');
                updateAppLockSettingsUI();
            }

            if (bioInfo.type === 'webauthn' && !localStorage.getItem('chitchat_bio_cred_id')) {
                try {
                    showToast('Touch your fingerprint sensor to confirm...');
                    const success = await registerWebAuthnBiometric();
                    if (success) {
                        localStorage.setItem('chitchat_fingerprint', 'true');
                        updateBiometricSettingsUI();
                        showToast('Fingerprint unlock enabled');
                    } else {
                        e.target.checked = false;
                    }
                } catch(err) {
                    console.warn('Fingerprint registration failed', err);
                    e.target.checked = false;
                    showToast('Fingerprint setup cancelled or unavailable');
                }
            } else {
                localStorage.setItem('chitchat_fingerprint', 'true');
                updateBiometricSettingsUI();
                showToast('Fingerprint unlock enabled');
            }
        } else {
            localStorage.setItem('chitchat_fingerprint', 'false');
            updateBiometricSettingsUI();
            showToast('Fingerprint unlock disabled');
        }
    });
}

if (setupFingerprintBtn) {
    setupFingerprintBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            showToast('Touch your fingerprint sensor...');
            const success = await registerWebAuthnBiometric();
            if (success) {
                localStorage.setItem('chitchat_fingerprint', 'true');
                updateBiometricSettingsUI();
                showToast('Fingerprint registered');
            }
        } catch(err) {
            console.warn('Setup fingerprint error', err);
            showToast('Fingerprint registration cancelled');
        }
    });
}

function checkAppLockOnLaunch() {
    if (isAppLockActive()) {
        lockApp(true);
    }
}

// Capacitor and web lifecycle listeners
if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) { 
    try {
        window.Capacitor.Plugins.App.addListener('appStateChange', (state) => {
            if (state.isActive && isAppLockActive() && !isAppLockedSession) {
                lockApp();
            }
        });
    } catch(e) {} 
}

let awayTimestamp = 0;
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        awayTimestamp = Date.now();
    } else {
        if (isAppLockActive() && awayTimestamp > 0 && (Date.now() - awayTimestamp > 45000)) {
            lockApp();
        }
        awayTimestamp = 0;
    }
}); 

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
                copy.avatar = `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(copy.name || 'Alex')}`;
            }
            localStorage.setItem('chitchat_user', JSON.stringify(copy));
        } catch (e2) {
            console.error('LocalStorage error:', e2);
        }
    }
}

function syncUserAvatarUI() {
    if (!currentUser) return;
    const url = currentUser.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(currentUser.name || 'Alex')}`;
    
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
                this.src = `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(currentUser.name || 'Alex')}`;
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
    'doodle': {
        name: 'Chat Doodles',
        bgImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120' fill='none' stroke='rgba(148,163,184,0.24)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M15 26a8 8 0 0 1 8-8h14a8 8 0 0 1 8 8v5a8 8 0 0 1-8 8h-5l-7 5v-5h-2a8 8 0 0 1-8-8z'/%3E%3Cpath d='M72 32l24-12-11 23-4-9z'/%3E%3Cpath d='M72 32l9 2'/%3E%3Cpath d='M18 80h16v8a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7z'/%3E%3Cpath d='M34 82a3.5 3.5 0 0 1 0 7'/%3E%3Cpath d='M88 84a3.5 3.5 0 1 0-3.5-3.5v-12l13-3.5v12a3.5 3.5 0 1 0-3.5-3.5'/%3E%3Cpath d='M58 58c-2.5-3.5-7-2.5-7 1.5 0 3.5 7 7 7 7s7-3.5 7-7c0-4-4.5-5-7-1.5z'/%3E%3Cpath d='M58 12v6M55 15h6'/%3E%3Ccircle cx='104' cy='104' r='8'/%3E%3Ccircle cx='101.5' cy='102.5' r='.8' fill='rgba(148,163,184,0.24)'/%3E%3Ccircle cx='106.5' cy='102.5' r='.8' fill='rgba(148,163,184,0.24)'/%3E%3Cpath d='M101.5 106q2.5 2 5 0'/%3E%3Cpath d='M10 52l4 4 6-8'/%3E%3Cpath d='M68 96q6-4 12 0t12 0'/%3E%3C/svg%3E")`,
        bgSize: '120px 120px',
        bgRepeat: 'repeat'
    },
    'constellation': {
        name: 'Starry Sky',
        bgImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100' fill='none'%3E%3Cpath d='M20 12a11 11 0 1 0 11 11 9 9 0 0 1-11-11z' fill='rgba(168,85,247,0.22)' stroke='rgba(168,85,247,0.3)' stroke-width='1'/%3E%3Cpath d='M52 24l22 10 10-14m-10 14l-6 24-18 14m18-14l18 10' stroke='rgba(148,163,184,0.2)' stroke-width='1.2' stroke-dasharray='3 2'/%3E%3Ccircle cx='52' cy='24' r='2' fill='rgba(168,85,247,0.45)'/%3E%3Ccircle cx='74' cy='34' r='2.2' fill='rgba(148,85,247,0.5)'/%3E%3Ccircle cx='84' cy='20' r='1.8' fill='rgba(168,85,247,0.4)'/%3E%3Ccircle cx='68' cy='58' r='2' fill='rgba(168,85,247,0.45)'/%3E%3Ccircle cx='50' cy='72' r='1.8' fill='rgba(168,85,247,0.4)'/%3E%3Ccircle cx='86' cy='68' r='2.2' fill='rgba(168,85,247,0.5)'/%3E%3Cpath d='M16 60q0 6-6 6 6 0 6 6 0-6 6-6-6 0-6-6z' fill='rgba(234,179,8,0.35)'/%3E%3Cpath d='M38 42q0 4-4 4 4 0 4 4 0-4 4-4-4 0-4-4z' fill='rgba(234,179,8,0.28)'/%3E%3Ccircle cx='18' cy='88' r='1' fill='rgba(148,163,184,0.25)'/%3E%3Ccircle cx='82' cy='90' r='1.2' fill='rgba(148,163,184,0.25)'/%3E%3Ccircle cx='34' cy='18' r='1' fill='rgba(148,163,184,0.25)'/%3E%3C/svg%3E")`,
        bgSize: '100px 100px',
        bgRepeat: 'repeat'
    },
    'botanical': {
        name: 'Botanical',
        bgImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100' fill='none' stroke='rgba(34,197,94,0.26)' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M25 85q20-25 35-55'/%3E%3Cpath d='M36 68q-10-2-12-8 8-2 15 4'/%3E%3Cpath d='M42 56q10-4 15 2-4 8-12 4'/%3E%3Cpath d='M48 44q-9-3-10-9 8-1 13 5'/%3E%3Cpath d='M54 34q8-4 12 1-3 7-10 4'/%3E%3Cpath d='M80 82c-8-12-2-22 0-28 6 6 8 16 0 28z'/%3E%3Cpath d='M80 82l-5 8'/%3E%3Cpath d='M20 22c-4-4 2-10 6-6 4-4 10 2 6 6 4 4-2 10-6 6-4 4-10-2-6-6z'/%3E%3C/svg%3E")`,
        bgSize: '100px 100px',
        bgRepeat: 'repeat'
    },
    'cute-paws': {
        name: 'Paws & Pets',
        bgImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80' fill='rgba(244,63,94,0.22)'%3E%3Cellipse cx='26' cy='32' rx='6' ry='5'/%3E%3Ccircle cx='18' cy='22' r='2.5'/%3E%3Ccircle cx='23.5' cy='18' r='2.5'/%3E%3Ccircle cx='29' cy='18' r='2.5'/%3E%3Ccircle cx='34' cy='22' r='2.5'/%3E%3Cg transform='rotate(25 60 58)'%3E%3Cellipse cx='60' cy='58' rx='6' ry='5'/%3E%3Ccircle cx='52' cy='48' r='2.5'/%3E%3Ccircle cx='57.5' cy='44' r='2.5'/%3E%3Ccircle cx='63' cy='44' r='2.5'/%3E%3Ccircle cx='68' cy='48' r='2.5'/%3E%3C/g%3E%3Cpath d='M62 20c-2-3-6-2-6 1.5 0 3 6 6 6 6s6-3 6-6c0-3.5-4-4.5-6-1.5z'/%3E%3Cpath d='M16 64q2-6 8-6 6 0 8 6m-16-6l-3-4 6 1m10-1l6-1-3 4' fill='none' stroke='rgba(244,63,94,0.25)' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E")`,
        bgSize: '80px 80px',
        bgRepeat: 'repeat'
    },
    'cyber-grid': {
        name: 'Cyber Mesh',
        bgImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60' fill='none'%3E%3Cpath d='M0 30h60M30 0v60' stroke='rgba(56,189,248,0.18)' stroke-width='1'/%3E%3Cpath d='M26 30h8M30 26v8' stroke='rgba(56,189,248,0.45)' stroke-width='1.4'/%3E%3Ccircle cx='0' cy='0' r='2' fill='rgba(56,189,248,0.3)'/%3E%3Ccircle cx='60' cy='0' r='2' fill='rgba(56,189,248,0.3)'/%3E%3Ccircle cx='0' cy='60' r='2' fill='rgba(56,189,248,0.3)'/%3E%3Ccircle cx='60' cy='60' r='2' fill='rgba(56,189,248,0.3)'/%3E%3Cpath d='M8 8h6v6' stroke='rgba(56,189,248,0.25)' stroke-width='1'/%3E%3Cpath d='M52 52h-6v-6' stroke='rgba(56,189,248,0.25)' stroke-width='1'/%3E%3C/svg%3E")`,
        bgSize: '60px 60px',
        bgRepeat: 'repeat'
    },
    'waves': {
        name: 'Zen Waves',
        bgImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40' viewBox='0 0 80 40' fill='none' stroke='rgba(148,163,184,0.22)' stroke-width='1.2'%3E%3Cpath d='M0 40a40 40 0 0 1 80 0'/%3E%3Cpath d='M10 40a30 30 0 0 1 60 0'/%3E%3Cpath d='M20 40a20 20 0 0 1 40 0'/%3E%3Cpath d='M30 40a10 10 0 0 1 20 0'/%3E%3Cpath d='M-40 40a40 40 0 0 1 80 0'/%3E%3Cpath d='M-30 40a30 30 0 0 1 60 0'/%3E%3Cpath d='M-20 40a20 20 0 0 1 40 0'/%3E%3Cpath d='M-10 40a10 10 0 0 1 20 0'/%3E%3Cpath d='M40 0a40 40 0 0 1 80 0'/%3E%3Cpath d='M50 0a30 30 0 0 1 60 0'/%3E%3Cpath d='M60 0a20 20 0 0 1 40 0'/%3E%3Cpath d='M70 0a10 10 0 0 1 20 0'/%3E%3Cpath d='M-40 0a40 40 0 0 1 80 0'/%3E%3Cpath d='M-30 0a30 30 0 0 1 60 0'/%3E%3Cpath d='M-20 0a20 20 0 0 1 40 0'/%3E%3Cpath d='M-10 0a10 10 0 0 1 20 0'/%3E%3C/svg%3E")`,
        bgSize: '80px 40px',
        bgRepeat: 'repeat'
    },
    'tokyo-rain': {
        name: 'Tokyo Rain',
        bgImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80' fill='none' stroke='rgba(96,165,250,0.24)' stroke-width='1.3' stroke-linecap='round'%3E%3Cpath d='M18 6l-6 18M54 12l-6 18M76 34l-6 18M26 48l-6 18M62 58l-6 18'/%3E%3Cellipse cx='48' cy='32' rx='7' ry='2' stroke='rgba(96,165,250,0.22)'/%3E%3Cellipse cx='20' cy='68' rx='6' ry='1.8' stroke='rgba(96,165,250,0.22)'/%3E%3Ccircle cx='12' cy='25' r='1' fill='rgba(96,165,250,0.3)'/%3E%3Ccircle cx='56' cy='78' r='1' fill='rgba(96,165,250,0.3)'/%3E%3C/svg%3E")`,
        bgSize: '80px 80px',
        bgRepeat: 'repeat'
    },
    'cozy-cafe': {
        name: 'Cozy Cafe',
        bgImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80' fill='none' stroke='rgba(245,158,11,0.28)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M16 28h22v14a10 10 0 0 1-10 10h-2a10 10 0 0 1-10-10z' fill='rgba(245,158,11,0.08)'/%3E%3Cpath d='M38 32h5a4 4 0 0 1 0 8h-5'/%3E%3Cpath d='M22 18c1-4-1-6 0-10M30 18c1-4-1-6 0-10' stroke='rgba(251,191,36,0.25)' stroke-width='1.3'/%3E%3Cpath d='M58 24a7 5 30 1 0 1 7z' fill='rgba(245,158,11,0.22)' stroke='none'/%3E%3Cpath d='M56 22q4 5 1 10' stroke='rgba(254,243,199,0.25)' stroke-width='1'/%3E%3Cpath d='M50 56c6-4 14-2 18 4-4 6-12 5-18-4z' fill='rgba(245,158,11,0.1)' stroke='rgba(245,158,11,0.28)'/%3E%3Cpath d='M26 62c-2-3-6-2-6 1.5 0 3 6 6 6 6s6-3 6-6c0-3.5-4-4.5-6-1.5z' fill='rgba(245,158,11,0.14)' stroke='rgba(245,158,11,0.28)' stroke-width='1'/%3E%3C/svg%3E")`,
        bgSize: '80px 80px',
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
        const parsedUser = JSON.parse(savedUser);
        currentUser = { ...currentUser, ...parsedUser, id: savedUserId };
        if (currentUser.avatar && currentUser.avatar.includes('bottts')) {
            currentUser.avatar = `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(currentUser.name || 'Alex')}`;
        }
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
        const styles = ['lorelei', 'adventurer', 'personas', 'avataaars'];
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

// ========================================================
// 🌸 CUTE & WELL-OPTIMIZED APP OPENING ANIMATION CONTROLLER
// ========================================================
let appOpeningFinished = false;
let completeAppOpening = null;

function playAppOpeningAnimation() {
    const screen = document.getElementById('loading-screen');
    if (!screen) {
        appOpeningFinished = true;
        return;
    }

    const fillEl = document.getElementById('loading-progress-fill');
    const textEl = document.getElementById('loading-sub-text');
    const percentEl = document.getElementById('loading-percent-text');
    const logoBox = document.getElementById('loading-logo-box');

    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let isDismissed = false;

    function finishSequence() {
        if (isDismissed) return;
        isDismissed = true;
        appOpeningFinished = true;

        if (fillEl) fillEl.style.width = '100%';
        if (percentEl) percentEl.textContent = '100%';
        if (textEl) textEl.textContent = 'Ready';

        if (logoBox && !prefersReducedMotion) {
            logoBox.classList.add('pop-celebrate');
        }

        try {
            if (typeof hapticFeedback === 'function') hapticFeedback('light');
        } catch(e) {}

        const exitDelay = prefersReducedMotion ? 100 : 240;
        setTimeout(() => {
            screen.classList.add('fade-out');
            setTimeout(() => {
                screen.classList.add('hidden');
                screen.style.display = 'none';
                if (typeof checkAppLockOnLaunch === 'function') {
                    checkAppLockOnLaunch();
                }
            }, 420);
        }, exitDelay);
    }

    completeAppOpening = function() {
        if (!isDismissed) {
            setTimeout(finishSequence, 160);
        }
    };

    if (prefersReducedMotion) {
        finishSequence();
        return;
    }

    // Step 1: Initial state
    if (fillEl) fillEl.style.width = '18%';
    if (percentEl) percentEl.textContent = '18%';

    // Step 2: Mid-way (240ms)
    setTimeout(() => {
        if (isDismissed) return;
        if (fillEl) fillEl.style.width = '55%';
        if (percentEl) percentEl.textContent = '55%';
        if (textEl) textEl.textContent = 'Connecting...';
    }, 240);

    // Step 3: Almost there (540ms)
    setTimeout(() => {
        if (isDismissed) return;
        if (fillEl) fillEl.style.width = '90%';
        if (percentEl) percentEl.textContent = '90%';
        if (textEl) textEl.textContent = 'Loading chats...';
    }, 540);

    // Step 4: Standard finish (780ms)
    setTimeout(() => {
        finishSequence();
    }, 780);

    // Safety timeout: guaranteed dismiss by 1400ms max
    setTimeout(() => {
        finishSequence();
    }, 1400);
}

// Prepare starting route behind the opening curtain
function initAppView() {
    if (appOpeningFinished) {
        const lScreen = document.getElementById('loading-screen');
        if (lScreen) {
            lScreen.classList.add('hidden');
            lScreen.style.display = 'none';
        }
    }

    if (isAppLockActive()) {
        lockApp();
    }
    
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
        if (location.hash === '#settings') {
            if (roomListScreen) roomListScreen.classList.add('hidden');
            if (chatScreen) chatScreen.classList.add('hidden');
            if (profileScreen) profileScreen.classList.add('hidden');
            if (settingsScreen) settingsScreen.classList.remove('hidden');
            updateSettingsModalUI();
        } else {
            if (roomListScreen) roomListScreen.classList.remove('hidden');
            renderRoomList();
            try { history.replaceState({screen: 'lobby'}, '', '#lobby'); } catch(e){}
        }
    } else {
        if (loginScreen) loginScreen.classList.remove('hidden');
        if (roomListScreen) roomListScreen.classList.add('hidden');
        try { history.replaceState({screen: 'login'}, '', '#login'); } catch(e){}
    }
}

initAppView();
playAppOpeningAnimation();

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
            currentUser.avatar = `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(currentUser.name || 'Alex')}`; 
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
    
    if (cardAvatar) cardAvatar.src = currentUser.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(currentUser.name || 'Alex')}`;
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
        if (activeRoomId) {
            chatScreen.classList.remove('hidden');
            try { history.pushState({ screen: 'chat', roomId: activeRoomId }, '', '#chat'); } catch(e){}
        } else {
            roomListScreen.classList.remove('hidden');
            try { history.pushState({ screen: 'lobby' }, '', '#lobby'); } catch(e){}
        }
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
        showToast('Cache & temporary wallpapers cleared');
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
        const styles = ['lorelei', 'adventurer', 'personas', 'avataaars'];
        const randomStyle = styles[Math.floor(Math.random() * styles.length)];
        const newUrl = `https://api.dicebear.com/7.x/${randomStyle}/svg?seed=${randomSeed}`;
        currentUser.avatar = newUrl;
        
        syncUserAvatarUI();
        document.querySelectorAll('.avatar-preset-item').forEach(el => el.classList.remove('active'));
        saveUserLocally();
        if (socket) socket.emit('update profile', currentUser);
        showToast('Random avatar generated!');
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
const settingsProfileCard = document.getElementById('settings-profile-card');
function handleOpenProfile() {
    hapticFeedback('light');
    updateProfileScreenUI();
    if (settingsScreen) settingsScreen.classList.add('hidden');
    if (roomListScreen) roomListScreen.classList.add('hidden'); 
    if (profileScreen) profileScreen.classList.remove('hidden'); 
    try { history.pushState({screen: 'profile'}, '', '#profile'); } catch(e){}
}
if (btnOpenProfile) btnOpenProfile.onclick = handleOpenProfile;
if (settingsProfileCard) settingsProfileCard.onclick = handleOpenProfile;

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
    btnLogout.onclick = () => { if(confirm("Are you sure you want to completely reset the app and log out?")) { localStorage.clear(); window.location.reload(); } };
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
        if (chatSearchContainer) chatSearchContainer.classList.add('hidden');
        if (chatSearchInput) chatSearchInput.value = '';
        clearChatSearchHighlights();
        if (socket) socket.emit('leave room'); 
        activeRoomId = null; isGhostMode = false; 
        if (ghostBtn) ghostBtn.classList.remove('active'); 
        currentlyTyping.clear();
        try { history.pushState({screen: 'lobby'}, '', '#lobby'); } catch(e){}
    };
}

window.addEventListener('popstate', (e) => {
    const state = (e.state && e.state.screen) || (location.hash ? location.hash.replace('#', '') : 'lobby');
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
    } else if (state === 'lobby' || state === '') {
        if (chatSearchContainer) chatSearchContainer.classList.add('hidden');
        if (chatSearchInput) chatSearchInput.value = '';
        clearChatSearchHighlights();
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
        if (roomListScreen && !roomListScreen.classList.contains('hidden')) { if (confirm("Are you sure you want to exit Chit Chat?")) history.back(); else try { history.pushState({screen: 'lobby'}, '', '#lobby'); } catch(e){} 
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
        showToast('Profile updated successfully');
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
    if (typeof completeAppOpening === 'function') {
        completeAppOpening();
    } else if (loadingScreen) {
        loadingScreen.classList.add('hidden');
    }
    if (currentUser.name) { socket.emit('update profile', currentUser); loginScreen.classList.add('hidden'); roomListScreen.classList.remove('hidden'); }
    if (currentUser.name && activeRoomId) joinRoom(activeRoomId, currentRoomPassword, true); 
});

socket.on('join error', (msg) => showToast(msg, 3500));
socket.on('action error', (msg) => showToast(msg, 3500));
socket.on('rate limit', (msg) => showToast(msg, 3500));
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
    emitMarkRead();
});

document.addEventListener('visibilitychange', () => { if (!document.hidden && activeRoomId) { emitMarkRead(); } });

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
        statusText.textContent = 'Unsupported in browser';
        if (btnRequestPushPermission) btnRequestPushPermission.style.display = 'none';
    } else if (Notification.permission === 'granted') {
        statusText.textContent = 'Active in background';
        if (btnRequestPushPermission) {
            btnRequestPushPermission.textContent = 'Test Push';
            btnRequestPushPermission.style.display = 'inline-block';
        }
    } else if (Notification.permission === 'denied') {
        statusText.textContent = 'Blocked in browser';
        if (btnRequestPushPermission) {
            btnRequestPushPermission.textContent = 'Blocked';
            btnRequestPushPermission.style.display = 'inline-block';
        }
    } else {
        statusText.textContent = 'Alerts when app is closed';
        if (btnRequestPushPermission) {
            btnRequestPushPermission.textContent = 'Enable';
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

async function registerWebPushSubscription(showToastFeedback = false) {
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
        if (subscription) {
            try {
                await subscription.unsubscribe();
            } catch (e) {
                console.warn('Error unsubscribing old push subscription:', e);
            }
        }

        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
        });

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
        if (showToastFeedback) {
            showToast('Push notifications enabled');
        }
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
            registerWebPushSubscription(true);
        } else {
            updateNotifStatusText();
        }
    });
}

if (btnRequestPushPermission) {
    btnRequestPushPermission.addEventListener('click', async () => {
        if ('Notification' in window && Notification.permission === 'granted') {
            if (!currentPushEndpoint) {
                await registerWebPushSubscription();
            }
            if (currentPushEndpoint) {
                try {
                    const res = await fetch('/api/push/send-test', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            endpoint: currentPushEndpoint,
                            userName: currentUser ? currentUser.name : 'Guest',
                            delayMs: 4000
                        })
                    });
                    const resData = await res.json();
                    if (resData.success) {
                        showToast('Test push scheduled! Minimize/lock screen within 4 seconds!');
                    } else {
                        showToast('Test push: ' + (resData.error || 'Re-subscribing...'));
                        registerWebPushSubscription();
                    }
                } catch (e) {
                    showToast('Error testing push notification');
                }
            } else {
                triggerSystemNotification('ChitChat Test', 'Lobby', 'Test Web Push Notification working!', currentUser ? currentUser.avatar : null, 'lobby');
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
        registerWebPushSubscription(true);
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
            registerWebPushSubscription(true);
        });
    } else if (Notification.permission === 'granted') {
        registerWebPushSubscription(true);
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

    if (avatarImg) avatarImg.src = alertData.avatar || 'https://api.dicebear.com/7.x/lorelei/svg?seed=Guest';
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
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) audioCtx = new AudioContextClass();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        if (!audioCtx) return;

        const now = audioCtx.currentTime;

        if (type === 'send') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(480, now);
            osc.frequency.exponentialRampToValueAtTime(920, now + 0.12);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'receive') {
            const osc1 = audioCtx.createOscillator();
            const osc2 = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(audioCtx.destination);
            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.setValueAtTime(784, now);
            osc1.frequency.setValueAtTime(1046.5, now + 0.08);
            osc2.frequency.setValueAtTime(1174.66, now + 0.04);
            gain.gain.setValueAtTime(0.09, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.22);
            osc2.stop(now + 0.22);
        } else if (type === 'pop') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(640, now);
            osc.frequency.exponentialRampToValueAtTime(320, now + 0.07);
            gain.gain.setValueAtTime(0.11, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
            osc.start(now);
            osc.stop(now + 0.07);
        } else if (type === 'celebrate') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.setValueAtTime(659.25, now + 0.07);
            osc.frequency.setValueAtTime(783.99, now + 0.14);
            osc.frequency.setValueAtTime(1046.50, now + 0.21);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc.start(now);
            osc.stop(now + 0.35);
        } else if (type === 'unlock') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.15);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'tap') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800, now);
            gain.gain.setValueAtTime(0.03, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
            osc.start(now);
            osc.stop(now + 0.015);
        }
    } catch (e) {
        // audio fail safe
    }
}

const btnTestSound = document.getElementById('btn-test-sound');
if (btnTestSound) {
    let testSoundIdx = 0;
    const testSounds = ['receive', 'celebrate', 'pop', 'unlock'];
    btnTestSound.onclick = () => {
        const soundType = testSounds[testSoundIdx % testSounds.length];
        testSoundIdx++;
        playUiSound(soundType);
        hapticFeedback('light');
        showToast(`Sound effect test: "${soundType}"`);
    };
}

function checkEmptyMessages() {
    const messageItems = messages.querySelectorAll('li:not(.system-message)');
    let emptyEl = messages.querySelector('.empty-chat-state');
    if (messageItems.length === 0) {
        if (!emptyEl) {
            emptyEl = document.createElement('div');
            emptyEl.className = 'empty-chat-state';
            emptyEl.innerHTML = `
                <div class="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
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
            floatingTypingAvatar.src = firstUser.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(firstUser.name)}`;
            
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
                if (messages) {
                    messages.classList.add('has-typing');
                    // Scroll down so the last message is placed cleanly above the typing bubble
                    if (messages.scrollHeight - messages.scrollTop - messages.clientHeight < 180) {
                        setTimeout(() => { if (messages) messages.scrollTop = messages.scrollHeight; }, 50);
                    }
                }
            } else {
                if (messages && !messages.classList.contains('has-typing')) {
                    messages.classList.add('has-typing');
                }
            }
        }
    } else {
        onlineUsersText.textContent = baseOnlineText;
        onlineUsersText.classList.remove('typing-text-active');

        if (floatingTypingBubble) {
            floatingTypingBubble.classList.add('hidden');
        }
        if (messages) {
            messages.classList.remove('has-typing');
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
            avatar: data.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(data.name)}`
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
                showToast('Custom wallpaper uploaded!');
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

let searchMatches = [];
let currentSearchMatchIndex = -1;

function clearChatSearchHighlights() {
    document.querySelectorAll('#messages li').forEach(li => {
        li.classList.remove('search-target-glow');
        const txtNode = li.querySelector('.message-text');
        if (txtNode) {
            const marks = txtNode.querySelectorAll('.search-match');
            marks.forEach(m => {
                const parent = m.parentNode;
                while (m.firstChild) parent.insertBefore(m.firstChild, m);
                parent.removeChild(m);
            });
            if (txtNode.normalize) txtNode.normalize();
        }
    });
    searchMatches = [];
    currentSearchMatchIndex = -1;
    const countBadge = document.getElementById('chat-search-count');
    const prevBtn = document.getElementById('search-prev-btn');
    const nextBtn = document.getElementById('search-next-btn');
    if (countBadge) countBadge.classList.add('hidden');
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
}

function updateSearchHighlightIndex(idx) {
    if (searchMatches.length === 0 || idx < 0 || idx >= searchMatches.length) return;
    currentSearchMatchIndex = idx;

    document.querySelectorAll('.active-search-match').forEach(el => el.classList.remove('active-search-match'));
    document.querySelectorAll('.search-target-glow').forEach(el => el.classList.remove('search-target-glow'));

    const activeItem = searchMatches[currentSearchMatchIndex];
    if (activeItem) {
        const mark = activeItem.querySelector('.search-match');
        if (mark) mark.classList.add('active-search-match');
        activeItem.classList.add('search-target-glow');
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const countBadge = document.getElementById('chat-search-count');
    if (countBadge) {
        countBadge.textContent = `${currentSearchMatchIndex + 1} of ${searchMatches.length}`;
        countBadge.classList.remove('hidden');
    }
}

function performChatSearch(query) {
    const countBadge = document.getElementById('chat-search-count');
    const prevBtn = document.getElementById('search-prev-btn');
    const nextBtn = document.getElementById('search-next-btn');

    clearChatSearchHighlights();
    const cleanQuery = (query || '').trim().toLowerCase();
    if (!cleanQuery) return;

    const messageList = document.querySelectorAll('#messages li:not(.system-message)');
    const regex = new RegExp(`(${cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

    messageList.forEach(li => {
        const textNode = li.querySelector('.message-text');
        if (!textNode) return;
        const text = textNode.textContent;
        if (text.toLowerCase().includes(cleanQuery)) {
            textNode.innerHTML = escapeHTML(text).replace(regex, `<mark class="search-match">$1</mark>`);
            searchMatches.push(li);
        }
    });

    if (searchMatches.length > 0) {
        if (prevBtn) prevBtn.disabled = false;
        if (nextBtn) nextBtn.disabled = false;
        updateSearchHighlightIndex(searchMatches.length - 1);
    } else {
        if (countBadge) {
            countBadge.textContent = '0 of 0';
            countBadge.classList.remove('hidden');
        }
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
    }
}

if (btnOpenSearch) {
    btnOpenSearch.onclick = () => { 
        if (groupInfoModal) groupInfoModal.classList.add('hidden'); 
        if (chatSearchContainer) chatSearchContainer.classList.remove('hidden'); 
        if (chatSearchInput) {
            chatSearchInput.focus();
            if (chatSearchInput.value) performChatSearch(chatSearchInput.value);
        }
    };
}

if (closeSearchBtn) {
    closeSearchBtn.onclick = () => { 
        if (chatSearchContainer) chatSearchContainer.classList.add('hidden'); 
        if (chatSearchInput) chatSearchInput.value = ''; 
        clearChatSearchHighlights();
    };
}

if (chatSearchInput) {
    let searchDebounceTimer = null;
    chatSearchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            performChatSearch(e.target.value);
        }, 150);
    });

    chatSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (searchMatches.length === 0) return;
            if (e.shiftKey) {
                const newIdx = (currentSearchMatchIndex - 1 + searchMatches.length) % searchMatches.length;
                updateSearchHighlightIndex(newIdx);
            } else {
                const newIdx = (currentSearchMatchIndex + 1) % searchMatches.length;
                updateSearchHighlightIndex(newIdx);
            }
        } else if (e.key === 'Escape') {
            if (closeSearchBtn) closeSearchBtn.click();
        }
    });
}

const searchPrevBtn = document.getElementById('search-prev-btn');
if (searchPrevBtn) {
    searchPrevBtn.onclick = () => {
        if (searchMatches.length === 0) return;
        hapticFeedback('light');
        const newIdx = (currentSearchMatchIndex - 1 + searchMatches.length) % searchMatches.length;
        updateSearchHighlightIndex(newIdx);
    };
}

const searchNextBtn = document.getElementById('search-next-btn');
if (searchNextBtn) {
    searchNextBtn.onclick = () => {
        if (searchMatches.length === 0) return;
        hapticFeedback('light');
        const newIdx = (currentSearchMatchIndex + 1) % searchMatches.length;
        updateSearchHighlightIndex(newIdx);
    };
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
        showToast('Preset loaded');
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
            userId: currentUser.id,
            user: currentUser.name,
            avatar: currentUser.avatar,
            color: currentUser.color,
            text: '',
            poll: pollData,
            time: formatTo12HourTime(new Date()),
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
        sendMicBtn.title = 'Send Message';
        sendMicBtn.setAttribute('aria-label', 'Send Message');
        sendMicIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
    } else if (state === 'check') {
        sendMicBtn.title = 'Save Edit';
        sendMicBtn.setAttribute('aria-label', 'Save Edit');
        sendMicIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else {
        sendMicBtn.title = 'Record Voice Note';
        sendMicBtn.setAttribute('aria-label', 'Record Voice Note');
        sendMicIcon.innerHTML = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`;
    }
}

if (input) {
    const handleInputChange = () => { 
        if (editingMsgId) { 
            setSendBtnState('check'); 
        } else if ((input.value && input.value.trim().length > 0) || activeRoomId === 'ai_lounge') { 
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
    input.addEventListener('change', handleInputChange);
    input.addEventListener('compositionend', handleInputChange);
    input.addEventListener('paste', () => setTimeout(handleInputChange, 15));

    const handleEnterKey = (e) => { 
        if (e.key === 'Enter' && !e.shiftKey) { 
            e.preventDefault(); 
            sendMessage(); 
        } 
    };

    input.addEventListener('keydown', handleEnterKey);
}

function sendMessage() {
    if (!input) return;
    const text = input.value ? input.value.trim() : '';
    if (!text && !editingMsgId && activeRoomId !== 'ai_lounge') return;

    if (socket) socket.emit('typing', false); 
    clearTimeout(typingTimeout);
    typingSent = false;

    const targetRoomId = activeRoomId || 'lobby';

    if (editingMsgId) { 
        if (socket) socket.emit('edit message', { msgId: editingMsgId, newText: text, roomId: targetRoomId }); 
        editingMsgId = null;
    } else { 
        if (socket) socket.emit('chat message', { 
            userId: currentUser.id,
            user: currentUser.name || 'Guest', 
            avatar: currentUser.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(currentUser.name || 'Alex')}`, 
            color: currentUser.color || '#dcf8c6', 
            text, 
            time: formatTo12HourTime(new Date()), 
            replyTo: replyingTo, 
            isGhost: isGhostMode,
            roomId: targetRoomId,
            senderEndpoint: currentPushEndpoint
        }); 
        playUiSound('send');
    }

    input.value = ''; 
    try {
        input.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e) {}
    setSendBtnState(activeRoomId === 'ai_lounge' ? 'send' : 'mic'); 
    replyingTo = null; 
    if (replyPreviewContainer) replyPreviewContainer.classList.add('hidden');
}

// ==========================
// ✅ SAFE FILE UPLOAD CHECK
// ==========================
if (attachBtn) {
    attachBtn.addEventListener('click', (e) => {
        hapticFeedback('light');
        if (imageUpload && e.target.tagName !== 'LABEL') {
            imageUpload.click();
        }
    });
}

if (imageUpload) {
    imageUpload.addEventListener('change', function() {
        if (!this.files || !this.files[0]) return;
        const file = this.files[0];
        const targetRoomId = activeRoomId || 'lobby';
        const fileName = file.name || '';
        const fileType = file.type || '';
        
        const isImage = fileType.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|heic|heif|svg|avif)$/i.test(fileName);
        const isVideo = fileType.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(fileName);

        if (!isImage && !isVideo) {
            showToast('Please select a valid photo or video.');
            this.value = '';
            return;
        }

        if (file.size > 25 * 1024 * 1024) {
            showToast('File is too large! Maximum limit is 25MB.');
            this.value = '';
            return;
        }

        hapticFeedback('medium');
        const caption = (input && input.value) ? input.value.trim() : '';

        const reader = new FileReader();
        reader.onload = (e) => {
            const fileData = e.target.result;
            if (!fileData) {
                showToast('Failed to read file.');
                imageUpload.value = '';
                return;
            }

            const sendPayload = (payloadImage, isVid = false) => {
                if (!socket) {
                    showToast('Connection error, please try again.');
                    return;
                }
                const msgData = {
                    userId: currentUser.id,
                    user: currentUser.name,
                    avatar: currentUser.avatar,
                    color: currentUser.color,
                    text: caption,
                    uploadedImage: payloadImage,
                    isVideo: isVid,
                    time: formatTo12HourTime(new Date()),
                    isGhost: isGhostMode,
                    roomId: targetRoomId
                };
                socket.emit('chat message', msgData);
                playUiSound('send');
                if (input && caption) {
                    input.value = '';
                    setSendBtnState('mic');
                }
                showToast(isVid ? 'Video sent' : 'Photo sent', { duration: 1800 });
            };

            if (isVideo) {
                if (file.size > 20 * 1024 * 1024) {
                    showToast('Video is too large! Limit is 20MB.');
                    imageUpload.value = '';
                    return;
                }
                sendPayload(fileData, true);
            } else if (fileType === 'image/gif' || fileType === 'image/svg+xml') {
                sendPayload(fileData, false);
            } else {
                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        let w = img.width || 600;
                        let h = img.height || 600;
                        const maxDim = 1200;
                        if (w > maxDim || h > maxDim) {
                            if (w > h) {
                                h = Math.round((h * maxDim) / w);
                                w = maxDim;
                            } else {
                                w = Math.round((w * maxDim) / h);
                                h = maxDim;
                            }
                        }
                        canvas.width = Math.max(1, w);
                        canvas.height = Math.max(1, h);
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        const compressed = canvas.toDataURL('image/jpeg', 0.82);
                        sendPayload(compressed, false);
                    } catch(err) {
                        console.warn('Canvas resize error, sending original:', err);
                        sendPayload(fileData, false);
                    }
                };
                img.onerror = () => {
                    console.warn('Image decode error, sending raw file data:', file.name);
                    sendPayload(fileData, false);
                };
                img.src = fileData;
            }
            imageUpload.value = '';
        };

        reader.onerror = () => {
            showToast('Failed to open file.');
            imageUpload.value = '';
        };

        reader.readAsDataURL(file);
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

        if (li.classList.contains('my-message')) document.getElementById('opt-delete').classList.remove('hidden');
        else document.getElementById('opt-delete').classList.add('hidden');

        msgOptionsModal.classList.remove('hidden');
    }, 500); 
}, { passive: true });
messages.addEventListener('touchend', () => clearTimeout(pressTimer));
messages.addEventListener('touchmove', () => clearTimeout(pressTimer));

// Desktop right-click message context menu
messages.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.poll-card') || e.target.closest('.custom-audio-player') || e.target.classList.contains('avatar-small')) return;
    const li = e.target.closest('li.my-message, li.other-message');
    if (!li) return;
    e.preventDefault();
    hapticFeedback('medium');
    selectedMsgId = li.id.replace('msg-', '');
    if (li.classList.contains('my-message') && li.querySelector('.message-text')) {
        document.getElementById('opt-edit').classList.remove('hidden');
    } else {
        document.getElementById('opt-edit').classList.add('hidden');
    }
    if (li.classList.contains('my-message')) {
        document.getElementById('opt-delete').classList.remove('hidden');
    } else {
        document.getElementById('opt-delete').classList.add('hidden');
    }
    msgOptionsModal.classList.remove('hidden');
});

function triggerReplyForMessage(li) {
    if (!li) return;
    hapticFeedback('medium');
    selectedMsgId = li.id.replace('msg-', '');
    const sender = li.dataset.sender || 'User';
    const textNode = li.querySelector('.message-text');
    let msgText = textNode ? textNode.innerText.replace('(edited)', '').trim() : '';
    if (!msgText) {
        if (li.querySelector('.poll-question')) msgText = 'Poll: ' + li.querySelector('.poll-question').innerText;
        else if (li.querySelector('.chat-image')) msgText = 'Photo';
        else if (li.querySelector('.chat-video')) msgText = 'Video';
        else if (li.querySelector('.custom-audio-player')) msgText = 'Voice Note';
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
            badge.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
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
            listEl.innerHTML = `<p style="text-align: center; color: var(--text-secondary); font-size: 13.5px; padding: 20px 0;">No starred messages yet. Long-press any message to star it.</p>`;
        } else {
            listEl.innerHTML = starred.map(m => `
                <div class="starred-item-card" data-target-id="msg-${escapeHTML(m.id)}" style="background: var(--input-bg); padding: 10px 14px; border-radius: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 4px;">
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

document.addEventListener('click', (e) => {
    const quoteEl = e.target.closest('.replied-to[data-target-id]');
    if (quoteEl) {
        const tid = quoteEl.getAttribute('data-target-id');
        if (tid && window.scrollToQuoteMessage) window.scrollToQuoteMessage(tid);
        return;
    }
    const starredEl = e.target.closest('.starred-item-card[data-target-id]');
    if (starredEl) {
        const sm = document.getElementById('starred-messages-modal');
        if (sm) sm.classList.add('hidden');
        const tid = starredEl.getAttribute('data-target-id');
        if (tid && window.scrollToQuoteMessage) window.scrollToQuoteMessage(tid);
    }
});

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
            let summaryText = data.text || (data.isAudio ? 'Voice Note' : (data.uploadedImage ? 'Photo' : 'Attachment'));
            triggerSystemNotification(data.user, rName, summaryText, data.avatar, activeRoomId);
        }
        
        if (!document.hidden && activeRoomId) emitMarkRead();
    }
});

socket.on('poll updated', (updatedMsg) => {
    if (updatedMsg.roomId && updatedMsg.roomId !== activeRoomId) return;
    const li = document.getElementById(`msg-${updatedMsg.id}`);
    if (li) { const isMe = updatedMsg.user === currentUser.name; const isStacked = li.classList.contains('stacked'); li.innerHTML = getMessageInnerHTML(updatedMsg, isMe, isStacked); }
});

socket.on('messages read', (payload) => {
    if (payload && payload.roomId && payload.roomId !== activeRoomId) return;
    const readSVG = `<svg class="tick-svg tick-double tick-read-svg" width="18" height="13" viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8.5L5.5 12.5L14 3.5"/><path d="M7.5 8.5L11.5 12.5L20 3.5"/></svg>`;
    
    if (payload && Array.isArray(payload.msgIds) && payload.msgIds.length > 0) {
        payload.msgIds.forEach(id => {
            const li = document.getElementById(`msg-${id}`) || document.getElementById(id);
            const tickEl = (li && li.querySelector('.ticks')) || document.querySelector(`.ticks[data-msg-id="${id}"]`);
            if (tickEl && !tickEl.classList.contains('read')) {
                tickEl.className = 'ticks read just-read';
                tickEl.title = payload.reader ? `Read by ${payload.reader}` : 'Read';
                tickEl.innerHTML = readSVG;
            }
        });
    } else {
        document.querySelectorAll('.my-wrapper .ticks:not(.read)').forEach(tickEl => {
            tickEl.className = 'ticks read just-read';
            tickEl.title = 'Read';
            tickEl.innerHTML = readSVG;
        });
    }
});

socket.on('messages delivered', (payload) => {
    if (payload && payload.roomId && payload.roomId !== activeRoomId) return;
    const deliveredSVG = `<svg class="tick-svg tick-double" width="18" height="13" viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8.5L5.5 12.5L14 3.5"/><path d="M7.5 8.5L11.5 12.5L20 3.5"/></svg>`;
    
    if (payload && Array.isArray(payload.msgIds)) {
        payload.msgIds.forEach(id => {
            const li = document.getElementById(`msg-${id}`) || document.getElementById(id);
            const tickEl = (li && li.querySelector('.ticks.sent')) || document.querySelector(`.ticks[data-msg-id="${id}"].sent`);
            if (tickEl) {
                tickEl.className = 'ticks delivered';
                tickEl.title = 'Delivered';
                tickEl.innerHTML = deliveredSVG;
            }
        });
    }
});

socket.on('update reactions', (data) => { 
    const li = document.getElementById(`msg-${data.id}`);
    if(li) {
        let badge = li.querySelector('.reaction-badge');
        let reactString = Object.entries(data.reactions).map(([emoji, count]) => `${emoji} ${count}`).join(' ');
        let bubble = li.querySelector('.msg-bubble') || li;
        if (!badge) { 
            badge = document.createElement('div'); 
            badge.className = 'reaction-badge'; 
            badge.id = `reaction-count-${data.id}`; 
            bubble.appendChild(badge); 
        }
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

function generateWaveformBarsHTML(waveform) {
    let heights;
    if (Array.isArray(waveform) && waveform.length >= 10) {
        heights = waveform;
    } else {
        heights = [35, 60, 85, 45, 75, 95, 55, 85, 60, 35, 75, 90, 45, 65, 80, 40, 60, 30, 50, 30, 45, 60, 40, 25];
    }
    return heights.map(h => {
        const cleanH = Math.max(18, Math.min(100, Math.round(Number(h) || 25)));
        return `<div class="wave-bar" style="height: ${cleanH}%;"></div>`;
    }).join('');
}

function updateWaveformProgress(container, currentTime, duration) {
    if (!container) return;
    const waveBars = container.querySelectorAll('.wave-bar');
    const timeLabel = container.querySelector('.audio-time-label');
    
    // Resolve safe duration (WebM recordings in browsers report duration = Infinity)
    let safeDuration = (duration && isFinite(duration) && duration > 0) ? duration : 0;
    if (!safeDuration) {
        safeDuration = parseFloat(container.dataset.duration || 0);
    }
    if (!safeDuration && currentTime > 0) {
        safeDuration = Math.max(currentTime, 1);
    }

    if (timeLabel) {
        if (safeDuration > 0) {
            timeLabel.textContent = `${formatAudioTime(currentTime)} / ${formatAudioTime(safeDuration)}`;
        } else {
            timeLabel.textContent = formatAudioTime(currentTime);
        }
    }

    if (!safeDuration || waveBars.length === 0) return;
    const progress = Math.min(1, Math.max(0, currentTime / safeDuration));
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
    
    const safeDuration = parseFloat(container.dataset.duration || 0);
    if (timeLabel) {
        timeLabel.textContent = safeDuration > 0 ? formatAudioTime(safeDuration) : '0:00';
    }
    waveBars.forEach(bar => bar.classList.remove('played'));
}

// ==========================================
// 📬 WhatsApp-Style Ticks & Read Receipts
// ==========================================
let readReceiptsEnabled = localStorage.getItem('chitChat_readReceipts') !== 'false';

function getTickHTML(status = 'sent', msgId = '') {
    const s = String(status || 'sent').toLowerCase();
    const safeId = escapeHTML(String(msgId || ''));

    if (s === 'pending' || s === 'sending') {
        return `<span class="ticks pending" data-msg-id="${safeId}" title="Sending...">` +
            `<svg class="tick-svg tick-clock" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>` +
        `</span>`;
    }
    if (s === 'sent') {
        return `<span class="ticks sent" data-msg-id="${safeId}" title="Sent to server">` +
            `<svg class="tick-svg tick-single" width="14" height="12" viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 8.5 8.5 13 16 4"/></svg>` +
        `</span>`;
    }
    if (s === 'delivered') {
        return `<span class="ticks delivered" data-msg-id="${safeId}" title="Delivered">` +
            `<svg class="tick-svg tick-double" width="18" height="13" viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8.5L5.5 12.5L14 3.5"/><path d="M7.5 8.5L11.5 12.5L20 3.5"/></svg>` +
        `</span>`;
    }
    // 'read' (WhatsApp blue double-tick)
    return `<span class="ticks read" data-msg-id="${safeId}" title="Read">` +
        `<svg class="tick-svg tick-double tick-read-svg" width="18" height="13" viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8.5L5.5 12.5L14 3.5"/><path d="M7.5 8.5L11.5 12.5L20 3.5"/></svg>` +
    `</span>`;
}

function emitMarkRead(msgId = null) {
    if (!readReceiptsEnabled) return;
    if (!document.hidden && activeRoomId && socket) {
        socket.emit('mark read', { roomId: activeRoomId, msgId });
    }
}

function renderPencilMark(symbol, isNew = false) {
    const animClass = isNew ? 'draw-animated' : '';
    if (symbol === 'X') {
        return `
            <svg class="pencil-svg pencil-x ${animClass}" viewBox="0 0 50 50" aria-label="X" role="img" focusable="false">
                <path class="pencil-path stroke-x-1" pathLength="100" d="M 13.5 12.5 C 19 19, 28 30, 37.5 37.5" />
                <path class="pencil-path stroke-x-2" pathLength="100" d="M 36.5 13 C 29 21.5, 19.5 30, 12.5 37" />
            </svg>
        `;
    }
    if (symbol === 'O') {
        return `
            <svg class="pencil-svg pencil-o ${animClass}" viewBox="0 0 50 50" aria-label="O" role="img" focusable="false">
                <path class="pencil-path stroke-o" pathLength="100" d="M 27 11 C 19 9.5, 11 16, 11 25.5 C 11 34.5, 18 40, 26 39.5 C 34 39, 39.5 32.5, 39 23.5 C 38.5 15, 32 9.8, 25 11.2" />
            </svg>
        `;
    }
    return '';
}

function getMessageInnerHTML(data, isMe, isStacked) {
    let contentText = escapeHTML(data.text || '');
    if(data.isEdited) contentText += `<span class="edited-tag">(edited)</span>`;
    
    let content = '';
    if (data.xox) {
        const xox = data.xox;
        const players = xox.players || { X: null, O: null };
        const avatars = xox.playerAvatars || { X: null, O: null };
        const board = Array.isArray(xox.board) && xox.board.length === 9 ? xox.board : Array(9).fill('');
        const status = xox.status || 'in_progress';
        const currentTurn = xox.turn || 'X';
        const winner = xox.winner;
        const winningLine = xox.winningLine || [];

        const playerXName = players.X || 'Player X';
        const playerXAvatar = avatars.X || `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(playerXName)}`;

        const playerOName = players.O;
        const playerOAvatar = playerOName 
            ? (avatars.O || `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(playerOName)}`) 
            : null;

        const isMePlayerX = currentUser && currentUser.name && currentUser.name === players.X;
        const isMePlayerO = currentUser && currentUser.name && currentUser.name === players.O;

        let statusText = '';
        if (status === 'won') {
            const winnerName = winner === 'X' ? playerXName : (playerOName || 'Opponent');
            statusText = `<span class="winner-highlight">${escapeHTML(winnerName)}</span> won`;
        } else if (status === 'draw') {
            statusText = `Draw`;
        } else {
            if (currentTurn === 'O' && !playerOName) {
                statusText = `Waiting for opponent...`;
            } else {
                const activePlayerName = currentTurn === 'X' ? playerXName : (playerOName || 'Opponent');
                statusText = `Turn: <strong>${escapeHTML(activePlayerName)}</strong> (${currentTurn})`;
            }
        }

        const isXTurn = status === 'in_progress' && currentTurn === 'X';
        const isOTurn = status === 'in_progress' && currentTurn === 'O';

        const cellsHTML = board.map((val, idx) => {
            const isWinningCell = winningLine.includes(idx);
            const valClass = val === 'X' ? 'val-x' : (val === 'O' ? 'val-o' : '');
            return `
                <button class="xox-cell ${val ? 'filled' : 'empty'} ${isWinningCell ? 'winning-cell' : ''}" 
                        data-msgid="${data.id}" data-idx="${idx}" type="button" aria-label="Square ${idx + 1}: ${val || 'Empty'}">
                    ${val ? `<span class="xox-symbol ${valClass}">${renderPencilMark(val, false)}</span>` : ''}
                </button>
            `;
        }).join('');

        const playerXDisplayName = escapeHTML(playerXName) + (isMePlayerX ? ' (You)' : '');
        const playerODisplayName = playerOName 
            ? (escapeHTML(playerOName) + (isMePlayerO ? ' (You)' : '')) 
            : '(waiting...)';

        content = `
            <div class="xox-game-card ${status !== 'in_progress' ? 'game-finished' : ''}" data-msgid="${data.id}">
                <div class="xox-card-top">
                    <span class="xox-card-badge">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line></svg>
                        TIC-TAC-TOE
                    </span>
                    <span class="xox-room-subtag">Turn: ${currentTurn}</span>
                </div>

                <div class="xox-players-bar">
                    <div class="xox-player-box player-x-box ${isXTurn ? 'active-turn' : ''}">
                        <div class="xox-avatar-ring">
                            <img src="${escapeHTML(playerXAvatar)}" class="xox-player-avatar" alt="${escapeHTML(playerXName)}" title="${escapeHTML(playerXName)}">
                            <span class="xox-badge badge-x">X</span>
                            <div class="xox-ring-glow"></div>
                        </div>
                        <div class="xox-player-meta">
                            <span class="xox-pname" title="${escapeHTML(playerXName)}">${playerXDisplayName}</span>
                        </div>
                    </div>

                    <div class="xox-vs-pill">
                        <span>VS</span>
                    </div>

                    <div class="xox-player-box player-o-box ${isOTurn ? 'active-turn' : ''} ${!playerOName ? 'waiting-slot' : ''}">
                        <div class="xox-avatar-ring">
                            ${playerOAvatar 
                                ? `<img src="${escapeHTML(playerOAvatar)}" class="xox-player-avatar" alt="${escapeHTML(playerOName)}" title="${escapeHTML(playerOName)}">`
                                : `<div class="xox-player-avatar xox-empty-avatar" title="Waiting for opponent"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></div>`}
                            <span class="xox-badge badge-o">O</span>
                            <div class="xox-ring-glow"></div>
                        </div>
                        <div class="xox-player-meta">
                            <span class="xox-pname ${!playerOName ? 'xox-pname-waiting' : ''}" title="${playerOName ? escapeHTML(playerOName) : 'Waiting for opponent'}">${playerODisplayName}</span>
                        </div>
                    </div>
                </div>

                <div class="xox-status-row">${statusText}</div>

                <div class="xox-board-grid">${cellsHTML}</div>

                ${status !== 'in_progress' ? `
                    <div class="xox-footer-row">
                        <button class="xox-btn-rematch" data-msgid="${data.id}" type="button">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                            <span>Play Again</span>
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    } else if (data.poll) {
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
            const totalDuration = (data.duration && isFinite(data.duration) && data.duration > 0) ? Math.round(data.duration) : 0;
            const durationDisplay = totalDuration > 0 ? formatAudioTime(totalDuration) : '0:00';
            content = `
                <div class="custom-audio-player" data-audio-src="${escapeHTML(imgSrc)}" data-duration="${totalDuration}">
                    <button class="cozy-play-btn play-pause-btn" title="Play Voice Note" type="button" aria-label="Play Voice Note">
                        <svg class="play-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        <svg class="pause-icon hidden" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg>
                    </button>
                    <div class="cozy-audio-body">
                        <div class="cozy-waveform-track" title="Tap to seek">
                            ${generateWaveformBarsHTML(data.waveform)}
                        </div>
                        <div class="cozy-audio-meta">
                            <span class="audio-time-label">${durationDisplay}</span>
                            <div class="audio-meta-right">
                                <button class="audio-speed-btn" title="Change playback speed" type="button" data-speed="1">1x</button>
                                <span class="audio-type-badge">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path></svg>
                                    Voice Note
                                </span>
                            </div>
                        </div>
                    </div>
                </div>`;
        }
        else if (data.isVideo) content = `${contentText ? `<span class="message-text" style="display:block; margin-bottom:6px;">${contentText}</span>` : ''}<video src="${escapeHTML(imgSrc)}" class="chat-video" controls playsinline></video>`;
        else content = `${contentText ? `<span class="message-text" style="display:block; margin-bottom:6px;">${contentText}</span>` : ''}<img src="${escapeHTML(imgSrc)}" class="chat-image">`;
    } 
    else { content = `<span class="message-text">${contentText}</span>`; }

    if (data.linkPreview && data.linkPreview.url) {
        const safeUrl = sanitizeUrl(data.linkPreview.url);
        if (safeUrl) {
            const safeImg = data.linkPreview.img ? sanitizeUrl(data.linkPreview.img) : '';
            content += `<a href="${escapeHTML(safeUrl)}" target="_blank" rel="noopener noreferrer" class="link-preview-card">${safeImg ? `<img src="${escapeHTML(safeImg)}" class="link-preview-img" style="display:block;">` : ''}<div class="link-preview-content"><div class="link-preview-title">${escapeHTML(data.linkPreview.title || 'Link')}</div>${data.linkPreview.desc ? `<div class="link-preview-desc">${escapeHTML(data.linkPreview.desc)}</div>` : ''}</div></a>`;
        }
    }
    
    let topHeaderHTML = '';
    let senderDisplayName = isMe ? (currentUser.name || 'You') : (data.user || 'Guest');

    if (data.replyTo && data.replyTo.user) {
        let targetUser = data.replyTo.user;
        let targetDisplayName = (targetUser === currentUser.name && !isMe) 
            ? 'you' 
            : ((targetUser === currentUser.name && isMe) ? 'yourself' : targetUser);
        
        topHeaderHTML = `<span class="msg-header-name">${escapeHTML(senderDisplayName)}</span> <span class="reply-action-label">replied to</span> <span class="msg-header-name">${escapeHTML(targetDisplayName)}</span>`;
    } else if (!isMe && !isStacked) {
        topHeaderHTML = `<span class="msg-header-name">${escapeHTML(data.user)}</span>`;
    }

    let replyHTML = ''; 
    if (data.replyTo && data.replyTo.user) {
        const targetId = data.replyTo.msgId ? (data.replyTo.msgId.startsWith('msg-') ? data.replyTo.msgId : 'msg-' + data.replyTo.msgId) : '';
        const cleanTargetId = targetId.replace(/[^a-zA-Z0-9_-]/g, '');
        replyHTML = `
            <div class="replied-to" data-target-id="${cleanTargetId}">
                <div class="replied-to-bar"></div>
                <div class="replied-to-body">
                    <span class="replied-to-user">${escapeHTML(data.replyTo.user)}</span>
                    <span class="replied-to-text">${escapeHTML(data.replyTo.text).substring(0, 120)}</span>
                </div>
            </div>`;
    }
    let reactionsHTML = '';
    const displayTimeStr = formatTo12HourTime(data.time);
    const tickHTML = isMe ? getTickHTML(data.status, data.id) : '';
    const ghostBadge = data.isGhost ? '<span class="ghost-clock-tag" title="Ghost message">⏱</span> ' : '';
    
    const hasMedia = !!(data.uploadedImage || data.image);
    const hasTextContent = !!((data.text && String(data.text).trim().length > 0) || (data.message && String(data.message).trim().length > 0));
    const isMediaOnly = !!(hasMedia && !data.isAudio && !hasTextContent && !replyHTML);

    if (isMe) {
        return `
            <div class="msg-content-wrapper my-wrapper">
                ${topHeaderHTML ? `<div class="msg-top-header">${topHeaderHTML}</div>` : ''}
                <div class="msg-bubble ${data.xox ? 'msg-bubble-xox' : ''} ${isMediaOnly ? 'msg-bubble-media-only' : ''}">
                    ${replyHTML}${content}
                    <div class="meta-row"><span>${ghostBadge}${displayTimeStr}</span>${tickHTML}</div>
                </div>
            </div>`;
    } else {
        const avatarHTML = !isStacked 
            ? `<img src="${escapeHTML(data.avatar)}" class="avatar-small" data-name="${escapeHTML(data.user)}" title="${escapeHTML(data.user)}">` 
            : `<div class="avatar-placeholder"></div>`;
        return `
            ${avatarHTML}
            <div class="msg-content-wrapper other-wrapper">
                ${topHeaderHTML ? `<div class="msg-top-header">${topHeaderHTML}</div>` : ''}
                <div class="msg-bubble ${data.xox ? 'msg-bubble-xox' : ''} ${isMediaOnly ? 'msg-bubble-media-only' : ''}">
                    ${replyHTML}${content}
                    <div class="meta-row"><span>${ghostBadge}${displayTimeStr}</span></div>
                </div>
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
                                <img src="https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(vName)}" style="width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--border-color);">
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

    // ==========================
    // 🎮 TIC-TAC-TOE (XOX) REAL-TIME GAME HANDLERS
    // ==========================
    socket.on('xox updated', (data) => {
        if (data && data.xox) {
            xoxGamesMap.set(data.id, data);
            const li = document.getElementById(`msg-${data.id}`);
            if (li) {
                const card = li.querySelector('.xox-game-card');
                let updated = false;
                if (card) {
                    updated = updateXoxGameCard(card, data);
                }
                if (!updated) {
                    const isMe = checkIsMe(data);
                    const isStacked = li.classList.contains('stacked');
                    li.innerHTML = getMessageInnerHTML(data, isMe, isStacked);
                }
            }

            if (data.xox.status === 'won') {
                const winnerName = data.xox.winner === 'X' ? data.xox.players?.X : data.xox.players?.O;
                const isMe = currentUser && currentUser.name && (winnerName === currentUser.name);
                const isParticipant = currentUser && currentUser.name && (currentUser.name === data.xox.players?.X || currentUser.name === data.xox.players?.O);
                const displayText = isMe ? 'You won' : (isParticipant ? 'You lost' : (winnerName ? `${winnerName} won` : 'Game won'));
                try { playUiSound(isMe ? 'celebrate' : 'pop'); } catch (e) {}
                showToast(displayText, { type: isMe ? 'success' : (isParticipant ? 'error' : 'game'), duration: 2000 });
            } else if (data.xox.status === 'draw') {
                try { playUiSound('pop'); } catch (e) {}
                showToast('Draw', { type: 'game', duration: 2000 });
            } else {
                try { playUiSound('pop'); } catch (e) {}
            }
        }
    });

    socket.on('xox error', (payload) => {
        const message = typeof payload === 'string' ? payload : (payload.message || 'Action error');
        showToast(message, { type: 'game' });
    });
}

const xoxGamesMap = new Map();

function updateXoxGameCard(card, data) {
    if (!card || !data || !data.xox) return false;
    const xox = data.xox;
    const board = Array.isArray(xox.board) ? xox.board : Array(9).fill('');
    const status = xox.status || 'in_progress';
    const currentTurn = xox.turn || 'X';
    const winner = xox.winner;
    const winningLine = Array.isArray(xox.winningLine) ? xox.winningLine : [];
    const players = xox.players || { X: 'Player X', O: null };
    const avatars = xox.playerAvatars || { X: '', O: '' };

    // 1. Update card top turn / finished status
    card.classList.toggle('game-finished', status !== 'in_progress');
    const subtag = card.querySelector('.xox-room-subtag');
    if (subtag) {
        subtag.textContent = status === 'in_progress' ? `Turn: ${currentTurn}` : (status === 'won' ? 'Game Over' : 'Draw');
    }

    // 2. Update players bar
    const playerXBox = card.querySelector('.player-x-box');
    const playerOBox = card.querySelector('.player-o-box');
    const isXTurn = status === 'in_progress' && currentTurn === 'X';
    const isOTurn = status === 'in_progress' && currentTurn === 'O';
    if (playerXBox) playerXBox.classList.toggle('active-turn', isXTurn);
    if (playerOBox) {
        playerOBox.classList.toggle('active-turn', isOTurn);
        playerOBox.classList.toggle('waiting-slot', !players.O);

        // Update player O name & avatar if changed
        const oAvatarContainer = playerOBox.querySelector('.xox-avatar-ring');
        const oNameSpan = playerOBox.querySelector('.xox-pname');
        if (players.O && oNameSpan && oNameSpan.classList.contains('xox-pname-waiting')) {
            const isMePlayerO = currentUser && currentUser.name && currentUser.name === players.O;
            const playerODisplayName = escapeHTML(players.O) + (isMePlayerO ? ' (You)' : '');
            oNameSpan.className = 'xox-pname';
            oNameSpan.title = escapeHTML(players.O);
            oNameSpan.innerHTML = playerODisplayName;

            const playerOAvatar = avatars.O || `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(players.O)}`;
            if (oAvatarContainer) {
                oAvatarContainer.innerHTML = `
                    <img src="${escapeHTML(playerOAvatar)}" class="xox-player-avatar" alt="${escapeHTML(players.O)}" title="${escapeHTML(players.O)}">
                    <span class="xox-badge badge-o">O</span>
                    <div class="xox-ring-glow"></div>
                `;
            }
        }
    }

    // 3. Status text
    const statusRow = card.querySelector('.xox-status-row');
    if (statusRow) {
        let statusText = '';
        if (status === 'won') {
            const winnerName = winner === 'X' ? (players.X || 'Player X') : (players.O || 'Opponent');
            statusText = `<span class="winner-highlight">${escapeHTML(winnerName)}</span> won`;
        } else if (status === 'draw') {
            statusText = `Draw`;
        } else {
            if (currentTurn === 'O' && !players.O) {
                statusText = `Waiting for opponent...`;
            } else {
                const activePlayerName = currentTurn === 'X' ? (players.X || 'Player X') : (players.O || 'Opponent');
                statusText = `Turn: <strong>${escapeHTML(activePlayerName)}</strong> (${currentTurn})`;
            }
        }
        statusRow.innerHTML = statusText;
    }

    // 4. In-place Cell Updates (NO flicker, NO redrawing of existing marks!)
    const cells = card.querySelectorAll('.xox-cell');
    cells.forEach((btn) => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (isNaN(idx)) return;
        const val = board[idx] || '';
        const isWinningCell = winningLine.includes(idx);
        btn.classList.toggle('winning-cell', isWinningCell);

        const currentSvg = btn.querySelector('.pencil-svg');

        if (!val) {
            // Cell is empty
            if (btn.classList.contains('filled')) {
                btn.className = 'xox-cell empty';
                btn.innerHTML = '';
            }
            btn.setAttribute('aria-label', `Square ${idx + 1}: Empty`);
        } else {
            const hasCorrectSymbol = currentSvg && (
                (val === 'X' && currentSvg.classList.contains('pencil-x')) ||
                (val === 'O' && currentSvg.classList.contains('pencil-o'))
            );

            if (!hasCorrectSymbol) {
                // Brand new mark placed in this turn: animate ONLY this newly drawn mark!
                btn.className = `xox-cell filled ${isWinningCell ? 'winning-cell' : ''}`;
                btn.setAttribute('aria-label', `Square ${idx + 1}: ${val}`);
                const valClass = val === 'X' ? 'val-x' : 'val-o';
                btn.innerHTML = `<span class="xox-symbol ${valClass}">${renderPencilMark(val, true)}</span>`;
                
                // Clean up animation class after drawing completes so it stays completely static
                setTimeout(() => {
                    const svg = btn.querySelector('.pencil-svg');
                    if (svg) svg.classList.remove('draw-animated');
                }, 500);
            } else {
                // Mark already existed on board: DO NOT recreate or touch its SVG paths!
                if (currentSvg && currentSvg.classList.contains('draw-animated')) {
                    currentSvg.classList.remove('draw-animated');
                }
            }
        }
    });

    // 5. Rematch footer
    let footerRow = card.querySelector('.xox-footer-row');
    if (status !== 'in_progress') {
        if (!footerRow) {
            footerRow = document.createElement('div');
            footerRow.className = 'xox-footer-row';
            footerRow.innerHTML = `
                <button class="xox-btn-rematch" data-msgid="${data.id}" type="button">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                    <span>Play Again</span>
                </button>
            `;
            card.appendChild(footerRow);
        }
    } else {
        if (footerRow) footerRow.remove();
    }

    return true;
}

function sendXoxGame() {
    if (!currentUser || !currentUser.name) {
        showToast('Please set your username first', { type: 'error' });
        return;
    }
    if (!activeRoomId) return;

    hapticFeedback('medium');
    playUiSound('pop');

    const isAILounge = activeRoomId === 'ai_lounge';
    const gameId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const gameMsg = {
        id: gameId,
        roomId: activeRoomId,
        user: currentUser.name,
        avatar: currentUser.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(currentUser.name || 'Alex')}`,
        userId: currentUser.id || currentUser.userId || currentUser.name,
        time: formatTo12HourTime(new Date()),
        status: 'sent',
        text: isAILounge ? 'Tic-Tac-Toe match vs AI Bot started. Tap squares to play.' : 'Tic-Tac-Toe match started. Tap squares to play.',
        xox: {
            board: Array(9).fill(''),
            turn: 'X',
            players: { 
                X: currentUser.name, 
                O: isAILounge ? 'AI Bot' : null 
            },
            playerAvatars: { 
                X: currentUser.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(currentUser.name || 'Alex')}`, 
                O: isAILounge ? 'https://api.dicebear.com/7.x/lorelei/svg?seed=ChitChatBot&backgroundColor=b6e3f4' : null 
            },
            status: 'in_progress',
            winner: null,
            winningLine: null
        }
    };

    if (socket) {
        socket.emit('chat message', gameMsg);
        showToast('Challenge sent', { type: 'game' });
    }
}

function handleXoxCellClick(msgId, index) {
    if (!socket || !msgId || isNaN(index)) return;

    const item = xoxGamesMap.get(msgId);
    if (item && item.xox) {
        const xox = item.xox;
        if (xox.status !== 'in_progress') {
            showToast("Game ended", { type: 'game' });
            return;
        }

        if (xox.board && xox.board[index] !== '') {
            showToast("Square taken", { type: 'game' });
            return;
        }

        const currentTurn = xox.turn || 'X';
        const players = xox.players || { X: null, O: null };
        const myName = currentUser && currentUser.name ? currentUser.name : 'Guest';

        if (currentTurn === 'X') {
            if (players.X && players.X !== myName) {
                showToast(`${players.X}'s turn`, { type: 'game' });
                return;
            }
        } else if (currentTurn === 'O') {
            if (!players.O) {
                if (players.X === myName) {
                    showToast("Waiting for opponent", { type: 'game' });
                    return;
                }
            } else if (players.O !== myName) {
                if (players.O === 'AI Bot' || players.O === '🤖 Bot') {
                    showToast("AI is thinking...", { type: 'game' });
                } else {
                    showToast(`${players.O}'s turn`, { type: 'game' });
                }
                return;
            }
        }

        // Instant optimistic feedback on tapped cell
        const cardEl = document.querySelector(`.xox-game-card[data-msgid="${msgId}"]`);
        if (cardEl) {
            const targetBtn = cardEl.querySelector(`.xox-cell[data-idx="${index}"]`);
            if (targetBtn && !targetBtn.classList.contains('filled')) {
                targetBtn.className = 'xox-cell filled';
                targetBtn.setAttribute('aria-label', `Square ${index + 1}: ${currentTurn}`);
                const valClass = currentTurn === 'X' ? 'val-x' : 'val-o';
                targetBtn.innerHTML = `<span class="xox-symbol ${valClass}">${renderPencilMark(currentTurn, true)}</span>`;
                setTimeout(() => {
                    const svg = targetBtn.querySelector('.pencil-svg');
                    if (svg) svg.classList.remove('draw-animated');
                }, 500);
            }
        }
    }

    hapticFeedback('medium');
    playUiSound('pop');
    socket.emit('play xox move', {
        msgId,
        index,
        userName: currentUser.name,
        userAvatar: currentUser.avatar
    });
}

// ==========================
// 💋 INSTAGRAM-STYLE FLOATING KISS EMOJI ANIMATION
function triggerKissAnimation() {
    // Emojis disabled in chat
    return;
}

function formatTo12HourTime(timeInput) {
    if (!timeInput) {
        return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    if (timeInput instanceof Date) {
        return timeInput.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    const str = String(timeInput).trim();
    if (/am|pm/i.test(str)) {
        return str;
    }

    const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2];
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        if (hours === 0) hours = 12;
        return `${hours}:${minutes} ${ampm}`;
    }

    const parsedDate = new Date(str);
    if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    return str;
}

function checkIsMe(data) {
    if (!data) return false;
    
    // 1. Live socket sender match (exact socket connection that sent the message)
    if (data.senderSocketId && socket && socket.id && data.senderSocketId === socket.id) {
        return true;
    }
    
    // 2. Permanent unique user ID match
    if (data.userId && currentUser && currentUser.id && data.userId === currentUser.id) {
        return true;
    }
    
    // 3. Custom username match (case-insensitive, ignoring generic "guest")
    const senderName = data.user ? String(data.user).trim() : '';
    const myName = currentUser && currentUser.name ? String(currentUser.name).trim() : '';
    if (senderName && myName && senderName.toLowerCase() === myName.toLowerCase() && senderName.toLowerCase() !== 'guest' && senderName.toLowerCase() !== 'guest user') {
        return true;
    }
    
    return false;
}

function displayMessage(data, isHistory) {
    checkEmptyMessages();
    if (data && data.poll) {
        pollMessagesMap.set(data.id, data);
    }
    if (data && data.xox) {
        xoxGamesMap.set(data.id, data);
    }

    const li = document.createElement('li'); li.id = `msg-${data.id}`; li.dataset.sender = data.user;
    if (data.type === 'system') { li.className = 'system-message'; li.textContent = data.text; messages.appendChild(li); messages.scrollTop = messages.scrollHeight; return; }

    const isMe = checkIsMe(data);
    const lastMsg = messages.lastElementChild;
    const isStacked = (lastMsg && !lastMsg.classList.contains('system-message') && lastMsg.dataset.sender === data.user);

    li.className = isMe ? 'my-message' : 'other-message';
    if(isStacked) li.classList.add('stacked');
    if(data.isGhost) li.classList.add('ghost-message');
    if(data.xox) li.classList.add('xox-message');
    const hasMsgMedia = !!(data.uploadedImage || data.image);
    const hasMsgText = !!((data.text && String(data.text).trim().length > 0) || (data.message && String(data.message).trim().length > 0));
    if(hasMsgMedia && !data.isAudio && !hasMsgText) li.classList.add('media-only-message');
    if (data.color) li.style.setProperty('--bubble-color', data.color);

    li.innerHTML = getMessageInnerHTML(data, isMe, isStacked);
    messages.appendChild(li); messages.scrollTop = messages.scrollHeight;

    // Automatic Rich Link Preview for URLs
    const rawMsgText = data.text || data.message;
    if (rawMsgText && !data.linkPreview && !data.uploadedImage && !data.isAudio && !data.isVideo) {
        attachAutoLinkPreview(li, rawMsgText);
    }

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

    const getSafeDuration = (audio, container) => {
        if (audio && isFinite(audio.duration) && audio.duration > 0) {
            return audio.duration;
        }
        const dataDur = parseFloat(container?.dataset?.duration || 0);
        if (dataDur > 0) return dataDur;
        if (audio && audio.currentTime > 0) return Math.max(audio.currentTime, 1);
        return 0;
    };

    // Handle Waveform seeking
    if (track && !playBtn) {
        const rect = track.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const fraction = Math.min(1, Math.max(0, clickX / (rect.width || 1)));

        if (currentPlayingAudio && currentPlayingContainer === playerContainer) {
            const dur = getSafeDuration(currentPlayingAudio, playerContainer);
            if (dur > 0) {
                currentPlayingAudio.currentTime = fraction * dur;
                updateWaveformProgress(playerContainer, currentPlayingAudio.currentTime, dur);
            }
            return;
        } else {
            // Tapped track before audio started: begin playback and seek to position
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

            const applySeek = () => {
                const dur = getSafeDuration(currentPlayingAudio, playerContainer);
                if (dur > 0) {
                    try { currentPlayingAudio.currentTime = fraction * dur; } catch(err){}
                    updateWaveformProgress(playerContainer, currentPlayingAudio.currentTime, dur);
                }
            };

            currentPlayingAudio.addEventListener('loadedmetadata', applySeek, { once: true });
            currentPlayingAudio.play().then(applySeek).catch(err => console.log('Audio playback error:', err));

            currentPlayingAudio.addEventListener('timeupdate', () => { 
                const dur = getSafeDuration(currentPlayingAudio, playerContainer);
                updateWaveformProgress(playerContainer, currentPlayingAudio.currentTime, dur);
            });

            currentPlayingAudio.addEventListener('ended', () => { 
                resetAudioPlayerUI(playerContainer);
                currentPlayingAudio = null;
                currentPlayingContainer = null;
            });
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
            const dur = getSafeDuration(currentPlayingAudio, playerContainer);
            updateWaveformProgress(playerContainer, 0, dur);
        });

        currentPlayingAudio.addEventListener('timeupdate', () => { 
            const dur = getSafeDuration(currentPlayingAudio, playerContainer);
            updateWaveformProgress(playerContainer, currentPlayingAudio.currentTime, dur);
        });

        currentPlayingAudio.addEventListener('ended', () => { 
            resetAudioPlayerUI(playerContainer);
            currentPlayingAudio = null;
            currentPlayingContainer = null;
        });
    }
});

document.getElementById('messages').addEventListener('click', (e) => { 
    const xoxCell = e.target.closest('.xox-cell');
    if (xoxCell) {
        const msgId = xoxCell.dataset.msgid;
        const index = parseInt(xoxCell.dataset.idx, 10);
        handleXoxCellClick(msgId, index);
        return;
    }

    const rematchBtn = e.target.closest('.xox-btn-rematch');
    if (rematchBtn) {
        const msgId = rematchBtn.dataset.msgid;
        if (socket && msgId) {
            hapticFeedback('medium');
            playUiSound('pop');
            socket.emit('reset xox game', { msgId });
            showToast('Rematch started', { type: 'game' });
        }
        return;
    }

    const pollOpt = e.target.closest('.poll-option-btn');
    if (pollOpt) {
        if (pollOpt.classList.contains('disabled-option') || pollOpt.disabled) {
            showToast('This poll is closed');
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
        showToast('Poll voting closed');
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

    if(e.target.classList.contains('chat-image')) { openLightboxModal(e.target.src); } 
    if(e.target.classList.contains('avatar-small')) { const friendName = e.target.dataset.name; socket.emit('get user info', friendName); }
});

// View User Profile socket response handler
socket.on('user info result', (info) => {
    if (!info) return;
    const modal = document.getElementById('view-profile-modal');
    const nameEl = document.getElementById('view-profile-name');
    const aboutEl = document.getElementById('view-profile-about');
    const avatarEl = document.getElementById('view-profile-avatar');
    if (nameEl) nameEl.textContent = info.name || 'User Profile';
    if (aboutEl) aboutEl.textContent = info.about || 'Hey there! I am using Chit Chat.';
    if (avatarEl) avatarEl.src = info.avatar || generateCuteAvatar(info.name || 'User');
    if (modal) modal.classList.remove('hidden');
});

const closeViewProfileBtn = document.getElementById('close-view-profile-btn');
if (closeViewProfileBtn) {
    closeViewProfileBtn.onclick = () => {
        const modal = document.getElementById('view-profile-modal');
        if (modal) modal.classList.add('hidden');
    };
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

// XOX Game Launcher Button
const xoxBtn = document.getElementById('xox-btn');
if (xoxBtn) {
    xoxBtn.addEventListener('click', () => {
        sendXoxGame();
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
    emerald: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="leafGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#34d399"/><stop offset="50%" stop-color="#10b981"/><stop offset="100%" stop-color="#059669"/></linearGradient></defs><path d="M20.5 3.5C20.5 3.5 13.5 3 8 8.5C3.8 12.7 3.5 18.5 3.5 18.5C3.5 18.5 9.3 18.2 13.5 14C19 8.5 20.5 3.5 20.5 3.5Z" fill="url(#leafGrad)"/><path d="M3.5 18.5C7.5 14.5 11.5 11 16.5 7.5" stroke="#047857" stroke-width="2" stroke-linecap="round"/><circle cx="17" cy="7" r="1.2" fill="#ecfdf5"/></svg>`,
    
    light: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="sunGrad" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#fde047"/><stop offset="50%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#f59e0b"/></linearGradient><linearGradient id="sunRayGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#d97706"/></linearGradient></defs><circle cx="12" cy="12" r="4.6" fill="url(#sunGrad)"/><path d="M12 2.5V4.5M12 19.5V21.5M2.5 12H4.5M19.5 12H21.5M5.28 5.28L6.7 6.7M17.3 17.3L18.72 18.72M5.28 18.72L6.7 17.3M17.3 6.7L18.72 5.28" stroke="url(#sunRayGrad)" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    
    dark: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="moonGrad" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#a5b4fc"/><stop offset="50%" stop-color="#818cf8"/><stop offset="100%" stop-color="#6366f1"/></linearGradient></defs><path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5A7 7 0 0 0 20.5 13.2Z" fill="url(#moonGrad)"/><path d="M18.5 4.5L19 5.8L20.5 6.3L19 6.8L18.5 8.1L18 6.8L16.5 6.3L18 5.8L18.5 4.5Z" fill="#c7d2fe"/><circle cx="13.5" cy="4" r="0.9" fill="#e0e7ff"/></svg>`,
    
    pink: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="roseHGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#fb7185"/><stop offset="50%" stop-color="#f43f5e"/><stop offset="100%" stop-color="#e11d48"/></linearGradient><radialGradient id="roseCoreGrad" cx="12" cy="12" r="3.5" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#ffffff"/><stop offset="60%" stop-color="#fff1f2"/><stop offset="100%" stop-color="#fecdd3"/></radialGradient></defs><path d="M12 2.2C13.8 4.8 13.9 7.2 12 8.8C10.1 7.2 10.2 4.8 12 2.2Z" fill="url(#roseHGrad)"/><path d="M21.3 9C19.3 10.7 16.9 10.2 15.6 8.3C16.8 6.7 19.3 6.3 21.3 9Z" fill="url(#roseHGrad)"/><path d="M17.7 20C15.7 18.2 14.8 15.8 16.1 14C17.8 14.8 19.5 17 17.7 20Z" fill="url(#roseHGrad)"/><path d="M6.3 20C4.5 17 6.2 14.8 7.9 14C9.2 15.8 8.3 18.2 6.3 20Z" fill="url(#roseHGrad)"/><path d="M2.7 9C4.7 6.3 7.2 6.7 8.4 8.3C7.1 10.2 4.7 10.7 2.7 9Z" fill="url(#roseHGrad)"/><circle cx="12" cy="12" r="3.2" fill="url(#roseCoreGrad)" stroke="#fda4af" stroke-width="0.8"/></svg>`
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

    const themeBtn = document.getElementById('btn-theme-cycle');
    if (themeBtn && typeof availableThemes !== 'undefined') {
        const themeLabels = {
            emerald: 'Emerald Green',
            light: 'Clean Light',
            dark: 'Cosmic Dark',
            pink: 'Sakura Pink'
        };
        const nextIdx = (availableThemes.indexOf(themeName) + 1) % availableThemes.length;
        const nextTheme = availableThemes[nextIdx];
        const nextLabel = themeLabels[nextTheme] || nextTheme;
        themeBtn.title = `Theme: ${themeLabels[themeName] || themeName} (Click to switch to ${nextLabel})`;
        themeBtn.setAttribute('aria-label', `Active theme: ${themeLabels[themeName] || themeName}. Click to switch to ${nextLabel}`);
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

        const iconSpan = document.getElementById('theme-btn-icon');
        if (iconSpan) {
            iconSpan.classList.remove('theme-icon-spin');
            void iconSpan.offsetWidth;
            iconSpan.classList.add('theme-icon-spin');
        }
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
let isRecordingPaused = false;
let recordingTimerInterval = null;
let recordingSeconds = 0;
let isRecordingCancelled = false;
let recordStartTime = 0;

let audioContext = null;
let analyserNode = null;
let micSourceNode = null;
let visualizerAnimFrame = null;
let liveWaveformSamples = [];
let sampleIntervalId = null;

let currentAudioStream = null;
let recPreviewAudio = null;
let recBlobUrl = null;

const recOverlay = document.getElementById('recording-overlay');
const inputPill = document.getElementById('input-pill');
const recTimer = document.getElementById('recording-timer');
const cancelRecBtn = document.getElementById('cancel-rec-btn');
const sendRecBtn = document.getElementById('send-rec-btn');
const pauseRecBtn = document.getElementById('pause-rec-btn');

function updateRecTimerDisplay() {
    const mins = Math.floor(recordingSeconds / 60);
    const secs = recordingSeconds % 60;
    if (recTimer) recTimer.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function normalizeWaveform(samples, barCount = 24) {
    if (!samples || samples.length === 0) {
        return [30, 55, 80, 45, 75, 95, 55, 85, 60, 35, 75, 90, 45, 65, 80, 40, 55, 30, 45, 25, 40, 55, 35, 20];
    }
    if (samples.length <= barCount) {
        const res = [];
        for (let i = 0; i < barCount; i++) {
            const idx = Math.min(samples.length - 1, Math.floor((i / barCount) * samples.length));
            res.push(Math.max(18, Math.min(100, samples[idx])));
        }
        return res;
    }
    const res = [];
    const chunkSize = samples.length / barCount;
    for (let i = 0; i < barCount; i++) {
        const start = Math.floor(i * chunkSize);
        const end = Math.floor((i + 1) * chunkSize);
        let maxVal = 0;
        let sum = 0, count = 0;
        for (let j = start; j < end && j < samples.length; j++) {
            const v = samples[j];
            sum += v;
            if (v > maxVal) maxVal = v;
            count++;
        }
        const avg = count > 0 ? Math.round(sum / count) : 20;
        const blended = Math.round(maxVal * 0.7 + avg * 0.3);
        res.push(Math.max(18, Math.min(100, blended)));
    }
    return res;
}

function startLiveVisualizer(stream) {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        
        if (!audioContext || audioContext.state === 'closed') {
            audioContext = new AudioContextClass();
        } else if (audioContext.state === 'suspended') {
            audioContext.resume();
        }

        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 256;
        analyserNode.smoothingTimeConstant = 0.4;
        
        micSourceNode = audioContext.createMediaStreamSource(stream);
        micSourceNode.connect(analyserNode);

        const waveBars = document.querySelectorAll('#recording-waves .rec-wave-bar');
        const numBars = waveBars.length || 12;
        const timeData = new Uint8Array(analyserNode.fftSize);
        const freqData = new Uint8Array(analyserNode.frequencyBinCount);

        let smoothedVoiceLevel = 0;

        function drawVisualizer() {
            if (!isRecording || isRecordingPaused) return;

            analyserNode.getByteTimeDomainData(timeData);
            analyserNode.getByteFrequencyData(freqData);

            // 1. Calculate true time-domain acoustic RMS volume
            let sumSq = 0;
            for (let i = 0; i < timeData.length; i++) {
                const amp = (timeData[i] - 128) / 128;
                sumSq += amp * amp;
            }
            const rms = Math.sqrt(sumSq / timeData.length);

            // Voice sensitivity boost: noise floor ~0.007, voice level 0.0 to 1.0
            const rawVoiceLevel = Math.min(1, Math.max(0, (rms - 0.007) * 4.4));
            // Smooth decay so wave looks organic rather than erratic
            smoothedVoiceLevel = Math.max(rawVoiceLevel, smoothedVoiceLevel * 0.86);

            const now = performance.now();
            const speechBins = Math.min(20, freqData.length);

            waveBars.forEach((bar, idx) => {
                // Map bar index across vocal speech bands
                const binIdx = 1 + Math.floor((idx / numBars) * speechBins);
                const freqAmp = (freqData[binIdx] || 0) / 255;

                // Center-weighted profile for pleasing voice-note curvature
                const centerDist = Math.abs(idx - (numBars - 1) / 2) / ((numBars - 1) / 2);
                const centerWeight = 0.65 + 0.35 * Math.cos(centerDist * Math.PI * 0.5);

                // Subtle fluid wave harmonic
                const waveHarmonic = Math.sin(now * 0.007 + idx * 0.55) * 0.15;

                const combined = (smoothedVoiceLevel * 0.6 + freqAmp * 0.4 + waveHarmonic * smoothedVoiceLevel) * centerWeight;
                const heightPercent = Math.min(100, Math.max(16, Math.round(combined * 84 + 16)));

                bar.style.height = `${heightPercent}%`;
            });

            visualizerAnimFrame = requestAnimationFrame(drawVisualizer);
        }
        drawVisualizer();

        liveWaveformSamples = [];
        clearInterval(sampleIntervalId);
        sampleIntervalId = setInterval(() => {
            if (!isRecording || isRecordingPaused || !analyserNode) return;
            analyserNode.getByteTimeDomainData(timeData);
            let s = 0;
            for (let i = 0; i < timeData.length; i++) {
                const amp = (timeData[i] - 128) / 128;
                s += amp * amp;
            }
            const rms = Math.sqrt(s / timeData.length);
            const level = Math.min(1, Math.max(0, (rms - 0.007) * 4.0));
            const sampleVal = Math.round(level * 82 + 18);
            liveWaveformSamples.push(Math.max(18, Math.min(100, sampleVal)));
        }, 75);
    } catch(e) {
        console.warn('Live audio visualizer error:', e);
    }
}

function stopLiveVisualizer() {
    if (visualizerAnimFrame) {
        cancelAnimationFrame(visualizerAnimFrame);
        visualizerAnimFrame = null;
    }
    if (sampleIntervalId) {
        clearInterval(sampleIntervalId);
        sampleIntervalId = null;
    }
    if (micSourceNode) {
        try { micSourceNode.disconnect(); } catch(e){}
        micSourceNode = null;
    }
    const waveBars = document.querySelectorAll('#recording-waves .rec-wave-bar');
    waveBars.forEach(bar => { bar.style.height = '18%'; });
}

function cleanupPreviewAudio() {
    if (recPreviewAudio) {
        recPreviewAudio.pause();
        recPreviewAudio = null;
    }
    if (recBlobUrl) {
        URL.revokeObjectURL(recBlobUrl);
        recBlobUrl = null;
    }
    if (pauseRecBtn) {
        pauseRecBtn.classList.remove('is-preview-playing');
        const playSvg = pauseRecBtn.querySelector('.rec-play-svg');
        const pauseSvg = pauseRecBtn.querySelector('.rec-pause-svg');
        if (playSvg) playSvg.classList.add('hidden');
        if (pauseSvg) pauseSvg.classList.remove('hidden');
    }
}

async function startRecording(e) {
    if (e && e.cancelable) e.preventDefault(); 
    if ((input && input.value && input.value.trim().length > 0) || activeRoomId === 'ai_lounge') return; 
    if (isRecording) return;

    if (input) {
        try { input.blur(); } catch(e){}
    }

    if (!navigator || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        showToast("Microphone is not supported in this browser/connection (requires HTTPS or localhost)!");
        return;
    }
    if (typeof MediaRecorder === 'undefined') {
        showToast("Voice recording is not supported in this browser.");
        return;
    }

    hapticFeedback('medium'); 
    isRecordingCancelled = false;
    isRecordingPaused = false;
    cleanupPreviewAudio();
    recordStartTime = Date.now();

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });
        currentAudioStream = stream;

        let options = {};
        if (typeof MediaRecorder.isTypeSupported === 'function') {
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                options.mimeType = 'audio/webm;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                options.mimeType = 'audio/mp4';
            } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
                options.mimeType = 'audio/ogg';
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                options.mimeType = 'audio/webm';
            }
        }

        mediaRecorder = Object.keys(options).length > 0 ? new MediaRecorder(stream, options) : new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => { 
            if (event.data && event.data.size > 0) {
                audioChunks.push(event.data); 
            }
        };

        mediaRecorder.onstop = () => {
            clearInterval(recordingTimerInterval);
            stopLiveVisualizer();
            cleanupPreviewAudio();

            if (recOverlay) {
                recOverlay.classList.remove('is-paused');
                recOverlay.classList.add('hidden');
            }
            if (inputPill) inputPill.classList.remove('hidden');
            if (sendMicBtn) sendMicBtn.classList.remove('hidden');

            if (!isRecordingCancelled && audioChunks.length > 0) {
                const finalMime = mediaRecorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunks, { type: finalMime }); 
                if (audioBlob.size > 150) {
                    const normalizedWave = normalizeWaveform(liveWaveformSamples, 24);
                    const elapsedSecs = Math.max(1, Math.round((Date.now() - recordStartTime) / 1000));
                    const finalDuration = Math.max(elapsedSecs, recordingSeconds);

                    const reader = new FileReader();
                    reader.onload = (event) => { 
                        if (socket) {
                            socket.emit('chat message', { 
                                userId: currentUser.id,
                                user: currentUser.name, 
                                avatar: currentUser.avatar, 
                                color: currentUser.color, 
                                text: '', 
                                uploadedImage: event.target.result, 
                                isAudio: true, 
                                duration: finalDuration,
                                waveform: normalizedWave,
                                time: formatTo12HourTime(new Date()), 
                                isGhost: isGhostMode,
                                roomId: activeRoomId || 'lobby'
                            }); 
                            playUiSound('send');
                        }
                    };
                    reader.readAsDataURL(audioBlob); 
                }
            }
            audioChunks = []; 
            liveWaveformSamples = [];
            if (currentAudioStream) {
                currentAudioStream.getTracks().forEach(track => track.stop()); 
                currentAudioStream = null;
            }
            isRecording = false;
            isRecordingPaused = false;
        };

        mediaRecorder.start(100);
        isRecording = true;
        isRecordingPaused = false;

        startLiveVisualizer(stream);

        recordingSeconds = 0;
        updateRecTimerDisplay();
        clearInterval(recordingTimerInterval);
        recordingTimerInterval = setInterval(() => {
            if (!isRecordingPaused) {
                recordingSeconds++;
                updateRecTimerDisplay();
            }
        }, 1000);

        if (recOverlay) {
            recOverlay.classList.remove('hidden', 'is-paused');
        }
        if (inputPill) inputPill.classList.add('hidden');
        if (sendMicBtn) sendMicBtn.classList.add('hidden');

    } catch(err) { 
        isRecording = false; 
        console.error('Microphone access error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            showToast("Microphone permission was denied. Please allow mic access in your browser settings.");
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            showToast("No microphone found on this device.");
        } else {
            showToast("Microphone error: " + (err.message || "Please check permissions."));
        }
    }
}

function stopRecording(cancel = false) {
    isRecordingCancelled = cancel;
    cleanupPreviewAudio();
    if (isRecording && mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
            if (typeof mediaRecorder.requestData === 'function') {
                try { mediaRecorder.requestData(); } catch(e){}
            }
            mediaRecorder.stop();
        } catch(err) {
            console.error('Error stopping MediaRecorder:', err);
        }
        isRecording = false;
        hapticFeedback(cancel ? 'light' : 'heavy'); 
    } else {
        if (recOverlay) {
            recOverlay.classList.remove('is-paused');
            recOverlay.classList.add('hidden');
        }
        if (inputPill) inputPill.classList.remove('hidden');
        if (sendMicBtn) sendMicBtn.classList.remove('hidden');
    }
}

function togglePauseRecording() {
    if (!isRecording || !mediaRecorder) return;
    hapticFeedback('medium');

    const playSvg = pauseRecBtn?.querySelector('.rec-play-svg');
    const pauseSvg = pauseRecBtn?.querySelector('.rec-pause-svg');

    if (!isRecordingPaused) {
        // Pause active recording and prepare preview
        isRecordingPaused = true;
        if (mediaRecorder.state === 'recording') {
            mediaRecorder.pause();
        }
        stopLiveVisualizer();
        if (recOverlay) recOverlay.classList.add('is-paused');

        if (playSvg) playSvg.classList.remove('hidden');
        if (pauseSvg) pauseSvg.classList.add('hidden');

        // Request available chunks to build preview
        if (typeof mediaRecorder.requestData === 'function') {
            try { mediaRecorder.requestData(); } catch(e){}
        }

        setTimeout(() => {
            const finalMime = mediaRecorder.mimeType || 'audio/webm';
            const audioBlob = new Blob(audioChunks, { type: finalMime });
            if (recBlobUrl) URL.revokeObjectURL(recBlobUrl);
            recBlobUrl = URL.createObjectURL(audioBlob);

            if (recPreviewAudio) {
                recPreviewAudio.pause();
                recPreviewAudio = null;
            }
            recPreviewAudio = new Audio(recBlobUrl);
            recPreviewAudio.onended = () => {
                if (playSvg) playSvg.classList.remove('hidden');
                if (pauseSvg) pauseSvg.classList.add('hidden');
                pauseRecBtn?.classList.remove('is-preview-playing');
                updateRecTimerDisplay();
            };
            recPreviewAudio.ontimeupdate = () => {
                if (recPreviewAudio && !recPreviewAudio.paused && recTimer) {
                    const cur = Math.floor(recPreviewAudio.currentTime);
                    const m = Math.floor(cur / 60);
                    const s = cur % 60;
                    recTimer.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
                }
            };
        }, 60);

    } else {
        // Currently paused in preview mode: toggle preview playback
        if (recPreviewAudio) {
            if (recPreviewAudio.paused) {
                recPreviewAudio.play().catch(e => console.log('Preview playback error:', e));
                pauseRecBtn?.classList.add('is-preview-playing');
                if (playSvg) playSvg.classList.add('hidden');
                if (pauseSvg) pauseSvg.classList.remove('hidden');
            } else {
                recPreviewAudio.pause();
                pauseRecBtn?.classList.remove('is-preview-playing');
                if (playSvg) playSvg.classList.remove('hidden');
                if (pauseSvg) pauseSvg.classList.add('hidden');
            }
        }
    }
}

if (cancelRecBtn) {
    cancelRecBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        stopRecording(true);
    };
}
if (pauseRecBtn) {
    pauseRecBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePauseRecording();
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
// ✅ FLAWLESS SEND & MIC BUTTON (CONSECUTIVE SENDS & VOICE NOTES)
// ==========================
if (sendMicBtn) {
    let lastSendTime = 0;

    // Prevent desktop input blur when clicking the button with mouse
    sendMicBtn.addEventListener('mousedown', (e) => {
        const hasText = input && input.value && input.value.trim().length > 0;
        const currentState = sendMicBtn.dataset.state || (hasText ? 'send' : 'mic');
        if (hasText || currentState === 'send' || currentState === 'check') {
            e.preventDefault();
        }
    });

    function doSendMessage(e) {
        if (e && e.cancelable) {
            e.preventDefault();
        }
        const now = Date.now();
        if (now - lastSendTime < 350) return;
        lastSendTime = now;

        sendMessage();
    }

    function doMicAction(e) {
        if (e && e.cancelable) {
            e.preventDefault();
        }
        const now = Date.now();
        if (now - lastSendTime < 350) return;
        lastSendTime = now;

        if (!isRecording) {
            startRecording(e);
        }
    }

    // Immediate touch-up execution for mobile:
    // Prevents the 300ms click delay and eliminates any chance that keyboard dismissal cancels the click
    sendMicBtn.addEventListener('touchend', (e) => {
        const hasText = input && input.value && input.value.trim().length > 0;
        const currentState = sendMicBtn.dataset.state || (hasText ? 'send' : 'mic');

        if (hasText || currentState === 'send' || currentState === 'check') {
            doSendMessage(e);
        } else {
            handleHoldRelease(e);
        }
    });

    // Standard click event for desktop mouse and non-touch devices
    sendMicBtn.addEventListener('click', (e) => {
        const hasText = input && input.value && input.value.trim().length > 0;
        const currentState = sendMicBtn.dataset.state || (hasText ? 'send' : 'mic');

        if (hasText || currentState === 'send' || currentState === 'check') {
            doSendMessage(e);
        } else {
            doMicAction(e);
        }
    });

    function handleHoldRelease(e) {
        if (isRecording && !isRecordingPaused && (Date.now() - recordStartTime > 1000)) {
            stopRecording(false);
        }
    }

    sendMicBtn.addEventListener('mouseup', handleHoldRelease);
    sendMicBtn.addEventListener('contextmenu', e => e.preventDefault());
}

if (messages) {
    messages.addEventListener('touchstart', () => {
        if (input && document.activeElement === input) {
            input.blur();
        }
    }, { passive: true });
}

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
        const savedWp = (typeof activeRoomId !== 'undefined' && activeRoomId && localStorage.getItem('wallpaper_' + activeRoomId)) || localStorage.getItem('chitchat_global_wallpaper') || 'default';
        const cleanKey = savedWp.startsWith('pattern:') ? savedWp.replace('pattern:', '') : (savedWp.startsWith('#') || savedWp.startsWith('rgb') || savedWp.startsWith('data:') ? '' : 'default');
        document.querySelectorAll('.wp-card').forEach(c => {
            c.classList.toggle('active', c.dataset.wp === cleanKey);
        });
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
        showToast(`${name} design applied`);
    };
});

// Solid color wallpaper tint apply
const btnApplyColorWp = document.getElementById('btn-apply-color-wp');
const custColorPicker = document.getElementById('cust-color-picker');
if (btnApplyColorWp && custColorPicker) {
    btnApplyColorWp.onclick = () => {
        const color = custColorPicker.value;
        setAndSaveWallpaper(color);
        showToast('Custom color tint applied!');
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
function triggerReactionParticles() {
    // Reaction particles disabled to keep chat clean and emoji-free
}

// Service Worker Registration & Web Push Init
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((reg) => {
            console.log('Service Worker registered with scope:', reg.scope);
            if (Notification.permission === 'granted') {
                registerWebPushSubscription(false);
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


// Read Receipts Settings Toggle
const toggleReadReceipts = document.getElementById('toggle-read-receipts');
if (toggleReadReceipts) {
    toggleReadReceipts.checked = readReceiptsEnabled;
    toggleReadReceipts.addEventListener('change', (e) => {
        readReceiptsEnabled = e.target.checked;
        localStorage.setItem('chitChat_readReceipts', readReceiptsEnabled ? 'true' : 'false');
        hapticFeedback('light');
        showToast(readReceiptsEnabled ? 'Read Receipts Enabled' : 'Read Receipts Disabled');
        if (readReceiptsEnabled) emitMarkRead();
    });
}

// ==========================================
// 🔗 Rich Link Previews Client Engine
// ==========================================
const clientLinkPreviewCache = new Map();

function extractUrlFromText(text) {
    if (!text || typeof text !== 'string') return null;
    const urlPattern = /(https?:\/\/[^\s<]+)/i;
    const match = text.match(urlPattern);
    return match ? match[0] : null;
}

async function attachAutoLinkPreview(messageLi, text) {
    const targetUrl = extractUrlFromText(text);
    if (!targetUrl) return;

    try {
        let preview = clientLinkPreviewCache.get(targetUrl);
        if (!preview) {
            const resp = await fetch(`/api/link-preview?url=${encodeURIComponent(targetUrl)}`);
            if (!resp.ok) return;
            preview = await resp.json();
            if (preview && preview.success) {
                clientLinkPreviewCache.set(targetUrl, preview);
            }
        }

        if (!preview || !preview.success || (!preview.title && !preview.image)) return;
        if (!messageLi || !messageLi.isConnected || messageLi.querySelector('.link-preview-card')) return;

        const card = document.createElement('a');
        card.className = 'link-preview-card';
        card.href = preview.url;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';

        let imgHTML = '';
        if (preview.image) {
            imgHTML = `
                <div class="link-preview-img-wrap">
                    <img src="${escapeHTML(preview.image)}" class="link-preview-img" alt="${escapeHTML(preview.title || 'Preview')}" loading="lazy">
                </div>
            `;
        }

        card.innerHTML = `
            ${imgHTML}
            <div class="link-preview-info">
                <span class="link-preview-domain">${escapeHTML(preview.domain || '')}</span>
                <h4 class="link-preview-title">${escapeHTML(preview.title || preview.domain || 'Link')}</h4>
                ${preview.description ? `<p class="link-preview-desc">${escapeHTML(preview.description)}</p>` : ''}
            </div>
        `;

        const bubble = messageLi.querySelector('.message-bubble') || messageLi;
        bubble.appendChild(card);
    } catch (e) {
        // fail safe
    }
}

// ==========================================
// 🗄️ Media, Files & Links Vault
// ==========================================
const mediaVaultModal = document.getElementById('media-vault-modal');
const btnOpenMediaVault = document.getElementById('btn-open-media-vault');
const closeMediaVaultBtn = document.getElementById('close-media-vault-btn');
const vaultRoomLabel = document.getElementById('vault-room-label');

const tabVaultMedia = document.getElementById('tab-vault-media');
const tabVaultAudio = document.getElementById('tab-vault-audio');
const tabVaultLinks = document.getElementById('tab-vault-links');

const vaultPaneMedia = document.getElementById('vault-pane-media');
const vaultPaneAudio = document.getElementById('vault-pane-audio');
const vaultPaneLinks = document.getElementById('vault-pane-links');

const vaultMediaGrid = document.getElementById('vault-media-grid');
const vaultMediaEmpty = document.getElementById('vault-media-empty');
const vaultAudioList = document.getElementById('vault-audio-list');
const vaultAudioEmpty = document.getElementById('vault-audio-empty');
const vaultLinksList = document.getElementById('vault-links-list');
const vaultLinksEmpty = document.getElementById('vault-links-empty');

function switchVaultTab(tabName) {
    [tabVaultMedia, tabVaultAudio, tabVaultLinks].forEach(btn => {
        if (btn) btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    if (vaultPaneMedia) vaultPaneMedia.classList.toggle('hidden', tabName !== 'media');
    if (vaultPaneAudio) vaultPaneAudio.classList.toggle('hidden', tabName !== 'audio');
    if (vaultPaneLinks) vaultPaneLinks.classList.toggle('hidden', tabName !== 'links');
}

if (tabVaultMedia) tabVaultMedia.onclick = () => switchVaultTab('media');
if (tabVaultAudio) tabVaultAudio.onclick = () => switchVaultTab('audio');
if (tabVaultLinks) tabVaultLinks.onclick = () => switchVaultTab('links');

function populateMediaVault() {
    if (vaultRoomLabel) {
        const roomName = (currentRoomName && currentRoomName.textContent) ? currentRoomName.textContent : 'This Room';
        vaultRoomLabel.textContent = `Shared in ${roomName}`;
    }

    if (vaultMediaGrid) vaultMediaGrid.innerHTML = '';
    if (vaultAudioList) vaultAudioList.innerHTML = '';
    if (vaultLinksList) vaultLinksList.innerHTML = '';

    const messageEls = document.querySelectorAll('#messages li:not(.system-message)');
    let mediaCount = 0;
    let audioCount = 0;
    let linkCount = 0;

    messageEls.forEach(li => {
        const sender = li.dataset.sender || 'Friend';
        const timeEl = li.querySelector('.message-time');
        const timeStr = timeEl ? timeEl.textContent : '';

        // 1. Photos & Videos
        const imgEl = li.querySelector('.chat-image');
        const videoEl = li.querySelector('.chat-video');
        if (imgEl && imgEl.src) {
            mediaCount++;
            const thumb = document.createElement('div');
            thumb.className = 'vault-media-thumb';
            thumb.innerHTML = `<img src="${escapeHTML(imgEl.src)}" alt="Shared Photo" loading="lazy">`;
            thumb.onclick = () => {
                openLightboxModal(imgEl.src);
            };
            vaultMediaGrid.appendChild(thumb);
        } else if (videoEl && videoEl.src) {
            mediaCount++;
            const thumb = document.createElement('div');
            thumb.className = 'vault-media-thumb';
            thumb.innerHTML = `<video src="${escapeHTML(videoEl.src)}" muted playsinline></video>`;
            thumb.onclick = () => {
                openLightboxModal(videoEl.src);
            };
            vaultMediaGrid.appendChild(thumb);
        }

        // 2. Audio / Voice Notes
        const audioPlayer = li.querySelector('.custom-audio-player');
        if (audioPlayer) {
            const audioSrc = audioPlayer.dataset.audioSrc;
            if (audioSrc) {
                audioCount++;
                const row = document.createElement('div');
                row.className = 'vault-item-row';
                row.innerHTML = `
                    <div class="vault-item-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                    </div>
                    <div class="vault-item-info">
                        <span class="vault-item-title">${escapeHTML(sender)}</span>
                        <span class="vault-item-sub">Voice Note • ${escapeHTML(timeStr)}</span>
                    </div>
                    <audio controls src="${escapeHTML(audioSrc)}" preload="none"></audio>
                `;
                vaultAudioList.appendChild(row);
            }
        }

        // 3. Links
        const textNode = li.querySelector('.message-text');
        if (textNode) {
            const rawText = textNode.textContent || '';
            const foundUrl = extractUrlFromText(rawText);
            if (foundUrl) {
                linkCount++;
                let parsedDomain = foundUrl;
                try {
                    parsedDomain = new URL(foundUrl).hostname.replace(/^www\./, '');
                } catch(e) {}

                const row = document.createElement('div');
                row.className = 'vault-item-row';
                row.innerHTML = `
                    <div class="vault-item-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    </div>
                    <div class="vault-item-info">
                        <span class="vault-item-title">${escapeHTML(parsedDomain)}</span>
                        <span class="vault-item-sub">${escapeHTML(foundUrl.substring(0, 50))}...</span>
                    </div>
                    <a href="${escapeHTML(foundUrl)}" target="_blank" rel="noopener noreferrer" class="icon-btn" title="Open Link" aria-label="Open Link">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                    </a>
                `;
                vaultLinksList.appendChild(row);
            }
        }
    });

    if (vaultMediaEmpty) vaultMediaEmpty.classList.toggle('hidden', mediaCount > 0);
    if (vaultAudioEmpty) vaultAudioEmpty.classList.toggle('hidden', audioCount > 0);
    if (vaultLinksEmpty) vaultLinksEmpty.classList.toggle('hidden', linkCount > 0);
}

if (btnOpenMediaVault) {
    btnOpenMediaVault.onclick = () => {
        if (groupInfoModal) groupInfoModal.classList.add('hidden');
        populateMediaVault();
        switchVaultTab('media');
        if (mediaVaultModal) mediaVaultModal.classList.remove('hidden');
    };
}

if (closeMediaVaultBtn) {
    closeMediaVaultBtn.onclick = () => {
        if (mediaVaultModal) mediaVaultModal.classList.add('hidden');
    };
}

// Lightbox Modal
const lightboxCloseBtn = document.getElementById('lightbox-close-btn');
const lightboxDownloadBtn = document.getElementById('lightbox-download-btn');

function openLightboxModal(src) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    if (lightboxDownloadBtn) lightboxDownloadBtn.href = src;
    lightbox.classList.remove('hidden');
}

if (lightboxCloseBtn) {
    lightboxCloseBtn.onclick = (e) => {
        e.stopPropagation();
        closeLightbox();
    };
}



