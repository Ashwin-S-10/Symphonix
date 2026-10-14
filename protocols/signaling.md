# WebRTC Signaling Protocol

## Overview
WebRTC requires an out-of-band signaling mechanism to exchange Session Description Protocol (SDP) offers, answers, and Interactive Connectivity Establishment (ICE) candidates.
Signaling is handled via the Django REST API (`/api/spaces/`) using simple HTTP polling or WebSockets, and can also fall back to direct manual copy/paste or Local LAN discovery.

## Room & Signaling Workflow
1. **Space Creation**:
   - Host requests `POST /api/spaces/` with room configuration.
   - Django assigns a short 6-character room code (e.g. `SPX-4829`).
2. **Participant Joining**:
   - Participant requests `POST /api/spaces/{code}/join/` with `participantId` and displayName.
3. **Offer / Answer Exchange**:
   - Host sends WebRTC offer via `POST /api/spaces/{code}/signals/`.
   - Participant receives offer, sets remote description, creates answer, and sends `POST /api/spaces/{code}/signals/`.
   - Host and Participant exchange ICE candidates through the same message queue.
4. **Direct P2P Established**:
   - Once the WebRTC data channel (`symphonix-control`, `symphonix-transfer`) opens, the signaling channel is idle.
   - Zero media or audio bytes pass through Django during normal playback.
