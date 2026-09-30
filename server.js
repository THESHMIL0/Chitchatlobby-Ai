const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { GoogleGenAI } = require('@google/genai');
const webPush = require('web-push');

const app = express();
const server = http.createServer(app);

// Disable X-Powered-By header to prevent info disclosure
app.disable('x-powered-by');

// Trust reverse proxies (such as Render.com proxy)
app.set('trust proxy', 1);

// HTTP Security Headers via Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "/socket.io/socket.io.js"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:", "https://api.dicebear.com"],
            mediaSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "ws:", "wss:", "https://api.dicebear.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
    },
    crossOriginEmbedderPolicy: false
}));

// Setup Web Push VAPID keys with persistence
const VAPID_KEY_FILE = path.join(__dirname, 'vapid-keys.json');
let vapidKeys = {
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    if (fs.existsSync(VAPID_KEY_FILE)) {
        try {
            vapidKeys = JSON.parse(fs.readFileSync(VAPID_KEY_FILE, 'utf8'));
        } catch (e) {
            console.error('Error reading vapid-keys.json:', e);
        }
    }
    if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
        vapidKeys = webPush.generateVAPIDKeys();
        try {
            fs.writeFileSync(VAPID_KEY_FILE, JSON.stringify(vapidKeys, null, 2));
        } catch (e) {
            console.error('Error writing vapid-keys.json:', e);
        }
    }
}

try {
    webPush.setVapidDetails(
        'mailto:support@chitchat.app',
        vapidKeys.publicKey,
        vapidKeys.privateKey
    );
} catch (e) {
    console.error('VAPID setup error:', e);
}

// Push subscriptions with bounded in-memory cache & file persistence
const SUB_FILE = path.join(__dirname, 'push-subscriptions.json');
const pushSubscriptions = new Map(); // endpoint -> { userName, subscription }

function loadPushSubscriptions() {
    if (fs.existsSync(SUB_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(SUB_FILE, 'utf8'));
            if (Array.isArray(data)) {
                data.forEach(item => {
                    if (item && item.subscription && item.subscription.endpoint) {
                        pushSubscriptions.set(item.subscription.endpoint, item);
                    }
                });
                console.log(`Loaded ${pushSubscriptions.size} push subscriptions.`);
            }
        } catch (e) {
            console.error('Error loading push subscriptions:', e);
        }
    }
}

function savePushSubscriptions() {
    try {
        // Enforce max 2,000 subscriptions to prevent memory exhaustion
        while (pushSubscriptions.size > 2000) {
            const oldestKey = pushSubscriptions.keys().next().value;
            pushSubscriptions.delete(oldestKey);
        }
        const data = Array.from(pushSubscriptions.values());
        fs.writeFileSync(SUB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error saving push subscriptions:', e);
    }
}

loadPushSubscriptions();

function sendPushToAllExceptSender(senderEndpoint, senderName, roomName, roomId, summaryText, avatar) {
    const safeSummary = (summaryText || 'Sent a message').substring(0, 180);
    const safeSender = (senderName || 'Someone').substring(0, 30);
    const payload = JSON.stringify({
        title: `${safeSender}${roomName ? ' in ' + roomName : ''}`,
        body: safeSummary,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        url: `/?room=${encodeURIComponent(roomId || 'lobby')}`,
        roomId: roomId || 'lobby'
    });

    let dirty = false;
    pushSubscriptions.forEach(({ userName, subscription }, endpoint) => {
        if (!senderEndpoint || endpoint !== senderEndpoint) {
            webPush.sendNotification(subscription, payload).catch(err => {
                if (err.statusCode === 404 || err.statusCode === 410) {
                    pushSubscriptions.delete(endpoint);
                    dirty = true;
                    savePushSubscriptions();
                } else {
                    console.error('Error delivering Web Push notification:', err.message);
                }
            });
        }
    });
}

// Socket.IO Server with strict buffer limits (12MB) to prevent memory-exhaustion DoS
const io = new Server(server, { 
    maxHttpBufferSize: 12 * 1024 * 1024,
    cors: { origin: "*", methods: ["GET", "POST"] }
}); 

// Express Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '6mb' }));

// Rate Limiters for HTTP API Endpoints
const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down.' }
});

const pushRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Push notification rate limit reached, please try again later.' }
});

app.use('/api/', apiRateLimiter);
app.use('/api/push/send-test', pushRateLimiter);
app.use('/api/push/subscribe', pushRateLimiter);

app.get('/api/push/vapid-public-key', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/push/subscribe', (req, res) => {
    const { userName, subscription } = req.body;
    if (subscription && typeof subscription === 'object' && typeof subscription.endpoint === 'string' && subscription.endpoint.startsWith('https://')) {
        const cleanName = typeof userName === 'string' ? userName.trim().substring(0, 30) : 'Guest';
        pushSubscriptions.set(subscription.endpoint, { userName: cleanName, subscription });
        savePushSubscriptions();
        res.status(201).json({ success: true, totalSubscriptions: pushSubscriptions.size });
    } else {
        res.status(400).json({ error: 'Invalid push subscription payload or insecure endpoint' });
    }
});

app.post('/api/push/unsubscribe', (req, res) => {
    const { endpoint } = req.body;
    if (endpoint && typeof endpoint === 'string') {
        pushSubscriptions.delete(endpoint);
        savePushSubscriptions();
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Invalid endpoint' });
    }
});

app.post('/api/push/send-test', (req, res) => {
    const { endpoint, userName, delayMs } = req.body;
    if (!endpoint || typeof endpoint !== 'string') {
        return res.status(400).json({ error: 'Endpoint is required' });
    }
    const subObj = pushSubscriptions.get(endpoint);
    if (!subObj) {
        return res.status(404).json({ error: 'Subscription not found on server. Please re-subscribe.' });
    }
    const safeUserName = typeof userName === 'string' ? userName.trim().substring(0, 30) : 'Friend';
    const payload = JSON.stringify({
        title: 'ChitChat Push Test 🔔',
        body: `Hello ${safeUserName}! Web Push is securely configured! 🎉`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        url: '/',
        roomId: 'lobby'
    });

    const delay = Math.min(Math.max(parseInt(delayMs, 10) || 0, 0), 10000);
    if (delay > 0) {
        res.json({ success: true, delayed: true, delayMs: delay });
        setTimeout(() => {
            webPush.sendNotification(subObj.subscription, payload).catch(err => {
                console.error('Delayed test push error:', err.message);
            });
        }, delay);
    } else {
        webPush.sendNotification(subObj.subscription, payload)
            .then(() => res.json({ success: true }))
            .catch(err => {
                console.error('Test push error:', err);
                res.status(500).json({ error: err.message });
            });
    }
});

// ==========================================
// 🔐 Cryptographic Utilities for Room Passwords
// ==========================================
function hashPassword(password) {
    if (!password) return '';
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
    if (!storedPassword) return false;
    // Backwards-compatibility for older plaintext entries
    if (!storedPassword.includes(':')) {
        return password === storedPassword;
    }
    try {
        const [salt, key] = storedPassword.split(':');
        const keyBuffer = Buffer.from(key, 'hex');
        const derivedKey = crypto.scryptSync(password, salt, 64);
        return crypto.timingSafeEqual(keyBuffer, derivedKey);
    } catch (e) {
        return false;
    }
}

// ==========================================
// 💾 Data Storage with Auto-Save Persistence
// ==========================================
const DATA_FILE = path.join(__dirname, 'chat-data.json');

const rooms = new Map([
    ['lobby', { id: 'lobby', name: 'Lobby 😸', logo: '', isPrivate: 0, password: '', pinnedMessage: null, createdBy: 'system' }],
    ['ai_lounge', { id: 'ai_lounge', name: '🤖 AI Lounge', logo: 'https://api.dicebear.com/7.x/bottts/svg?seed=ChitChatBot&backgroundColor=00a884', isPrivate: 0, password: '', pinnedMessage: null, createdBy: 'system' }]
]);

const historyStore = []; // Array of { id, roomId, timestamp, data }
const usersStore = new Map(); // name -> { name, avatar, about, isOnline, lastSeen, bubbleColor }

function loadChatData() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            if (Array.isArray(raw.rooms)) {
                raw.rooms.forEach(([id, room]) => {
                    rooms.set(id, room);
                });
            }
            if (Array.isArray(raw.historyStore)) {
                historyStore.push(...raw.historyStore);
            }
            if (Array.isArray(raw.usersStore)) {
                raw.usersStore.forEach(([name, user]) => {
                    usersStore.set(name, { ...user, isOnline: 0 });
                });
            }
            console.log(`Restored persistent data: ${rooms.size} rooms, ${historyStore.length} messages.`);
        } catch (e) {
            console.error('Error reading chat-data.json:', e);
        }
    }
}

loadChatData();

let saveTimeout = null;
function scheduleDataSave() {
    if (saveTimeout) return;
    saveTimeout = setTimeout(() => {
        saveTimeout = null;
        try {
            const payload = {
                rooms: Array.from(rooms.entries()),
                historyStore: historyStore.slice(-600), // retain recent 600 history items
                usersStore: Array.from(usersStore.entries())
            };
            fs.writeFileSync(DATA_FILE, JSON.stringify(payload, null, 2));
        } catch (e) {
            console.error('Error saving chat-data.json:', e);
        }
    }, 1500);
}

const db = {
    serialize(fn) { if (fn) fn(); },
    run(sql, params = [], cb) {
        if (typeof params === 'function') { cb = params; params = []; }
        try {
            if (sql.includes('INSERT INTO rooms') || sql.includes('INSERT OR REPLACE INTO rooms')) {
                const [id, name, logo, isPrivate, password, createdBy] = params;
                rooms.set(id, { 
                    id, 
                    name: String(name || '').substring(0, 40), 
                    logo: logo || '', 
                    isPrivate: isPrivate ? 1 : 0, 
                    password: password || '', 
                    pinnedMessage: null,
                    createdBy: createdBy || 'user'
                });
                scheduleDataSave();
            } else if (sql.includes('INSERT INTO history') || sql.includes('INSERT OR REPLACE INTO history')) {
                const [id, roomId, timestamp, data] = params;
                historyStore.push({ id, roomId, timestamp, data });
                scheduleDataSave();
            } else if (sql.includes('INSERT OR REPLACE INTO users')) {
                const [name, avatar, about, isOnline, lastSeen, bubbleColor] = params;
                usersStore.set(name, { name, avatar, about, isOnline, lastSeen, bubbleColor });
                scheduleDataSave();
            } else if (sql.includes('UPDATE users SET isOnline')) {
                const [lastSeen, name] = params;
                if (usersStore.has(name)) {
                    const u = usersStore.get(name);
                    u.isOnline = 0;
                    u.lastSeen = lastSeen;
                }
                scheduleDataSave();
            }
            if (cb) cb(null);
        } catch (err) {
            if (cb) cb(err);
        }
    },
    get(sql, params = [], cb) {
        if (typeof params === 'function') { cb = params; params = []; }
        try {
            if (sql.includes('FROM rooms WHERE id = ?')) {
                const id = params[0];
                cb(null, rooms.get(id) || null);
            } else if (sql.includes('FROM rooms WHERE id = \'lobby\'')) {
                cb(null, rooms.get('lobby') || null);
            } else if (sql.includes('FROM rooms WHERE id = \'ai_lounge\'')) {
                cb(null, rooms.get('ai_lounge') || null);
            } else {
                cb(null, null);
            }
        } catch (err) {
            cb(err, null);
        }
    },
    all(sql, params = [], cb) {
        if (typeof params === 'function') { cb = params; params = []; }
        try {
            if (sql.includes('FROM rooms')) {
                const list = Array.from(rooms.values());
                cb(null, list);
            } else if (sql.includes('FROM history WHERE roomId = ?')) {
                const roomId = params[0];
                const roomHistory = historyStore
                    .filter(h => h.roomId === roomId)
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .slice(-60);
                cb(null, roomHistory);
            } else {
                cb(null, []);
            }
        } catch (err) {
            cb(err, []);
        }
    }
};

const activeUsersById = {}; 

function getUsersInRoom(roomId) { 
    return Object.values(activeUsersById).filter(u => u.roomId === roomId).map(u => u.name); 
}

function broadcastRooms(targetSocket = io) { 
    db.all(`SELECT id, name, logo, isPrivate FROM rooms`, (err, rows) => { 
        if (rows) {
            // Strictly exclude room passwords from client broadcasts
            const safeRooms = rows.map(r => ({
                id: r.id,
                name: r.name,
                logo: r.logo,
                isPrivate: r.isPrivate === 1
            }));
            targetSocket.emit('room list', safeRooms);
        }
    }); 
}

// ==========================================
// 🛡️ Socket Rate Limiting & Cooldown Engine
// ==========================================
const socketRateLimits = new Map(); // socket.id -> { count, lastReset }

function checkSocketRateLimit(socketId, maxPerInterval = 10, intervalMs = 2000) {
    const now = Date.now();
    let limiter = socketRateLimits.get(socketId);
    if (!limiter || (now - limiter.lastReset > intervalMs)) {
        limiter = { count: 1, lastReset: now };
        socketRateLimits.set(socketId, limiter);
        return true;
    }
    limiter.count++;
    if (limiter.count > maxPerInterval) {
        return false;
    }
    return true;
}

const botCooldownByRoom = new Map(); // roomId -> timestamp

function canTriggerBotInRoom(roomId, cooldownMs = 2800) {
    const now = Date.now();
    const last = botCooldownByRoom.get(roomId) || 0;
    if (now - last < cooldownMs) return false;
    botCooldownByRoom.set(roomId, now);
    return true;
}

// ==========================================
// 🤖 AI Bot Logic (Gemini API & Fallback)
// ==========================================
let aiClient = null;
function getAIClient() {
    if (!aiClient && process.env.GEMINI_API_KEY) {
        try {
            aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        } catch (e) {
            console.error('Failed to init GoogleGenAI client:', e);
        }
    }
    return aiClient;
}

async function askSmartBot(prompt) {
    const textPrompt = (prompt || "hello").trim().substring(0, 1000);
    
    const systemInstructionText = `You are a helpful, clear, and friendly AI assistant.
Follow these rules strictly:
1. Provide clear, accurate, and direct responses (1 to 3 sentences).
2. Use clear, natural, standard English without forced texting slang or abbreviations.
3. Be helpful, courteous, and polite at all times.
4. Ensure every response is complete and well-structured.`;

    // 1. Try Gemini API using current flash models
    if (process.env.GEMINI_API_KEY) {
        try {
            const client = getAIClient();
            if (client) {
                const fetchPromise = (async () => {
                    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
                    for (const modelName of modelsToTry) {
                        try {
                            const response = await client.models.generateContent({
                                model: modelName,
                                contents: `Instructions: ${systemInstructionText}\n\nUser message: ${textPrompt}`,
                                config: {
                                    maxOutputTokens: 300,
                                    temperature: 0.7
                                }
                            });
                            if (response && response.text) {
                                const trimmed = response.text.trim();
                                if (trimmed && trimmed.length > 2) return trimmed;
                            }
                        } catch (err) {
                            // Fallback to next model
                        }
                    }
                    return null;
                })();

                const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 6000));
                const result = await Promise.race([fetchPromise, timeoutPromise]);
                if (result) return result;
            }
        } catch (e) {
            console.error("Gemini API error:", e);
        }
    }

    // 2. High-Quality Natural Fallback Engine
    const lower = textPrompt.toLowerCase().trim();

    if (lower.includes('one piece') || lower.includes('anime') || lower.includes('naruto') || lower.includes('manga') || lower.includes('luffy')) {
        const animeAnswers = [
            "One Piece is a great series! Who is your favorite character in it?",
            "Anime is very popular! Luffy's story is definitely memorable.",
            "That's a fantastic choice. Which arc or series are you watching right now?"
        ];
        return animeAnswers[Math.floor(Math.random() * animeAnswers.length)];
    }

    if (lower.includes('hbu') || lower.includes('wbu') || lower.includes('what about you') || lower.includes('how about you') || lower.includes('how about u')) {
        const hbuAnswers = [
            "I'm doing well, thank you for asking! How is your day going?",
            "I'm here and ready to help! What are you working on today?",
            "Doing great! How can I assist you today?"
        ];
        return hbuAnswers[Math.floor(Math.random() * hbuAnswers.length)];
    }

    if (lower.includes('good') || lower.includes('great') || lower.includes('fine') || lower.includes('chillin') || lower.includes('doing well')) {
        const goodAnswers = [
            "Glad to hear that you are doing well! How can I help you today?",
            "That's wonderful to hear! Is there anything on your mind?",
            "Great! I hope you have a fantastic day ahead."
        ];
        return goodAnswers[Math.floor(Math.random() * goodAnswers.length)];
    }

    if (lower.includes('happened') || lower.includes('know what') || lower.includes('guess what')) {
        return "I'm curious! What happened? Feel free to share.";
    }

    if (lower.includes('nothing') || lower.includes('nothin') || lower.includes('nada')) {
        const nothingAnswers = [
            "Fair enough! Let me know if you need any assistance later.",
            "No problem at all. Enjoy your relaxing time!",
            "Understood! Feel free to ask if you have any questions."
        ];
        return nothingAnswers[Math.floor(Math.random() * nothingAnswers.length)];
    }

    if (lower.includes('doing') || lower.includes('watcha') || lower.includes('wyd') || lower.includes('what are you doing')) {
        const doingList = [
            "I'm here ready to answer questions or assist you with anything you need!",
            "Just processing messages and helping out. How can I assist you today?",
            "I am active and ready to help. What are you up to?"
        ];
        return doingList[Math.floor(Math.random() * doingList.length)];
    }

    if (lower === 'bro' || lower === 'dude' || lower === 'yo' || lower === 'sup' || lower === 'hi' || lower === 'hey' || lower.includes('hello')) {
        const greetings = [
            "Hello! How can I help you today?",
            "Hi there! How is your day going?",
            "Greetings! Feel free to ask me anything."
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
    }

    if (lower.includes('how are you') || lower.includes('how u doing') || lower.includes('how are u') || lower.includes('how r u')) {
        return "I am doing well, thank you! How are you doing today?";
    }

    if (lower.includes('name') || lower.includes('who are you') || lower.includes('who r u') || lower.includes('what are you')) {
        return "I am an AI assistant here to answer your questions and assist you in chat.";
    }

    if (lower.includes('time') || lower.includes('clock') || lower.includes('date')) {
        return `The current time is ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}.`;
    }

    if (lower.includes('joke') || lower.includes('funny')) {
        const jokes = [
            "Why do programmers prefer dark mode? Because light attracts bugs!",
            "Why did the computer visit the doctor? Because it had a virus!",
            "What do you call 8 hobbits? A hobbyte!"
        ];
        return jokes[Math.floor(Math.random() * jokes.length)];
    }

    if (lower.includes('help') || lower.includes('feature') || lower.includes('what can you do')) {
        return "I can answer questions, discuss topics, or help you chat. You can mention me with @Bot or visit the AI Lounge!";
    }

    if (lower.includes('weather')) {
        return "I don't have live weather sensor data right now, but I hope it's pleasant wherever you are!";
    }

    if (lower.includes('thanks') || lower.includes('thank you') || lower.includes('thx') || lower.includes('ty')) {
        return "You're very welcome! Let me know if you need anything else.";
    }

    if (lower.includes('lol') || lower.includes('lmao') || lower.includes('haha') || lower.includes('rofl')) {
        return "Glad to bring some humor to the conversation! What else is on your mind?";
    }

    if (lower.endsWith('?')) {
        const questionsAnswers = [
            "That's an interesting question. What are your thoughts on it?",
            "That is a good point to consider. Tell me more about what you think.",
            "I'd say that depends on the context, but it sounds worth exploring!"
        ];
        return questionsAnswers[Math.floor(Math.random() * questionsAnswers.length)];
    }

    const normalFallbacks = [
        `That sounds interesting! Could you tell me more about that?`,
        `Thank you for sharing that. What else would you like to discuss?`,
        `I see! Feel free to ask if you have any questions about this.`,
        `That makes sense. What else is on your mind today?`
    ];
    return normalFallbacks[Math.floor(Math.random() * normalFallbacks.length)];
}

// ==========================================
// 🔌 Socket.IO Event Handlers with Security Checks
// ==========================================
io.on('connection', (socket) => {
    broadcastRooms(socket);

    socket.on('create room', (data) => {
        if (!checkSocketRateLimit(socket.id, 4, 30000)) {
            return socket.emit('rate limit', 'Room creation limit reached. Please wait a minute.');
        }

        if (!data || typeof data !== 'object' || !data.name || typeof data.name !== 'string') {
            return socket.emit('action error', 'Room name is required.');
        }

        const cleanName = data.name.trim().substring(0, 40);
        if (!cleanName) return socket.emit('action error', 'Invalid room name.');

        const roomId = 'room_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex');
        const isPrivate = data.isPrivate ? 1 : 0;
        const hashedPassword = (isPrivate && data.password) ? hashPassword(String(data.password)) : '';

        let cleanLogo = '';
        if (data.logo && typeof data.logo === 'string') {
            if (data.logo.startsWith('https://') || data.logo.startsWith('data:image/') || data.logo.startsWith('/')) {
                cleanLogo = data.logo.substring(0, 500);
            }
        }

        const creatorId = activeUsersById[socket.id]?.userId || socket.id;

        db.run(`INSERT INTO rooms VALUES (?, ?, ?, ?, ?, ?)`, 
            [roomId, cleanName, cleanLogo, isPrivate, hashedPassword, creatorId], 
            () => broadcastRooms()
        );
    });

    socket.on('join room', (data) => {
        if (!data || typeof data !== 'object' || !data.roomId) {
            return socket.emit('join error', 'Invalid room requested');
        }

        db.get(`SELECT * FROM rooms WHERE id = ?`, [data.roomId], (err, room) => {
            if (!room) return socket.emit('join error', 'Room not found');

            // Constant-time cryptographically secure password verification
            if (room.isPrivate) {
                const inputPassword = String(data.password || '');
                if (!verifyPassword(inputPassword, room.password)) {
                    return socket.emit('join error', 'Wrong password');
                }
            }

            socket.rooms.forEach(r => r !== socket.id && socket.leave(r));
            socket.join(room.id);

            const userObj = data.user || {};
            const cleanName = String(userObj.name || 'Guest').trim().substring(0, 30);
            const safeAvatar = (userObj.avatar && (userObj.avatar.startsWith('https://') || userObj.avatar.startsWith('data:image/') || userObj.avatar.startsWith('/')))
                ? userObj.avatar.substring(0, 500)
                : '';
            const safeAbout = String(userObj.about || 'Using Chit Chat').substring(0, 100);
            const safeColor = String(userObj.color || '#dcf8c6').substring(0, 20);
            const userId = String(userObj.id || ('usr_' + socket.id));

            activeUsersById[socket.id] = { 
                name: cleanName, 
                avatar: safeAvatar, 
                about: safeAbout, 
                color: safeColor,
                userId: userId,
                id: userId,
                roomId: room.id 
            };

            db.run("INSERT OR REPLACE INTO users (name, avatar, about, isOnline, lastSeen, bubbleColor) VALUES (?, ?, ?, ?, ?, ?)", 
                [cleanName, safeAvatar, safeAbout, 1, Date.now(), safeColor]);

            // Deliver any pending sent messages to this joining recipient
            const newlyDeliveredIds = [];
            historyStore.forEach(h => {
                if (h.roomId === room.id) {
                    try {
                        const m = typeof h.data === 'string' ? JSON.parse(h.data) : h.data;
                        if (m.userId !== userId && m.user !== cleanName && m.status === 'sent') {
                            m.status = 'delivered';
                            h.data = JSON.stringify(m);
                            newlyDeliveredIds.push(m.id);
                        }
                    } catch (e) {}
                }
            });
            if (newlyDeliveredIds.length > 0) {
                scheduleDataSave();
                io.to(room.id).emit('messages delivered', { roomId: room.id, msgIds: newlyDeliveredIds });
            }

            db.all("SELECT data FROM history WHERE roomId = ?", [room.id], (err, rows) => {
                const history = rows?.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data) || [];
                socket.emit('chat history', { 
                    room: { id: room.id, name: room.name, logo: room.logo, isPrivate: room.isPrivate === 1 }, 
                    history 
                });
            });

            io.to(room.id).emit('room users', getUsersInRoom(room.id));
            if (room.pinnedMessage) {
                socket.emit('pinned updated', room.pinnedMessage);
            }
        });
    });

    socket.on('leave room', () => {
        const roomId = activeUsersById[socket.id]?.roomId;
        if (roomId) {
            socket.leave(roomId); 
            if (activeUsersById[socket.id]) delete activeUsersById[socket.id].roomId;
            io.to(roomId).emit('room users', getUsersInRoom(roomId));
        }
    });

    socket.on('update profile', (user) => {
        if (!user || typeof user !== 'object') return;
        const cleanName = String(user.name || 'Guest').trim().substring(0, 30);
        if (!cleanName || cleanName === '🤖 Bot') return;

        let cleanAvatar = '';
        if (user.avatar && (user.avatar.startsWith('https://') || user.avatar.startsWith('data:image/') || user.avatar.startsWith('/'))) {
            cleanAvatar = user.avatar.substring(0, 500);
        }

        const cleanAbout = String(user.about || 'Using Chit Chat').substring(0, 100);
        const cleanColor = String(user.color || '#dcf8c6').substring(0, 20);

        if (activeUsersById[socket.id]) { 
            activeUsersById[socket.id].name = cleanName; 
            activeUsersById[socket.id].avatar = cleanAvatar; 
            activeUsersById[socket.id].about = cleanAbout; 
            activeUsersById[socket.id].color = cleanColor;
        }

        db.run("INSERT OR REPLACE INTO users (name, avatar, about, isOnline, lastSeen, bubbleColor) VALUES (?, ?, ?, ?, ?, ?)", 
            [cleanName, cleanAvatar, cleanAbout, 1, Date.now(), cleanColor]);
    });

    socket.on('chat message', async (data) => {
        if (!data || typeof data !== 'object') return;

        // Rate limiting check
        if (!checkSocketRateLimit(socket.id, 8, 2000)) {
            return socket.emit('rate limit', 'You are sending messages too quickly. Please slow down.');
        }

        const sessionUser = activeUsersById[socket.id];
        
        // Enforce verified identity and prevent user from impersonating system bot
        let userName = (sessionUser && sessionUser.name) ? sessionUser.name : String(data.user || 'Guest').trim().substring(0, 30);
        if (userName === '🤖 Bot') userName = 'Guest';
        data.user = userName;

        let userAvatar = (sessionUser && sessionUser.avatar) ? sessionUser.avatar : String(data.avatar || '');
        if (userAvatar && !userAvatar.startsWith('https://') && !userAvatar.startsWith('data:image/') && !userAvatar.startsWith('/')) {
            userAvatar = '';
        }
        data.avatar = userAvatar;
        data.userId = (sessionUser && sessionUser.userId) ? sessionUser.userId : (data.userId || ('usr_' + socket.id));

        const roomId = (typeof data.roomId === 'string' && rooms.has(data.roomId))
            ? data.roomId 
            : (sessionUser?.roomId || 'lobby');

                data.id = data.id || (Date.now() + "_" + Math.floor(Math.random() * 1000));
        data.roomId = roomId; 
        data.type = data.type || 'chat'; 
        
        // WhatsApp-style status: 'delivered' if recipients online in room, else 'sent'
        const roomRecipients = Object.entries(activeUsersById).filter(([sId, u]) => 
            sId !== socket.id && u.roomId === roomId && u.name !== data.user
        );
        data.status = roomRecipients.length > 0 ? 'delivered' : 'sent';
        data.senderSocketId = socket.id;

        // Enforce max text length (4000 characters)
        if (data.text) {
            data.text = String(data.text).substring(0, 4000);
        } else {
            data.text = '';
        }

        // Validate attached media payload (max 8MB base64)
        if (data.uploadedImage && typeof data.uploadedImage === 'string') {
            if (data.uploadedImage.length > 8 * 1024 * 1024) {
                return socket.emit('action error', 'Attached media is too large (maximum 8MB).');
            }
        }

        // Validate and sanitize poll object
        if (data.poll && typeof data.poll === 'object') {
            if (!data.poll.question || typeof data.poll.question !== 'string') {
                delete data.poll;
            } else {
                data.poll.question = data.poll.question.substring(0, 160);
                if (!Array.isArray(data.poll.options) || data.poll.options.length < 2) {
                    delete data.poll;
                } else {
                    data.poll.options = data.poll.options.slice(0, 10).map(opt => ({
                        text: String(opt.text || '').substring(0, 80),
                        votes: []
                    }));
                    data.poll.createdBy = data.userId;
                    data.poll.isClosed = false;
                }
            }
        }

        socket.join(roomId);
        if (activeUsersById[socket.id]) {
            activeUsersById[socket.id].roomId = roomId;
        } else {
            activeUsersById[socket.id] = { name: data.user, avatar: data.avatar, userId: data.userId, roomId };
        }

        if (!data.isGhost) {
            db.run("INSERT INTO history VALUES (?, ?, ?, ?)", [data.id, roomId, Date.now(), JSON.stringify(data)]);
        }
        
        io.to(roomId).emit('chat message', data);
        
        db.get(`SELECT name FROM rooms WHERE id = ?`, [roomId], (err, roomRow) => {
            const roomName = roomRow ? roomRow.name : (rooms.get(roomId)?.name || roomId);
            let summaryText = data.text || '';
            if (!summaryText) {
                if (data.isAudio) summaryText = '🎤 Voice Note';
                else if (data.isVideo) summaryText = '🎥 Video';
                else if (data.uploadedImage) summaryText = '📷 Photo';
                else if (data.poll) summaryText = '📊 Poll: ' + (data.poll.question || '');
                else summaryText = 'Sent an attachment';
            }
            const alertData = {
                roomId,
                roomName,
                sender: data.user,
                avatar: data.avatar,
                text: summaryText,
                id: data.id
            };
            socket.broadcast.emit('global room alert', alertData);
            sendPushToAllExceptSender(data.senderEndpoint, data.user, roomName, roomId, summaryText, data.avatar);
        });

        // Handle AI Bot trigger with Cooldown Protection
        const textContent = data.text || '';
        const isBotMention = textContent.toLowerCase().includes('@bot');
        const isAILounge = roomId === 'ai_lounge';
        const isUserBot = data.user === '🤖 Bot';

        if ((isBotMention || isAILounge) && !isUserBot) {
            if (!canTriggerBotInRoom(roomId)) {
                // Rate limited bot invocation in this room
                return;
            }

            // Bot reads the user's message immediately (triggers blue ticks)
            setTimeout(() => {
                const item = historyStore.find(h => h.id === data.id);
                if (item) {
                    try {
                        const m = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
                        m.status = 'read';
                        m.readBy = m.readBy || [];
                        if (!m.readBy.includes('🤖 Bot')) m.readBy.push('🤖 Bot');
                        item.data = JSON.stringify(m);
                        scheduleDataSave();
                    } catch (e) {}
                }
                io.to(roomId).emit('messages read', {
                    roomId,
                    msgIds: [data.id],
                    reader: '🤖 Bot',
                    readAt: Date.now()
                });
            }, 180);

            io.to(roomId).emit('user typing', { name: '🤖 Bot', isTyping: true });
            
            setTimeout(async () => {
                try {
                    let botPrompt = textContent;
                    if (data.replyTo && data.replyTo.text) {
                        botPrompt = `[User is replying to ${String(data.replyTo.user).substring(0, 30)}'s message: "${String(data.replyTo.text).substring(0, 150)}"]\n\nUser response: ${textContent}`;
                    }

                    const reply = await askSmartBot(botPrompt);
                    const botMsg = { 
                        id: Date.now() + "_bot", 
                        user: '🤖 Bot', 
                        text: reply, 
                        roomId, 
                        type: 'chat', 
                        status: 'delivered', 
                        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }), 
                        color: '#00a884', 
                        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=ChitChatBot&backgroundColor=00a884',
                        replyTo: data.replyTo ? { user: data.user, text: textContent.substring(0, 120) || 'Message', msgId: data.id } : null
                    };
                    io.to(roomId).emit('user typing', { name: '🤖 Bot', isTyping: false });
                    db.run("INSERT INTO history VALUES (?, ?, ?, ?)", [botMsg.id, roomId, Date.now(), JSON.stringify(botMsg)]);
                    io.to(roomId).emit('chat message', botMsg);
                    
                    const botSummaryText = reply ? (reply.length > 80 ? reply.substring(0, 80) + '...' : reply) : 'Bot sent a message';
                    sendPushToAllExceptSender(null, '🤖 Bot', rooms.get(roomId)?.name || roomId, roomId, botSummaryText, botMsg.avatar);
                } catch (botErr) {
                    console.error("Bot generation error:", botErr);
                    io.to(roomId).emit('user typing', { name: '🤖 Bot', isTyping: false });
                }
            }, 80);
        }
    });

    socket.on('vote poll', ({ msgId, optionIndex }) => {
        if (!checkSocketRateLimit(socket.id, 10, 2000)) return;

        const item = historyStore.find(h => h.id === msgId);
        if (item) {
            const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
            if (data.poll && !data.poll.isClosed && data.poll.options[optionIndex]) {
                const user = activeUsersById[socket.id]?.name || 'Guest';
                const opt = data.poll.options[optionIndex];
                opt.votes = opt.votes || [];

                if (data.poll.isMultiple) {
                    if (opt.votes.includes(user)) {
                        opt.votes = opt.votes.filter(v => v !== user);
                    } else {
                        opt.votes.push(user);
                    }
                } else {
                    const alreadySelected = opt.votes.includes(user);
                    data.poll.options.forEach(o => {
                        o.votes = (o.votes || []).filter(v => v !== user);
                    });
                    if (!alreadySelected) {
                        opt.votes.push(user);
                    }
                }
                item.data = JSON.stringify(data);
                scheduleDataSave();
                io.to(data.roomId).emit('poll updated', data);
            }
        }
    });

    socket.on('close poll', ({ msgId }) => {
        const item = historyStore.find(h => h.id === msgId);
        if (item) {
            const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
            if (data.poll) {
                const sessionUser = activeUsersById[socket.id];
                const isCreator = data.poll.createdBy && sessionUser && (data.poll.createdBy === sessionUser.userId || data.poll.createdBy === sessionUser.name);
                const isOriginalSender = (data.userId && sessionUser && data.userId === sessionUser.userId) || (data.senderSocketId === socket.id);

                if (!isCreator && !isOriginalSender) {
                    return socket.emit('action error', 'Only the poll creator can end this poll.');
                }

                data.poll.isClosed = true;
                item.data = JSON.stringify(data);
                scheduleDataSave();
                io.to(data.roomId).emit('poll updated', data);
            }
        }
    });

    socket.on('react message', ({ msgId, emoji }) => {
        if (!checkSocketRateLimit(socket.id, 10, 2000)) return;
        const cleanEmoji = String(emoji || '').trim().substring(0, 10);
        if (!cleanEmoji) return;

        const item = historyStore.find(h => h.id === msgId);
        if (item) {
            const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
            data.reactions = data.reactions || {};
            // Bound total distinct reactions to prevent payload inflation
            if (Object.keys(data.reactions).length < 20 || data.reactions[cleanEmoji]) {
                data.reactions[cleanEmoji] = (data.reactions[cleanEmoji] || 0) + 1;
                item.data = JSON.stringify(data);
                scheduleDataSave();
                io.to(data.roomId).emit('update reactions', { id: msgId, reactions: data.reactions });
            }
        }
    });

    // 🔒 Authorization Protected: Only original author can edit
    socket.on('edit message', ({ msgId, newText }) => {
        if (!checkSocketRateLimit(socket.id, 6, 3000)) {
            return socket.emit('rate limit', 'Too many requests. Please slow down.');
        }

        if (typeof newText !== 'string' || !newText.trim() || newText.length > 4000) {
            return socket.emit('action error', 'Invalid message content (maximum 4000 characters).');
        }

        const item = historyStore.find(h => h.id === msgId);
        if (!item) return socket.emit('action error', 'Message not found.');

        const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
        const currentUser = activeUsersById[socket.id];
        
        const isAuthor = (data.senderSocketId && data.senderSocketId === socket.id) ||
                         (data.userId && currentUser && data.userId === currentUser.userId) ||
                         (data.user && currentUser && data.user === currentUser.name);

        if (!isAuthor) {
            return socket.emit('action error', 'Permission denied: You can only edit your own messages.');
        }

        data.text = newText.trim().substring(0, 4000);
        data.isEdited = true;
        item.data = JSON.stringify(data);
        scheduleDataSave();
        io.to(data.roomId).emit('message edited', { id: msgId, newText: data.text });
    });

    // 🔒 Authorization Protected: Only original author or room creator can delete
    socket.on('delete message', (msgId) => {
        if (!checkSocketRateLimit(socket.id, 8, 3000)) {
            return socket.emit('rate limit', 'Too many requests. Please slow down.');
        }

        const idx = historyStore.findIndex(h => h.id === msgId);
        if (idx === -1) return socket.emit('action error', 'Message not found.');

        const item = historyStore[idx];
        const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
        const currentUser = activeUsersById[socket.id];

        const room = rooms.get(data.roomId);
        const isRoomCreator = room && currentUser && (room.createdBy === currentUser.userId || room.createdBy === socket.id);
        const isAuthor = (data.senderSocketId && data.senderSocketId === socket.id) ||
                         (data.userId && currentUser && data.userId === currentUser.userId) ||
                         (data.user && currentUser && data.user === currentUser.name);

        if (!isAuthor && !isRoomCreator) {
            return socket.emit('action error', 'Permission denied: You can only delete your own messages.');
        }

        historyStore.splice(idx, 1);
        scheduleDataSave();
        io.to(data.roomId).emit('message edited', { id: msgId, newText: '🚫 Message deleted' });
    });

    socket.on('pin message', ({ msg }) => {
        const roomId = activeUsersById[socket.id]?.roomId;
        if (roomId && rooms.has(roomId)) {
            if (!msg || typeof msg !== 'object') return;
            const cleanMsg = {
                user: String(msg.user || 'User').substring(0, 30),
                text: String(msg.text || 'Pinned Item').substring(0, 300)
            };
            const room = rooms.get(roomId);
            room.pinnedMessage = cleanMsg;
            scheduleDataSave();
            io.to(roomId).emit('pinned updated', cleanMsg);
        }
    });

    socket.on('unpin message', () => {
        const roomId = activeUsersById[socket.id]?.roomId;
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            room.pinnedMessage = null;
            scheduleDataSave();
            io.to(roomId).emit('pinned updated', null);
        }
    });

    // 🔒 Protect System Rooms and Sanitize Inputs
    socket.on('update group info', ({ roomId, name, logo }) => {
        if (!roomId || !rooms.has(roomId)) return socket.emit('action error', 'Room not found');
        if (roomId === 'lobby' || roomId === 'ai_lounge') {
            return socket.emit('action error', 'Default system rooms cannot be renamed.');
        }

        const targetRoom = rooms.get(roomId);
        if (name && typeof name === 'string') {
            const cleanName = name.trim().substring(0, 40);
            if (cleanName) targetRoom.name = cleanName;
        }
        if (logo && typeof logo === 'string') {
            if (logo.startsWith('https://') || logo.startsWith('data:image/') || logo.startsWith('/')) {
                targetRoom.logo = logo.substring(0, 500);
            }
        }
        scheduleDataSave();
        io.to(roomId).emit('group info updated', targetRoom);
        broadcastRooms();
    });

    socket.on('mark read', (payload) => {
        const sessionUser = activeUsersById[socket.id];
        if (!sessionUser) return;
        const targetRoomId = (payload && typeof payload.roomId === 'string') ? payload.roomId : sessionUser.roomId;
        if (!targetRoomId) return;

        const targetMsgId = (payload && typeof payload.msgId === 'string') ? payload.msgId : null;
        const readMsgIds = [];

        for (let i = historyStore.length - 1; i >= 0; i--) {
            const h = historyStore[i];
            if (h.roomId === targetRoomId) {
                try {
                    const m = typeof h.data === 'string' ? JSON.parse(h.data) : h.data;
                    const isOtherUserMsg = (m.userId && m.userId !== sessionUser.userId) || (m.user && m.user !== sessionUser.name);
                    
                    if (isOtherUserMsg) {
                        if (!targetMsgId || m.id === targetMsgId) {
                            if (m.status !== 'read') {
                                m.status = 'read';
                                m.readAt = Date.now();
                                m.readBy = m.readBy || [];
                                if (!m.readBy.includes(sessionUser.name)) m.readBy.push(sessionUser.name);
                                h.data = JSON.stringify(m);
                                readMsgIds.push(m.id);
                            }
                            if (targetMsgId && m.id === targetMsgId) break;
                        }
                    }
                } catch (e) {}
            }
        }

        if (readMsgIds.length > 0) {
            scheduleDataSave();
            io.to(targetRoomId).emit('messages read', { 
                roomId: targetRoomId, 
                msgIds: readMsgIds, 
                reader: sessionUser.name, 
                readAt: Date.now() 
            });
        }
    });

    socket.on('get user info', (name) => {
        const safeName = String(name || '').substring(0, 30);
        const user = usersStore.get(safeName);
        socket.emit('user info result', user || { name: safeName, about: 'Using Chit Chat' });
    });

    socket.on('typing', (isTyping) => { 
        const roomId = activeUsersById[socket.id]?.roomId; 
        if (roomId) {
            const userData = activeUsersById[socket.id];
            socket.to(roomId).emit('user typing', { 
                name: userData?.name || 'Someone', 
                avatar: userData?.avatar || '',
                isTyping: !!isTyping 
            }); 
        }
    });

    socket.on('disconnect', () => {
        const userData = activeUsersById[socket.id];
        if (userData) {
            db.run(`UPDATE users SET isOnline = 0, lastSeen = ? WHERE name = ?`, [Date.now(), userData.name]);
            if (userData.roomId) {
                io.to(userData.roomId).emit('room users', getUsersInRoom(userData.roomId));
                io.to(userData.roomId).emit('user typing', { name: userData.name, isTyping: false });
            }
        }
        delete activeUsersById[socket.id];
        socketRateLimits.delete(socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Secure Chit Chat server running on http://0.0.0.0:${PORT}`));
