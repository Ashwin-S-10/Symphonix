# AGENTS.md — Implementation Rules

## Read first
- `README.md`
- `docs/architecture.md`
- `frontend/docs/plan.md`
- `backend/docs/plan.md`
- `protocols/` before changing peer messages or synchronization behavior

## Architecture invariants
- ML processing and recommendation logic live entirely in `backend/`.
- React owns the player, local playback, peer connections, audio transfer, and synchronization.
- Normal host-to-peer audio must flow directly over the peer connection, not through Django.
- Django may serve the initial demo MP3 and handle catalog/API/signaling traffic.
- MillionSongSubset is metadata/features, not playable audio.
- The 20 separately supplied MP3s are the initial playable demo corpus.
- Browser networking uses WebRTC; do not implement raw TCP sockets or UDP broadcast in browser JavaScript.

## Dataset paths
- MillionSongSubset: `backend/data/raw/millionsongsubset/`
- Demo MP3s: `backend/data/audio/demo/`
- Processed data: `backend/data/processed/`
- Models/indexes: `backend/artifacts/`

## Implementation practices
- Inspect existing code before creating or replacing files.
- Make small, cohesive changes; avoid unrelated refactors.
- Keep modules single-purpose and dependencies flowing through explicit interfaces.
- Do not place ML code in React or UI logic in Django ML modules.
- Do not hard-code absolute machine paths, credentials, or host-specific IP addresses.
- Use environment variables for runtime configuration; update `.env.example` when adding settings.
- Keep secrets, raw datasets, MP3s, generated indexes, and model weights out of version control.
- Add tests for API behavior, feature transformations, peer message validation, and playback state transitions.
- Validate peer input, file sizes, chunk ordering, and transfer completion.
- Use stable song IDs; do not use display titles or filesystem paths as identifiers.
- Document API and peer protocol changes in the appropriate docs.

## ML rules
- Keep preprocessing identical between training/index construction and inference.
- Persist feature order, scaler/configuration, model version, and index metadata.
- Do not treat replay events as ground-truth audio labels.
- Handle missing dataset fields and absent audio features explicitly.
- Make expensive ingestion/training jobs explicit commands or background tasks, never synchronous API request work.

## P2P and synchronization rules
- Host is authoritative for track and playback state.
- Playback commands include track/generation identity and monotonic sequence numbers.
- Participants buffer and acknowledge readiness before scheduled playback.
- Support stale-message rejection, reconnects, transfer backpressure, and resynchronization.
- Keep signaling separate from media transfer.
- Do not claim exact synchronization; account for buffering, clock differences, and browser scheduling.

## Completion checklist
- [ ] Change follows `docs/architecture.md`.
- [ ] Relevant tests added/updated and run.
- [ ] API/protocol docs updated if contracts changed.
- [ ] No datasets, MP3s, secrets, or generated artifacts added to source control.
- [ ] Setup/configuration instructions remain accurate.
