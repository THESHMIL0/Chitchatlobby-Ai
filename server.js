const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const server = http.createServer(app);

const io = new Server(server, { 
    maxHttpBufferSize: 1e8,
    cors: { origin: "*", methods: ["GET", "POST"] }
}); 

app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Database Store (100% pure JS, highly reliable)
const rooms = new Map([
    ['lobby', { id: 'lobby', name: 'Lobby 😸', logo: '', isPrivate: 0, password: '', pinnedMessage: null }],
    ['ai_lounge', { id: 'ai_lounge', name: '🤖 AI Lounge', logo: 'https://api.dicebear.com/7.x/bottts/svg?seed=ChitChatBot&backgroundColor=00a884', isPrivate: 0, password: '', pinnedMessage: null }]
]);

const historyStore = []; // Array of { id, roomId, timestamp, data }
const usersStore = new Map(); // name -> { name, avatar, about, isOnline, lastSeen, bubbleColor }

const db = {
    serialize(fn) { if (fn) fn(); },
    run(sql, params = [], cb) {
        if (typeof params === 'function') { cb = params; params = []; }
        try {
            if (sql.includes('INSERT INTO rooms') || sql.includes('INSERT OR REPLACE INTO rooms')) {
                const [id, name, logo, isPrivate, password] = params;
                rooms.set(id, { id, name, logo: logo || '', isPrivate: isPrivate ? 1 : 0, password: password || '', pinnedMessage: null });
            } else if (sql.includes('INSERT INTO history') || sql.includes('INSERT OR REPLACE INTO history')) {
                const [id, roomId, timestamp, data] = params;
                historyStore.push({ id, roomId, timestamp, data });
            } else if (sql.includes('INSERT OR REPLACE INTO users')) {
                const [name, avatar, about, isOnline, lastSeen, bubbleColor] = params;
                usersStore.set(name, { name, avatar, about, isOnline, lastSeen, bubbleColor });
            } else if (sql.includes('UPDATE users SET isOnline')) {
                const [lastSeen, name] = params;
                if (usersStore.has(name)) {
                    const u = usersStore.get(name);
                    u.isOnline = 0;
                    u.lastSeen = lastSeen;
                }
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
                    .slice(-50);
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
        if (rows) targetSocket.emit('room list', rows); 
    }); 
}

// AI Bot Logic with Gemini API & Smart Fallback Engine
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
    const textPrompt = (prompt || "hello").trim();
    
    // System instruction for a normal, polite, helpful AI assistant
    const systemInstructionText = `You are a helpful, clear, and friendly AI assistant.
Follow these rules strictly:
1. Provide clear, accurate, and direct responses (1 to 3 sentences).
2. Use clear, natural, standard English without forced texting slang or abbreviations.
3. Be helpful, courteous, and polite at all times.
4. Ensure every response is complete and well-structured.`;

    // 1. Try Gemini API using reliable flash models
    if (process.env.GEMINI_API_KEY) {
        try {
            const client = getAIClient();
            if (client) {
                const fetchPromise = (async () => {
                    const modelsToTry = ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'];
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
                            // Silent fallback to keep logs clean during rate limits
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

    // 2. High-Quality Normal AI Fallback Engine
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
        return "I am an AI assistant here to answer your questions and assist you with tasks.";
    }

    if (lower.includes('time') || lower.includes('clock') || lower.includes('date')) {
        return `The current time is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
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
        return "I can answer questions, discuss topics, or help you chat. You can also mention me in group rooms or use chat tools!";
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
            "That's an interesting question. I'm not entirely sure, what are your thoughts on it?",
            "That is a good point to consider. Tell me more about what you think.",
            "I'd say that depends on the context, but it sounds worth exploring!"
        ];
        return questionsAnswers[Math.floor(Math.random() * questionsAnswers.length)];
    }

    // Normal, polite fallback
    const normalFallbacks = [
        `That sounds interesting! Could you tell me more about ${textPrompt.length < 30 ? textPrompt : 'that'}?`,
        `Thank you for sharing that. What else would you like to discuss?`,
        `I see! Feel free to ask if you have any questions about this.`,
        `That makes sense. What else is on your mind today?`
    ];
    return normalFallbacks[Math.floor(Math.random() * normalFallbacks.length)];
}

io.on('connection', (socket) => {
    broadcastRooms(socket);

    socket.on('create room', (data) => {
        const roomId = 'room_' + Date.now();
        db.run(`INSERT INTO rooms VALUES (?, ?, ?, ?, ?, NULL)`, 
            [roomId, data.name, '', data.isPrivate ? 1 : 0, data.password], 
            () => broadcastRooms()
        );
    });

    socket.on('join room', (data) => {
        db.get(`SELECT * FROM rooms WHERE id = ?`, [data.roomId], (err, room) => {
            if (!room) return socket.emit('join error', 'Room not found');
            if (room.isPrivate && room.password !== data.password) return socket.emit('join error', 'Wrong password');

            socket.rooms.forEach(r => r !== socket.id && socket.leave(r));
            socket.join(room.id);
            activeUsersById[socket.id] = { ...data.user, roomId: room.id };

            db.run("INSERT OR REPLACE INTO users (name, avatar, about, isOnline, lastSeen, bubbleColor) VALUES (?, ?, ?, ?, ?, ?)", [data.user.name, data.user.avatar, data.user.about, 1, Date.now(), data.user.color || '#dcf8c6']);

            db.all("SELECT data FROM history WHERE roomId = ?", [room.id], (err, rows) => {
                const history = rows?.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data) || [];
                socket.emit('chat history', { room: { id: room.id, name: room.name, logo: room.logo, isPrivate: room.isPrivate === 1 }, history });
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
        if (activeUsersById[socket.id]) { 
            activeUsersById[socket.id].name = user.name; 
            activeUsersById[socket.id].avatar = user.avatar; 
            activeUsersById[socket.id].about = user.about; 
        }
        db.run("INSERT OR REPLACE INTO users (name, avatar, about, isOnline, lastSeen, bubbleColor) VALUES (?, ?, ?, ?, ?, ?)", [user.name, user.avatar, user.about, 1, Date.now(), user.color || '#dcf8c6']);
    });

    socket.on('chat message', async (data) => {
        const roomId = data.roomId || activeUsersById[socket.id]?.roomId || 'lobby';
        
        data.id = data.id || (Date.now() + "_" + Math.floor(Math.random() * 1000));
        data.roomId = roomId; 
        data.type = data.type || 'chat'; 
        data.status = 'delivered';

        socket.join(roomId);
        if (activeUsersById[socket.id]) {
            activeUsersById[socket.id].roomId = roomId;
        } else {
            activeUsersById[socket.id] = { name: data.user || 'Guest', avatar: data.avatar || '', roomId };
        }

        if (!data.isGhost) {
            db.run("INSERT INTO history VALUES (?, ?, ?, ?)", [data.id, roomId, Date.now(), JSON.stringify(data)]);
        }
        
        io.to(roomId).emit('chat message', data);
        socket.broadcast.emit('global room alert', roomId);

        // Check if message triggers Bot response (and not sent by Bot itself)
        const textContent = data.text || '';
        const isBotMention = textContent.toLowerCase().includes('@bot');
        const isAILounge = roomId === 'ai_lounge';
        const isUserBot = data.user === '🤖 Bot';

        if ((isBotMention || isAILounge) && !isUserBot) {
            io.to(roomId).emit('user typing', { name: '🤖 Bot', isTyping: true });
            
            setTimeout(async () => {
                try {
                    let botPrompt = textContent;
                    if (data.replyTo && data.replyTo.text) {
                        botPrompt = `[User is replying to ${data.replyTo.user}'s message: "${data.replyTo.text}"]\n\nUser response: ${textContent}`;
                    }

                    const reply = await askSmartBot(botPrompt);
                    const botMsg = { 
                        id: Date.now() + "_bot", 
                        user: '🤖 Bot', 
                        text: reply, 
                        roomId, 
                        type: 'chat', 
                        status: 'delivered', 
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
                        color: '#00a884', 
                        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=ChitChatBot&backgroundColor=00a884',
                        replyTo: data.replyTo ? { user: data.user, text: textContent || 'Message', msgId: data.id } : null
                    };
                    io.to(roomId).emit('user typing', { name: '🤖 Bot', isTyping: false });
                    db.run("INSERT INTO history VALUES (?, ?, ?, ?)", [botMsg.id, roomId, Date.now(), JSON.stringify(botMsg)]);
                    io.to(roomId).emit('chat message', botMsg);
                } catch (botErr) {
                    console.error("Bot generation error:", botErr);
                    io.to(roomId).emit('user typing', { name: '🤖 Bot', isTyping: false });
                }
            }, 80);
        }
    });

    socket.on('vote poll', ({ msgId, optionIndex }) => {
        const item = historyStore.find(h => h.id === msgId);
        if (item) {
            const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
            if (data.poll && data.poll.options[optionIndex]) {
                const user = activeUsersById[socket.id]?.name || 'Guest';
                data.poll.options.forEach(opt => {
                    opt.votes = opt.votes.filter(v => v !== user);
                });
                data.poll.options[optionIndex].votes.push(user);
                item.data = JSON.stringify(data);
                io.to(data.roomId).emit('poll updated', data);
            }
        }
    });

    socket.on('react message', ({ msgId, emoji }) => {
        const item = historyStore.find(h => h.id === msgId);
        if (item) {
            const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
            data.reactions = data.reactions || {};
            data.reactions[emoji] = (data.reactions[emoji] || 0) + 1;
            item.data = JSON.stringify(data);
            io.to(data.roomId).emit('update reactions', { id: msgId, reactions: data.reactions });
        }
    });

    socket.on('edit message', ({ msgId, newText }) => {
        const item = historyStore.find(h => h.id === msgId);
        if (item) {
            const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
            data.text = newText;
            data.isEdited = true;
            item.data = JSON.stringify(data);
            io.to(data.roomId).emit('message edited', { id: msgId, newText });
        }
    });

    socket.on('delete message', (msgId) => {
        const idx = historyStore.findIndex(h => h.id === msgId);
        if (idx !== -1) {
            const item = historyStore[idx];
            const data = typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
            historyStore.splice(idx, 1);
            io.to(data.roomId).emit('message edited', { id: msgId, newText: '🚫 Message deleted' });
        }
    });

    socket.on('pin message', ({ msg }) => {
        const roomId = activeUsersById[socket.id]?.roomId;
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            room.pinnedMessage = msg;
            io.to(roomId).emit('pinned updated', msg);
        }
    });

    socket.on('unpin message', () => {
        const roomId = activeUsersById[socket.id]?.roomId;
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            room.pinnedMessage = null;
            io.to(roomId).emit('pinned updated', null);
        }
    });

    socket.on('update group info', ({ roomId, name, logo }) => {
        const targetRoom = rooms.get(roomId);
        if (targetRoom) {
            if (name) targetRoom.name = name;
            if (logo) targetRoom.logo = logo;
            io.to(roomId).emit('group info updated', targetRoom);
            broadcastRooms();
        }
    });

    socket.on('mark read', () => {
        const roomId = activeUsersById[socket.id]?.roomId;
        if (roomId) {
            io.to(roomId).emit('messages read');
        }
    });

    socket.on('get user info', (name) => {
        const user = usersStore.get(name);
        socket.emit('user info result', user || { name, about: 'Using Chit Chat' });
    });

    socket.on('typing', (isTyping) => { 
        const roomId = activeUsersById[socket.id]?.roomId; 
        if (roomId) {
            const userData = activeUsersById[socket.id];
            socket.to(roomId).emit('user typing', { 
                name: userData?.name || 'Someone', 
                avatar: userData?.avatar || '',
                isTyping 
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
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Chit Chat server running on http://0.0.0.0:${PORT}`));
