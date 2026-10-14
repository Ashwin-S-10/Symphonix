# Frontend Plan

## Responsibilities
- React UI and navigation.
- Song catalog, search, recommendation display.
- Music player and local audio cache.
- Space creation/joining and participant state.
- Peer connection lifecycle and direct audio transfer.
- Synchronized play, pause, seek, next-track, and drift correction.
- Listening-event submission to Django.

## Structure
```text
src/
├── app/                 # App shell, routes
├── components/          # Reusable UI/player components
├── features/
│   ├── discovery/
│   ├── recommendations/
│   ├── spaces/
│   └── playback/
├── services/            # Django REST API clients only
├── networking/
│   ├── discovery/       # Room code/local discovery abstraction
│   ├── signaling/       # Offer/answer/ICE exchange
│   ├── peers/           # WebRTC connection management
│   ├── transfer/        # Chunked audio transfer
│   └── protocol/        # Message schemas and validation
├── player/
│   ├── audioEngine.js
│   ├── playbackClock.js
│   ├── bufferManager.js
│   └── syncController.js
├── storage/             # IndexedDB/cache abstractions
└── hooks/
```

## Network design
- Use WebRTC data channels for browser-to-browser LAN/P2P transport.
- Use Django or a signaling service only for initial peer signaling and room coordination.
- Do not route normal audio transfer through Django.
- Do not attempt raw TCP sockets or UDP broadcast from browser JavaScript.
- Handle unavailable peers, reconnects, transfer backpressure, and partial transfers.
- Validate all incoming peer messages and enforce payload-size limits.

## Playback synchronization
- Host is the authoritative playback-state owner.
- Include `spaceId`, `trackId`, `generationId`, `sequence`, and target timeline/time in commands.
- Require participants to buffer and send `READY` before scheduled playback.
- Send periodic state snapshots and buffer status.
- Correct small drift gradually; seek/resynchronize for large drift.
- Reject stale or out-of-order commands.
- Treat browser timers as imprecise; use the audio engine's clock for playback position.

## Demo audio
- The 20 MP3s are stored on the backend at `backend/data/audio/demo/`.
- Frontend may fetch a selected demo track from a backend endpoint initially.
- Host transfers audio bytes directly to peers after obtaining the track.
- Cache received tracks in IndexedDB when appropriate; do not assume browser clients can access backend filesystem paths.

## Implementation order
1. Build catalog/player UI and play all 20 demo MP3s.
2. Create/join spaces using room codes.
3. Implement WebRTC signaling and peer readiness.
4. Transfer one complete audio file directly between two devices.
5. Add scheduled play/pause/seek and drift correction.
6. Add chunking, buffering, reconnect handling, and multiple participants.
7. Integrate recommendation UI and listening-event submission.

## Frontend constraints
- Keep ML algorithms out of the frontend.
- Keep UI components separate from networking and playback logic.
- Keep API and peer message schemas centralized and validated.
- Use environment variables for API/signaling URLs.
