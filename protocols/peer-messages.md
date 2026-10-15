# Peer Message Protocol

## Overview
WebRTC Data Channels are used for peer-to-peer transport between host and participant browsers.
Messages are encoded as JSON objects (for control and signaling) and binary/ArrayBuffer or base64/ArrayBuffer chunks (for audio streaming).

## Channel Types
1. **Control Channel (`symphonix-control`)**: Reliable, ordered. Used for state sync, ready signals, drift reports, and room events.
2. **Transfer Channel (`symphonix-transfer`)**: Reliable, ordered chunked binary transport for audio data.

## Message Types

### 1. Audio Transfer
#### `AUDIO_META` (Host -> Participant)
Sent before streaming chunks of an audio file.
```json
{
  "type": "AUDIO_META",
  "spaceId": "string",
  "trackId": "string",
  "generationId": "string",
  "fileName": "string",
  "mimeType": "audio/mpeg",
  "fileSize": 4567890,
  "chunkCount": 70,
  "chunkSize": 65536
}
```

#### Audio Chunk (Host -> Participant)
Sent over binary data channel as:
- Prefix header: 4-byte chunk index (uint32) + 4-byte total chunks (uint32) + raw audio bytes.
Or structured JSON if binary fallback:
```json
{
  "type": "AUDIO_CHUNK",
  "trackId": "string",
  "generationId": "string",
  "chunkIndex": 0,
  "totalChunks": 70,
  "data": "<base64>"
}
```

#### `AUDIO_TRANSFER_COMPLETE` (Host -> Participant)
```json
{
  "type": "AUDIO_TRANSFER_COMPLETE",
  "trackId": "string",
  "generationId": "string",
  "checksum": "string"
}
```

### 2. Readiness and Buffering
#### `BUFFER_STATUS` (Participant -> Host)
Sent periodically during reception and decoding.
```json
{
  "type": "BUFFER_STATUS",
  "spaceId": "string",
  "participantId": "string",
  "trackId": "string",
  "generationId": "string",
  "bufferedPercent": 85.5,
  "isDecoded": false
}
```

#### `READY` (Participant -> Host)
Participant has buffered and decoded sufficient audio to start playing immediately on schedule.
```json
{
  "type": "READY",
  "spaceId": "string",
  "participantId": "string",
  "trackId": "string",
  "generationId": "string",
  "readyAt": 1728912345678
}
```

### 3. Playback Synchronization
#### `SCHEDULED_PLAY` (Host -> Participants)
Instructs participants to commence playback at an absolute timestamp.
```json
{
  "type": "SCHEDULED_PLAY",
  "spaceId": "string",
  "trackId": "string",
  "generationId": "string",
  "sequence": 42,
  "positionSeconds": 0.0,
  "targetStartTime": 1728912347000
}
```

#### `PLAY_ACK` (Participant -> Host)
Participant acknowledges execution of scheduled playback with actual local start timestamp and calculated start skew.
```json
{
  "type": "PLAY_ACK",
  "spaceId": "string",
  "participantId": "string",
  "trackId": "string",
  "generationId": "string",
  "targetStartTime": 1728912347000,
  "actualStartTime": 1728912347004,
  "skewMs": 4,
  "timestamp": 1728912347005
}
```

#### `PAUSE` (Host -> Participants)
```json
{
  "type": "PAUSE",
  "spaceId": "string",
  "trackId": "string",
  "generationId": "string",
  "sequence": 43,
  "positionSeconds": 15.42,
  "serverTime": 1728912350000
}
```

#### `SEEK` (Host -> Participants)
```json
{
  "type": "SEEK",
  "spaceId": "string",
  "trackId": "string",
  "generationId": "string",
  "sequence": 44,
  "positionSeconds": 45.0,
  "targetStartTime": 1728912352000,
  "isPlaying": true
}
```

#### `STATE_SNAPSHOT` (Host -> Participants)
Periodic heartbeat broadcast (every 1000ms) to detect and correct clock drift.
```json
{
  "type": "STATE_SNAPSHOT",
  "spaceId": "string",
  "trackId": "string",
  "generationId": "string",
  "sequence": 45,
  "isPlaying": true,
  "positionSeconds": 48.2,
  "timestamp": 1728912355200
}
```

#### `RESYNC_REQUEST` (Participant -> Host)
Participant requests full state replay if sequence numbers are skipped or drift exceeds threshold.
```json
{
  "type": "RESYNC_REQUEST",
  "spaceId": "string",
  "participantId": "string",
  "lastSequenceSeen": 40
}
```
