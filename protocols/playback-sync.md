# Playback Synchronization Protocol

## Authoritative Model
- The **Host** is the absolute authority for track selection, state timeline, and generation IDs.
- Participants buffer media, report buffer health, and sync their playback clock to host timeline.

## Clock & Drift Model
1. **Clock Estimation (NTP / Cristian's Algorithm)**:
   - Participants execute background ping/pong bursts over the WebRTC DataChannel to determine Round-Trip Time ($RTT$) and Clock Offset ($\Delta = T_{host} - T_{participant}$).
   - One-way network latency is estimated as $L = RTT / 2$.
   - Sample with minimum $RTT$ is retained across a sliding window of recent samples to filter asymmetric network queueing jitter.
   - All host timestamps ($T_{target}$, snapshot timestamps) are converted to participant local time via $T_{local} = T_{host} - \Delta$.

2. **Scheduled Play & Pre-Seeking**:
   - Host chooses a target start time $T_{target} = T_{now} + \text{leadTime}$ (400ms lead time allows network transmission and audio buffering).
   - Both Host and Participants immediately pre-seek the audio decoder pipeline to `positionSeconds` upon receiving the scheduled play command, eliminating decoder buffer flushing delay at startup.
   - At $T_{target}$ ($T_{localTarget} = T_{target} - \Delta$ on participants), `play()` commences with zero seek latency.

3. **Drift Correction**:
   - Host broadcasts `STATE_SNAPSHOT` every 1.0 second.
   - Participant normalizes current time to host time: $T_{host\_now} = T_{local\_now} + \Delta$.
   - Participant computes expected position:
     $$P_{expected} = P_{snapshot} + (T_{host\_now} - T_{snapshot})$$
   - Let $\text{drift} = P_{actual} - P_{expected}$.
   - **Optimized Thresholds**:
     - $|\text{drift}| < 12\text{ms}$: Locked target deadband; maintain playback rate at 1.0x (inaudible human perception threshold).
     - $12\text{ms} \le |\text{drift}| \le 40\text{ms}$: Gentle micro-adjustment. Set playback rate to $1.015\text{x}$ (if lagging) or $0.985\text{x}$ (if ahead). Corrects 15ms per second with pitch transparency.
     - $40\text{ms} < |\text{drift}| \le 180\text{ms}$: Active smooth correction. Set playback rate to $1.04\text{x}$ or $0.96\text{x}$.
     - $|\text{drift}| > 180\text{ms}$: Hard drift. Hard-seek directly to $P_{expected}$ and reset rate to 1.0x.

4. **Sequence and Generation Invariants**:
   - `generationId`: A unique string updated each time a new track is loaded or the space reset. Outdated generation messages are immediately discarded.
   - `sequence`: Monotonically increasing counter per command. Stale commands ($\le \text{lastSequenceSeen}$) are ignored.

5. **Performance Metrics (Frontend UI Telemetry)**:
   The frontend automatically captures and displays the following core performance metrics in the room's Performance Metrics panel:

   | Metric | Description |
   |---|---|
   | **Connection setup time** | Time from join request to data-channel open |
   | **Signaling delay** | Time between sending and receiving signaling messages |
   | **Audio transfer throughput** | File size in bytes $\times$ 8 / transfer duration |
   | **Transfer completion time** | Start of send to completed receiver file |
   | **Playback start skew** | Difference between host and guest actual playback start times |
   | **Playback drift** | Difference in playback position over time |


