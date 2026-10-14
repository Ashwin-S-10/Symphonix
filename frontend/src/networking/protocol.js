// Message Types for Symphonix WebRTC Peer-to-Peer Protocol
export const MSG_TYPES = {
  // Test Message (Milestone 4 verification)
  PING: 'PING',
  PONG: 'PONG',

  // Audio Transfer
  AUDIO_META: 'AUDIO_META',
  AUDIO_CHUNK: 'AUDIO_CHUNK',
  AUDIO_TRANSFER_COMPLETE: 'AUDIO_TRANSFER_COMPLETE',

  // Buffering & Readiness
  BUFFER_STATUS: 'BUFFER_STATUS',
  READY: 'READY',

  // Playback Synchronization
  SCHEDULED_PLAY: 'SCHEDULED_PLAY',
  PAUSE: 'PAUSE',
  SEEK: 'SEEK',
  STATE_SNAPSHOT: 'STATE_SNAPSHOT',
  RESYNC_REQUEST: 'RESYNC_REQUEST'
};

// Message Builders
export function createPingMessage(senderId) {
  return {
    type: MSG_TYPES.PING,
    senderId,
    timestamp: Date.now()
  };
}

export function createPongMessage(senderId, pingTimestamp) {
  return {
    type: MSG_TYPES.PONG,
    senderId,
    pingTimestamp,
    timestamp: Date.now()
  };
}

export function createAudioMetaMessage(spaceId, trackId, generationId, fileName, fileSize, chunkCount, chunkSize = 16384) {
  return {
    type: MSG_TYPES.AUDIO_META,
    spaceId,
    trackId,
    generationId,
    fileName,
    fileSize,
    chunkCount,
    chunkSize,
    timestamp: Date.now()
  };
}

export function createAudioTransferCompleteMessage(trackId, generationId, fileSize) {
  return {
    type: MSG_TYPES.AUDIO_TRANSFER_COMPLETE,
    trackId,
    generationId,
    fileSize,
    timestamp: Date.now()
  };
}

export function createReadyMessage(spaceId, participantId, trackId, generationId) {
  return {
    type: MSG_TYPES.READY,
    spaceId,
    participantId,
    trackId,
    generationId,
    readyAt: Date.now()
  };
}

export function createBufferStatusMessage(spaceId, participantId, trackId, generationId, percent) {
  return {
    type: MSG_TYPES.BUFFER_STATUS,
    spaceId,
    participantId,
    trackId,
    generationId,
    bufferedPercent: percent
  };
}

export function createScheduledPlayMessage(spaceId, trackId, generationId, sequence, positionSeconds, targetStartTime, track = null) {
  return {
    type: MSG_TYPES.SCHEDULED_PLAY,
    spaceId,
    trackId,
    generationId,
    sequence,
    positionSeconds,
    targetStartTime,
    track: track ? {
      id: track.id,
      title: track.title,
      artist: track.artist,
      collection: track.collection,
      fileName: track.fileName,
      audioUrl: track.audioUrl,
      duration: track.duration
    } : null
  };
}

export function createPauseMessage(spaceId, trackId, generationId, sequence, positionSeconds, track = null) {
  return {
    type: MSG_TYPES.PAUSE,
    spaceId,
    trackId,
    generationId,
    sequence,
    positionSeconds,
    serverTime: Date.now(),
    track: track ? {
      id: track.id,
      title: track.title,
      artist: track.artist,
      collection: track.collection,
      fileName: track.fileName,
      audioUrl: track.audioUrl,
      duration: track.duration
    } : null
  };
}

export function createSeekMessage(spaceId, trackId, generationId, sequence, positionSeconds, targetStartTime, isPlaying, track = null) {
  return {
    type: MSG_TYPES.SEEK,
    spaceId,
    trackId,
    generationId,
    sequence,
    positionSeconds,
    targetStartTime,
    isPlaying,
    track: track ? {
      id: track.id,
      title: track.title,
      artist: track.artist,
      collection: track.collection,
      fileName: track.fileName,
      audioUrl: track.audioUrl,
      duration: track.duration
    } : null
  };
}

export function createStateSnapshotMessage(spaceId, trackId, generationId, sequence, isPlaying, positionSeconds, track = null) {
  return {
    type: MSG_TYPES.STATE_SNAPSHOT,
    spaceId,
    trackId,
    generationId,
    sequence,
    isPlaying,
    positionSeconds,
    track: track ? {
      id: track.id,
      title: track.title,
      artist: track.artist,
      collection: track.collection,
      fileName: track.fileName,
      audioUrl: track.audioUrl,
      duration: track.duration
    } : null,
    timestamp: Date.now()
  };
}

// Validator
export function validatePeerMessage(msg) {
  if (!msg || typeof msg !== 'object') return false;
  if (!msg.type || !Object.values(MSG_TYPES).includes(msg.type)) return false;
  return true;
}
