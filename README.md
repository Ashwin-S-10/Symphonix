# Symphonix

Peer-to-peer synchronized music listening with ML-powered music discovery.

## Core components
- **Frontend:** React + Vite; music player, spaces, LAN/P2P connections, playback synchronization.
- **Backend:** Django REST Framework; catalog, listening history, clustering, K-NN, audio analysis, recommendations.
- **Dataset:** Million Song Dataset Subset for metadata/features. It contains **no playable audio**.
- **Demo audio:** 20 user-provided MP3 files for real playback and P2P streaming.

## Data placement
```text
backend/data/raw/millionsongsubset/  # Extract the 1.8 GB subset here
backend/data/audio/demo/             # Place the 20 MP3 files here
```

Keep downloaded data and generated artifacts out of version control.

## Data flow
1. Backend ingests dataset metadata/features and analyzes demo MP3s.
2. Backend builds cluster assignments, a K-NN index, and audio-analysis features.
3. React requests catalog entries and recommendations from Django.
4. Devices establish a peer connection; the host sends audio and playback state directly to participants.
5. Frontend submits listening events to Django when the API is reachable.

## Documentation
- [Architecture](docs/architecture.md)
- [Phase 1 Specification](docs/phase1.md)
- [UI Guidelines](docs/UI.md)
- [Frontend plan](frontend/docs/plan.md)
- [Backend plan](backend/docs/plan.md)
- [Implementation instructions](AGENTS.md)

## Quick Start (Phase 1)

### 1. Run Django Backend
```bash
cd backend
uv run python manage.py runserver 8000
```

### 2. Run React Frontend
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in two browser windows or devices. Create a space in Window 1, copy the 6-character room code, and join from Window 2 to verify WebRTC signaling, P2P test ping, direct audio transfer, and synchronized playback!

