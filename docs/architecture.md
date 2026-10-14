# Architecture

## System boundaries

| Component | Owns | Must not own |
|---|---|---|
| React frontend | UI, local playback, room UX, peer connections, audio transfer, synchronization | ML training/inference implementation, canonical catalog storage |
| Django backend | REST API, catalog, users, listening events, ML pipelines, recommendation inference | LAN audio relay during normal playback |
| ML pipeline | Ingestion, preprocessing, clustering, K-NN index, audio analysis, ranking | UI and peer transport |
| Demo audio library | 20 playable MP3s and their catalog mappings | Million Song Dataset audio (not included) |

## Repository structure

```text
project_root/
├── README.md
├── AGENTS.md
├── docs/
│   └── architecture.md
├── protocols/
│   ├── peer-messages.md
│   ├── playback-sync.md
│   └── signaling.md
├── frontend/
│   ├── docs/plan.md
│   ├── public/
│   └── src/
│       ├── app/
│       ├── components/
│       ├── features/
│       ├── services/       # Django API clients
│       ├── networking/     # Peer connections and transfer
│       ├── player/         # Audio engine and synchronization
│       ├── storage/        # Browser cache
│       └── hooks/
├── backend/
│   ├── docs/plan.md
│   ├── manage.py
│   ├── config/
│   ├── apps/
│   │   ├── catalog/
│   │   ├── users/
│   │   ├── listening_history/
│   │   ├── recommendations/
│   │   └── spaces/
│   ├── ml/
│   │   ├── ingestion/
│   │   ├── preprocessing/
│   │   ├── clustering/
│   │   ├── retrieval/
│   │   ├── audio_analysis/
│   │   ├── ranking/
│   │   └── pipelines/
│   ├── data/
│   │   ├── raw/millionsongsubset/
│   │   ├── processed/
│   │   └── audio/demo/
│   └── artifacts/
└── docker-compose.yml
```

## Data placement

```text
backend/data/
├── raw/
│   └── millionsongsubset/  # Extracted MillionSongSubset archive (~1.8 GB)
├── processed/              # Generated tables and feature matrices
└── audio/
    └── demo/               # The 20 playable MP3 files
```

- Download: [Million Song Dataset Subset](http://labrosa.ee.columbia.edu/~dpwe/tmp/millionsongsubset.tar.gz)
- The subset contains 10,000 songs' metadata/features and additional SQLite databases.
- **It does not contain listenable audio.** Do not expect it to supply MP3/WAV files.
- Do not commit the dataset, MP3s, indexes, or model artifacts.
- Keep raw data immutable; write derived outputs to `processed/` and `artifacts/`.
- Use configuration/environment variables for data paths; avoid hard-coded machine-specific paths.

## Runtime communication

1. **Frontend → Django (HTTPS/REST):** catalog, recommendations, auth, listening events.
2. **Frontend ↔ Frontend (LAN/P2P):** audio chunks, playback commands, readiness, timing updates.
3. **Backend internal:** dataset processing, model artifacts, database access.

For browser-based React, use WebRTC data channels for direct peer transport. Browsers cannot open arbitrary raw TCP sockets or send UDP broadcast packets. Use a room code or a supported discovery mechanism plus WebRTC signaling. Signaling exchanges connection metadata only; it must not relay media during normal operation.

## ML flow

```text
MillionSongSubset metadata/features ─┐
                                     ├─> Normalize/features ─> Clustering
20 demo MP3s ─> Audio analysis ──────┘                         │
                                                              ├─> K-NN index
                                                              └─> Audio features
User listening events ─> Ranking/personalization ─> Recommendations
```

- Clustering: HDBSCAN/DBSCAN; do not require a preselected cluster count.
- K-NN: nearest songs by a defined, normalized feature representation.
- Audio analysis: analyze the 20 actual MP3s; instrument/chorus identification requires an appropriate pretrained or labeled model.
- Replay events are preference signals, not ground-truth instrument labels.

## Playback flow

1. Host creates a space; participant joins.
2. Peers exchange WebRTC signaling information.
3. Host obtains the selected MP3 from its local cache or the backend demo endpoint.
4. Host transfers audio directly to participants.
5. Each participant buffers and acknowledges readiness.
6. Host broadcasts track ID, sequence number, target start time, and playback state.
7. Clients synchronize against the host timeline and report buffer status.
8. Clients periodically correct drift; stale commands are rejected by sequence/generation ID.

The initial demo may fetch an MP3 from Django, but Django must not be in the ongoing host-to-peer audio path.
