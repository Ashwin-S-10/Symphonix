# Phase 1 — Demo Library + Synchronized Spaces

## Objective
Deliver a working music-app frontend using the 20 supplied MP3 files, with space creation/joining and synchronized playback. **No ML features in Phase 1.**

## Execution priority — implement ASAP
- **Start implementation immediately.** Prioritize a working end-to-end demo over extra features, abstractions, and polish.
- Build and verify the smallest complete vertical slice first: create a space → join from a second browser/device → establish WebRTC → transfer one MP3 directly → synchronize play/pause.
- Do not stop at mock UI, architecture notes, placeholder handlers, or simulated connection states. Implement real signaling and a real peer connection.
- Keep the app runnable at every milestone. Test each milestone before expanding scope.
- If a feature threatens the Phase 1 demo timeline, defer it unless it is required for the end-to-end flow. Do not defer WebRTC establishment or direct peer-to-peer audio transfer.

## Scope
- Display all 20 demo tracks.
- Group tracks into manually curated UI collections.
- Play/pause, seek, next/previous, and display current track.
- Create a listening space as host.
- Join a space as participant.
- Show participants, host role, connection state, and readiness/buffering.
- Synchronize shared playback commands and timeline.
- Use Django only for catalog/demo audio delivery and optional room/signaling support.
- Transfer audio directly from host to peers during normal P2P playback.

## Out of scope
- Clustering, K-NN, recommendations, model training/inference.
- Instrument/chorus detection or audio-segment understanding.
- Personalized recommendations or ML-driven grouping.
- Full Million Song Dataset processing in the user-facing flow.
- Fake recommendations, placeholder analytics, or AI-generated explanations.

## Demo asset locations
```text
backend/data/audio/demo/
├── track-01.mp3
├── track-02.mp3
└── ...                  # 20 supplied MP3 files
```

Keep actual filenames if already meaningful; do not rename files unless the catalog mapping is updated.

Million Song Dataset Subset location (for later phases only):
```text
backend/data/raw/millionsongsubset/
```
- Contains metadata/features for 10,000 songs and SQLite databases.
- Contains no listenable audio.
- Do not make Phase 1 depend on it.

## UI grouping
Create 3–5 manually curated collections based on the actual 20 tracks, such as:
- Recently added
- Demo collection
- Vocal / instrumental (only if verified from the tracks)
- Mood or genre groups (only if known and defensible)

Rules:
- Use data-backed labels where known.
- If genre/mood is unknown, use neutral names such as “Demo collection”, “Track picks”, or “All demo tracks”.
- Do not pretend the groups came from clustering or AI.
- Each track belongs to a stable catalog entry with ID, title, artist if known, duration if known, and audio reference.
- Missing metadata must be handled cleanly; do not invent factual details.

## Suggested frontend screens
1. **Home / Library**
   - Compact sidebar or mobile navigation.
   - Featured demo collection without a giant hero.
   - Collection rows/grids and complete 20-track list.
2. **Now Playing**
   - Persistent bottom player on desktop; compact persistent player on mobile.
   - Track title, available artwork, progress, volume, and playback controls.
3. **Create / Join Space**
   - Simple create button and room-code join flow.
   - Explain host vs participant before joining.
4. **Active Space**
   - Host/participant label.
   - Participant list and readiness.
   - Shared playback state, buffering, reconnecting, and error feedback.
   - Host controls shared playback; participant controls follow host state.

## Playback and networking requirements
### WebRTC connection establishment — required in Phase 1
Implement this end-to-end connection flow; do not leave it as a design-only task:
1. **Host creates a space:** Client A requests a room from Django. Django stores the room code, authenticated host identity, and active membership/connection information.
2. **Guest joins:** Client B submits the room code. Django verifies that the room exists and forwards a join notification to the host.
3. **Create the peer connection:** Client A creates an `RTCPeerConnection` and a data channel (for example, `symphonix`). Client B creates its own `RTCPeerConnection` and handles the incoming data channel.
4. **Exchange the SDP offer/answer:** Client A creates and sets its local SDP offer, then sends it through the signaling channel. Django forwards it to Client B. Client B sets the remote offer, creates and sets its local answer, and sends the answer through Django to Client A. Client A sets the remote answer.
5. **Exchange ICE candidates:** Both clients send gathered ICE candidates through signaling to the other peer. Apply received candidates with `addIceCandidate`; queue candidates if they arrive before the remote description is set, then apply the queued candidates.
6. **Confirm connection readiness:** Show connecting/connected/failed states from actual WebRTC connection and data-channel events. Only enable peer transfer when the data channel is open.
7. **Verify direct transfer:** Send a small test message first, then transfer one demo MP3 from host to guest over the data channel and verify the received bytes before adding synchronized playback.

Signaling requirements:
- Use the existing Django backend with Django Channels/WebSockets, or a dedicated signaling service if the repository already has one. Prefer the simplest working option and implement it ASAP.
- Signaling carries room/join events, SDP offers/answers, and ICE candidates. It must not carry the ongoing audio stream.
- Route each signaling message using the authenticated sender, room membership, and target peer; never trust a client-supplied identity or room role without server-side validation.
- WebRTC gathers candidate addresses and tests candidate pairs. Do not require the user to manually discover or enter the host IP for the normal room-code flow.
- Configure STUN for connectivity checks and support configurable TURN credentials/URLs where needed. Do not promise direct connectivity on every network; TURN may relay traffic if direct connectivity fails.
- Handle duplicate/out-of-order signaling messages, candidates arriving early, rejected/expired room codes, host disconnects, and failed connection attempts with visible errors and retry/reconnect behavior.
- For the first working slice, support one host and one guest before extending to multiple guests.

- Browser peer transport: WebRTC data channels.
- Signaling: Django or a dedicated signaling channel exchanges offer/answer/ICE information only.
- Do not implement raw TCP sockets or UDP broadcast in browser JavaScript.
- Fetch the selected MP3 from Django initially if the host does not already have it.
- Host transfers audio bytes directly to participants; do not route ongoing audio through Django.
- Buffer audio before scheduled playback.
- Host is authoritative for track and playback state.
- Include track/generation identity and monotonic sequence numbers in commands.
- Send a target start time and periodic state snapshots.
- Correct small playback drift; resynchronize when drift is too large.
- Handle late joiners, disconnects, reconnects, transfer failure, and insufficient buffering.
- Do not claim sample-accurate or perfect synchronization.

## Suggested milestones — execute in this order
1. **ASAP:** Load the 20 demo tracks and make local playback work.
2. **ASAP:** Implement room creation/joining and the real Django signaling channel.
3. **ASAP:** Establish a real WebRTC connection between two devices, including SDP offer/answer and ICE candidate exchange.
4. **ASAP:** Send a test message, then transfer one MP3 directly host-to-guest and verify receipt.
5. Synchronize play/pause/seek with scheduled start and authoritative host state.
6. Finish catalog/collection presentation and active-space status UI.
7. Add multi-participant support, robust buffering, reconnection, and broader tests.

Do not postpone milestones 2–4 until after UI polish. The first demonstration must prove the real peer connection and direct audio transfer, not just show a connected-looking screen.

## Acceptance criteria
- [ ] All 20 supplied tracks appear in the UI.
- [ ] Tracks are grouped into clear, manually curated collections.
- [ ] No ML pipeline or ML UI is required to run Phase 1.
- [ ] A user can play/pause/seek/skip tracks.
- [ ] A host can create a space and a second device can join using a room code.
- [ ] Django signaling routes SDP offers/answers and ICE candidates between the correct peers.
- [ ] The two clients establish a real `RTCPeerConnection` and the data channel reaches the open state.
- [ ] A test message is exchanged over the data channel.
- [ ] Host audio is transferred directly to participants over the peer connection; verify the received file/bytes.
- [ ] The app does not depend on manually entering the host IP for the normal room-code flow.
- [ ] Participants buffer before playback and follow host state.
- [ ] Connection, buffering, failure, and reconnect states are visible.
- [ ] UI follows `UI.md` and avoids generic AI-generated dashboard styling.
