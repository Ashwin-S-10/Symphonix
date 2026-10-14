# Frontend Run Guide

## Prerequisites
- Node.js (v18+)
- npm

## Running the Development Server

1. Open a terminal and navigate to `frontend/`:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start Vite dev server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173` in your browser.

## Testing P2P Synchronized Playback
1. Open `http://localhost:5173` in two separate browser windows (or an Incognito window).
2. **Window 1 (Host):** Click **Create or Join Space** → **Create Space (Host)**. Copy the room code (e.g. `SPX-XXXX`).
3. **Window 2 (Guest):** Click **Create or Join Space** → **Join Space (Participant)** → paste the room code.
4. Once the status shows **WebRTC P2P Open**:
   - Click **Send Test Ping** to verify direct data channel communication.
   - Host clicks **Transfer Track P2P** to stream audio bytes directly to the guest.
   - Host plays, pauses, or seeks; guest playback follows synchronously.
