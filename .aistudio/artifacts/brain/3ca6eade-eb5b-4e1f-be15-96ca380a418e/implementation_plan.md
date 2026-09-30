# Cute Tic-Tac-Toe Game Avatars & Modern Toast Notification System

Replace text names in Tic-Tac-Toe (XOX) game sessions with vibrant circular player avatars featuring active turn rings, and introduce a modern, cute floating toast notification component featuring bouncy physics, custom contextual icons, and sensory audio-haptic feedback.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following design and behavioral choices were confirmed during interactive clarification and form the foundation of this implementation:

- **Confirmed Decision 1 (XOX Player Badges)**: Circular avatars with glowing active-turn indicator rings and clear player role symbols (`X` and `O`) replace plain text gamer names on the interactive game board.
- **Confirmed Decision 2 (Toast Component Styling)**: Floating pastel pill design with smooth bouncy entrance transitions, translucent glassmorphism (`backdrop-filter: blur(20px)`), theme-adaptive borders, and playful emoji/icon support.
- **Confirmed Decision 3 (Sensory Feedback)**: Every toast notification and game alert triggers a playful pop sound (`playUiSound('pop')`) paired with gentle haptic vibration feedback for mobile and touch devices.
- **Game Launcher Integration**: Seamlessly provide an in-chat game creation action in the attachment bar and input tray so users can initiate XOX matches directly in rooms alongside polls and media.

---

### 1. Overview & Core Concept

- **What It Does**: Enhances the in-room interactive Tic-Tac-Toe (XOX) gaming experience and application-wide notifications. Players see their opponent's and their own animated circular avatars directly above the board with turn highlights and role badges. When an invalid move is attempted (e.g. clicking out of turn or playing on opponent's behalf), a delightful, themed floating toast gracefully slides up from the bottom with a gentle bounce, playful emoji, and crisp feedback rather than an abrasive alert.
- **Target Audience & Persona**: Friends and room members chatting in Chit Chat who play casual multiplayer games and need clear, friendly, and delightfully styled turn alerts.
- **Key Value**: Replaces jarring text alerts and unstyled prompts with a cohesive, adorable aesthetic that feels native to Chit Chat's playful design language.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Starting or Joining an XOX Match**:
   - A user launches an XOX challenge via the chat input actions.
   - The message bubble renders a custom interactive game card featuring a 3x3 board and player header slots (`X` and `O`).
   - Player `X` claims the first turn; their circular avatar appears with a soft pulsing emerald/pink glow ring and an `X` emblem badge.
   - An open slot invites opponent `O` with an inviting waiting silhouette or avatar preview.
2. **Turn-Taking & Turn Validation**:
   - When it is Player X's turn, Player X's avatar ring pulses softly while Player O is dimmed.
   - If Player O or a spectator attempts to tap a grid tile while it is not their turn, the application intercepts the action and displays a cute floating toast: `"🌸 It's Player X's turn! Please wait for them to move."`
   - If the player is Player X and tries to tap again before an opponent joins as O: `"💖 You are Player X! Waiting for your opponent to take O."`
3. **Toast Notification Behavior**:
   - The toast enters from the bottom center (`bottom: 84px`), springs upward with a subtle cubic-bezier bounce (`cubic-bezier(0.175, 0.885, 0.32, 1.275)`), plays a delightful pop sound, and vibrates softly.
   - The toast auto-dismisses after 3 seconds, or smoothly fades out when a new toast takes its place.

#### Visual Identity & Theme
- **Color Palette & Contrast**:
  - Light Mode: Soft white glass background (`rgba(255, 255, 255, 0.94)`), subtle rose/slate borders (`rgba(226, 232, 240, 0.9)`), deep charcoal typography (`#0f172a`), accent glows in emerald (`#10b981`) or sweet pink (`#ff4d6d`).
  - Dark Mode: Rich slate glass (`rgba(15, 23, 42, 0.92)`), luminous hairline borders (`rgba(255, 255, 255, 0.14)`), crisp off-white text (`#f8fafc`).
  - Pink/Sweetheart Theme: Soft marshmallow glass (`rgba(255, 244, 246, 0.96)`), warm cherry accent typography (`#590216`).
- **Typography & Proportions**:
  - Set in `Plus Jakarta Sans`, 13.5px font size, semi-bold 600 weight, balanced text line height.
- **Component Geometry**:
  - Toast Pill: Fully pill-rounded (`border-radius: 28px`), padding `10px 22px`, elevation `0 14px 40px rgba(0, 0, 0, 0.16)`.
  - Player Avatar Rings: 38px circular avatars, 2.5px concentric turn-indicator stroke with smooth SVG glow filters.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Full In-Card Game Rendering vs. Modal Game Overlay**:
  - *Chosen Approach*: Render the interactive XOX game directly inside the chat message bubble (like polls and voice notes), with responsive 3x3 tiles.
  - *Why*: Keeps conversations interactive and contextually anchored in the room history; spectators and players can view moves in real time without obscuring the chat screen.
- **Decision 2: Reusable Global Toast API with Multiple Types**:
  - *Chosen Approach*: Implement `showToast(msg, options)` where options support custom icons/emojis, duration, sound suppression (optional), and semantic styles (`'error'`, `'info'`, `'success'`, `'game'`).
  - *Why*: Serves both the XOX game requirements and existing app actions (clipboard copy, room updates, wallpaper changes, errors), unifying notification behavior across the entire app.
- **Decision 3: Server-Authoritative Move Evaluation with Client Guarding**:
  - *Chosen Approach*: The server validates turns and claims slots (`server.js`), while the client also performs fast optimistic checking with cute toast feedback when an illegal tap occurs.
  - *Why*: Prevents unnecessary socket round-trips for obvious out-of-turn taps while guaranteeing that the authoritative board state can never be desynchronized or manipulated.

---

### 4. Technical Architecture & Data Strategy

#### Architecture & Component Diagram

```
┌───────────────────────────────────────────────────────────────────┐
│                          Browser Client                           │
├────────────────────────────────┬──────────────────────────────────┤
│         Chat Input Bar         │        Chat Message Feed         │
│  ┌──────────────────────────┐  │  ┌─────────────────────────────┐ │
│  │   Attachment & Game Menu │  │  │ XOX Message Bubble Card     │ │
│  │   [🎮 Tic-Tac-Toe Btn]   │  │  │ ┌─────────────────────────┐ │ │
│  └─────────────┬────────────┘  │  │ │ Player X (Avatar + Ring)│ │ │
│                │               │  │ │ VS                      │ │ │
│                ▼               │  │ │ Player O (Avatar + Ring)│ │ │
│      [New XOX Message]         │  │ ├─────────────────────────┤ │ │
│                │               │  │ │ 3x3 Interactive Grid    │ │ │
│                ▼               │  │ └─────────────────────────┘ │ │
│  ┌──────────────────────────┐  │  └──────────────┬──────────────┘ │
│  │  Reusable Toast Pill     │◄─┴─────────────────┘                │
│  │  - Bounce In Animation   │  (Invalid turn emits 'xox error'    │
│  │  - Cute Emoji & Text     │   -> Triggers showCuteToast)        │
│  │  - Pop Audio & Haptic    │                                     │
│  └──────────────────────────┘                                     │
└────────────────────────────────┬──────────────────────────────────┘
                                 │ WebSockets (Socket.io)
                                 ▼
┌───────────────────────────────────────────────────────────────────┐
│                     Node.js / Express Server                      │
├───────────────────────────────────────────────────────────────────┤
│  - socket.on('play xox move')   -> Turn verification & state eval │
│  - socket.emit('xox error')     -> Friendly guidance message      │
│  - io.to(roomId).emit('xox updated') -> Broadcast board update    │
│  - socket.on('reset xox game')  -> Rematch state wipe             │
└───────────────────────────────────────────────────────────────────┘
```

#### Interactive Handlers & State Mapping

1. **`showToast(message, { icon, type, duration, playSound })`**:
   - Mounts or updates `#custom-app-toast` with `.custom-toast-pill`.
   - Injects playful icon element + formatted text span.
   - Applies `.show` class triggering spring-bounce keyframes.
   - Calls `playUiSound('pop')` and `hapticFeedback('light')`.
   - Cleans up with a smooth scale-down fade on timeout.
2. **XOX Card Renderer (`renderXoxCard(data)`)**:
   - Injects the player avatar headers: Circular avatar for Player X with name tooltip and role mark, and circular avatar for Player O.
   - Highlights the active player's turn with `.active-turn-ring` and subtle CSS breathing pulse.
   - Evaluates winner / draw states: Celebratory confetti particle burst on win, highlight winning line combo, and show an animated "Play Again" button.
3. **Socket Event Integrations**:
   - `xox updated`: Re-renders board, updates player avatars, plays subtle placement sound.
   - `xox error`: Catches server turn errors and pipes them directly into `showToast` with playful cherry blossom `🌸` or heart `💖` emoji.
