import React, { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import CollectionCard from '../components/CollectionCard';
import SongRow from '../components/SongRow';
import Player from '../components/Player';
import SpaceModal from '../components/SpaceModal';
import PeerStatusPanel from '../components/PeerStatusPanel';

import { DEMO_TRACKS, CURATED_COLLECTIONS } from '../services/catalogData';
import { api } from '../services/api';
import { AudioEngine } from '../player/audioEngine';
import { SyncController } from '../player/syncController';
import { SignalingClient } from '../networking/signalingClient';
import { WebRTCManager } from '../networking/webrtcManager';
import { AudioTransferService } from '../networking/audioTransfer';
import { createPingMessage, createPongMessage, MSG_TYPES } from '../networking/protocol';
import { performanceMetrics } from '../networking/performanceMetrics';

export default function App() {
  // Catalog State
  const [songs, setSongs] = useState(DEMO_TRACKS);
  const [selectedCollection, setSelectedCollection] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Audio Playback State
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);

  // Space & P2P State
  const [activeSpace, setActiveSpace] = useState(null); // { code, peerId, isHost, hostName }
  const [isSpaceModalOpen, setIsSpaceModalOpen] = useState(false);
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [connectionState, setConnectionState] = useState('idle');
  const [isDataChannelOpen, setIsDataChannelOpen] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState([]);
  const [syncDriftMs, setSyncDriftMs] = useState(0);

  // Transfer & Verification State (Milestones 3, 4)
  const [transferProgress, setTransferProgress] = useState(null);
  const [transferResult, setTransferResult] = useState(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [pingResult, setPingResult] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [metricsSnapshot, setMetricsSnapshot] = useState(() => performanceMetrics.getMetricsSnapshot());

  // Subscribe to performance metrics updates
  useEffect(() => {
    return performanceMetrics.subscribe((snapshot) => {
      setMetricsSnapshot(snapshot);
    });
  }, []);

  // Engine & Networking References
  const audioEngineRef = useRef(null);
  const signalingClientRef = useRef(null);
  const webrtcManagerRef = useRef(null);
  const audioTransferRef = useRef(null);
  const syncControllerRef = useRef(null);
  const p2pBlobUrlsRef = useRef(new Map());

  // Helper to show transient toast alerts
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Switch track requested by authoritative Host via WebRTC synchronization
  const handleRemoteTrackChange = async (trackId, trackMeta) => {
    const foundTrack =
      songs.find((s) => s.id === trackId) ||
      DEMO_TRACKS.find((s) => s.id === trackId) ||
      trackMeta;

    if (!foundTrack) return;

    setCurrentTrack(foundTrack);
    if (audioEngineRef.current) {
      const cachedBlobUrl = p2pBlobUrlsRef.current.get(trackId);
      await audioEngineRef.current.loadTrack(foundTrack, cachedBlobUrl || null);
    }
  };

  // 1. Initialize Audio Engine
  useEffect(() => {
    const engine = new AudioEngine({
      onTimeUpdate: (time, dur) => {
        setCurrentTime(time);
        if (dur) setDuration(dur);
      },
      onEnded: () => {
        handleNextTrack();
      },
      onStateChange: (state) => {
        setIsPlaying(state === 'playing');
      }
    });

    audioEngineRef.current = engine;

    // Load initial demo track
    if (DEMO_TRACKS.length > 0) {
      setCurrentTrack(DEMO_TRACKS[0]);
      engine.loadTrack(DEMO_TRACKS[0]);
    }

    // Try fetching fresh catalog from Django backend
    api.getSongs().then((loadedSongs) => {
      if (loadedSongs && loadedSongs.length > 0) {
        setSongs(loadedSongs);
      }
    });

    return () => {
      engine.pause();
    };
  }, []);

  // 2. Playback handlers
  const handlePlaySong = async (song) => {
    if (!audioEngineRef.current) return;

    // In a space as a participant, playback is authoritative to host
    if (activeSpace && !activeSpace.isHost) {
      showToast('Host is authoritative for space track and playback');
      return;
    }

    if (currentTrack?.id === song.id) {
      if (syncControllerRef.current && activeSpace?.isHost) {
        syncControllerRef.current.hostPlay();
      } else {
        await audioEngineRef.current.play();
      }
      return;
    }

    setCurrentTrack(song);
    await audioEngineRef.current.loadTrack(song);

    if (syncControllerRef.current && activeSpace?.isHost) {
      syncControllerRef.current.setGeneration(song.id);
      syncControllerRef.current.hostPlay(0);

      // Auto-stream track P2P in background to any connected participants
      if (audioTransferRef.current && connectedPeers.length > 0) {
        for (const peerId of connectedPeers) {
          audioTransferRef.current.sendTrack(
            peerId,
            activeSpace.code,
            song,
            syncControllerRef.current.generationId
          ).catch((err) => console.warn(`P2P auto-transfer to ${peerId} error:`, err.message));
        }
      }
    } else {
      await audioEngineRef.current.play();
    }
  };

  const handlePause = () => {
    if (syncControllerRef.current && activeSpace?.isHost) {
      syncControllerRef.current.hostPause();
    } else if (audioEngineRef.current) {
      audioEngineRef.current.pause();
    }
  };

  const handleSeek = (seconds) => {
    if (syncControllerRef.current && activeSpace?.isHost) {
      syncControllerRef.current.hostSeek(seconds);
    } else if (audioEngineRef.current) {
      audioEngineRef.current.seek(seconds);
    }
  };

  const handleVolumeChange = (vol) => {
    setVolume(vol);
    if (audioEngineRef.current) {
      audioEngineRef.current.setVolume(vol);
    }
  };

  const handleNextTrack = () => {
    if (!currentTrack || songs.length === 0) return;
    const currentIndex = songs.findIndex((s) => s.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % songs.length;
    handlePlaySong(songs[nextIndex]);
  };

  const handlePreviousTrack = () => {
    if (!currentTrack || songs.length === 0) return;
    const currentIndex = songs.findIndex((s) => s.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + songs.length) % songs.length;
    handlePlaySong(songs[prevIndex]);
  };

  // 3. Space Lifecycle & WebRTC Setup
  const initializeSpaceNetworking = (spaceInfo) => {
    const { code, peerId, isHost } = spaceInfo;

    // A. Signaling Client
    const signaling = new SignalingClient({
      spaceCode: code,
      peerId,
      isHost,
      onPeerJoined: (evt) => {
        showToast(`Peer joined: ${evt.displayName || evt.fromPeer}`);
        setConnectedPeers((prev) => [...prev, evt.fromPeer]);
        // Host initiates WebRTC handshake with joined peer
        if (isHost && webrtcManagerRef.current) {
          webrtcManagerRef.current.connectToPeer(evt.fromPeer);
        }
      },
      onSignalReceived: (signal) => {
        if (webrtcManagerRef.current) {
          webrtcManagerRef.current.handleSignal(signal);
        }
      },
      onPeerLeft: (evt) => {
        showToast('Peer left space');
        setConnectedPeers((prev) => prev.filter((id) => id !== evt.fromPeer));
      }
    });

    signalingClientRef.current = signaling;

    // B. WebRTC Manager
    const webrtc = new WebRTCManager({
      peerId,
      isHost,
      signalingClient: signaling,
      onStateChange: (remotePeerId, state, channelType) => {
        setConnectionState(state);
        if (state === 'connected' && (!channelType || channelType === 'control')) {
          setIsDataChannelOpen(true);
          showToast(`Direct WebRTC connection established with ${remotePeerId.slice(0, 8)}`);

          // Ensure metrics are recorded
          performanceMetrics.markConnectionOpen(remotePeerId);

          // If host is active, send immediate state snapshot to new peer
          if (isHost && syncControllerRef.current) {
            syncControllerRef.current.sendImmediateSnapshot(remotePeerId);

            // Also auto-stream current track P2P in background
            const activeTrack = audioEngineRef.current?.currentTrack;
            if (activeTrack && audioTransferRef.current) {
              audioTransferRef.current.sendTrack(
                remotePeerId,
                code,
                activeTrack,
                syncControllerRef.current.generationId
              ).catch((err) => console.warn(`P2P initial transfer error for ${remotePeerId}:`, err.message));
            }
          } else if (!isHost && syncControllerRef.current) {
            // Participant immediately starts background NTP clock sync
            syncControllerRef.current.startClockSync();
          }
        } else if (state === 'closed' || state === 'failed') {
          setIsDataChannelOpen(false);
        }
      },
      onControlMessage: (remotePeerId, msg) => {
        handleIncomingControlMessage(remotePeerId, msg);
      },
      onTransferChunk: (remotePeerId, chunkBuffer) => {
        if (audioTransferRef.current) {
          audioTransferRef.current.handleTransferChunk(remotePeerId, chunkBuffer);
        }
      }
    });

    webrtcManagerRef.current = webrtc;

    // C. Audio Transfer Service
    const transferService = new AudioTransferService({
      webrtcManager: webrtc,
      onTransferProgress: (progress) => {
        setTransferProgress(progress);
      },
      onTransferComplete: (result) => {
        setTransferResult(result);
        setTransferProgress(null);
        p2pBlobUrlsRef.current.set(result.trackId, result.objectUrl);
        showToast(`Audio received P2P: ${result.fileName} (${(result.totalBytes / 1024 / 1024).toFixed(1)} MB)`);

        // Seamlessly update participant engine with direct P2P blob
        const receivedTrack = songs.find((s) => s.id === result.trackId) || {
          id: result.trackId,
          title: result.fileName,
          artist: 'P2P Streamed Track'
        };
        setCurrentTrack(receivedTrack);
        if (audioEngineRef.current) {
          const currentTime = audioEngineRef.current.getCurrentTime();
          const isPlaying = audioEngineRef.current.isPlaying;
          audioEngineRef.current.loadTrack(receivedTrack, result.objectUrl).then(() => {
            if (currentTime > 0) audioEngineRef.current.seek(currentTime);
            if (isPlaying) audioEngineRef.current.play();
          });
        }
      }
    });

    audioTransferRef.current = transferService;

    // D. Playback Synchronization Controller
    const sync = new SyncController({
      audioEngine: audioEngineRef.current,
      webrtcManager: webrtc,
      spaceId: code,
      isHost,
      onDriftCalculated: (drift) => {
        setSyncDriftMs(drift);
      },
      onTrackChange: handleRemoteTrackChange
    });

    syncControllerRef.current = sync;

    // Start signaling polling
    signaling.start();
  };

  // Handle incoming control messages over WebRTC DataChannel
  const handleIncomingControlMessage = (remotePeerId, msg) => {
    switch (msg.type) {
      case MSG_TYPES.PING: {
        // Immediate PONG response for Milestone 4 verification
        const pong = createPongMessage(activeSpace?.peerId, msg.timestamp);
        webrtcManagerRef.current?.sendControlMessage(remotePeerId, pong);
        break;
      }
      case MSG_TYPES.PONG: {
        syncControllerRef.current?.handlePong(msg);
        const rtt = Date.now() - msg.pingTimestamp;
        const offset = syncControllerRef.current?.clockOffset || 0;
        setPingResult(`RTT: ${rtt} ms | Clock Offset: ${offset >= 0 ? '+' : ''}${offset} ms`);
        break;
      }
      case MSG_TYPES.AUDIO_META: {
        audioTransferRef.current?.handleAudioMeta(msg);
        showToast(`Receiving P2P audio: ${msg.fileName}...`);
        break;
      }
      case MSG_TYPES.AUDIO_TRANSFER_COMPLETE: {
        audioTransferRef.current?.handleTransferComplete(remotePeerId, msg);
        break;
      }
      case MSG_TYPES.READY: {
        showToast(`Peer ${remotePeerId.slice(0, 8)} buffered and ready!`);
        break;
      }
      case MSG_TYPES.SCHEDULED_PLAY: {
        syncControllerRef.current?.handleScheduledPlay(msg);
        break;
      }
      case MSG_TYPES.PAUSE: {
        syncControllerRef.current?.handlePause(msg);
        break;
      }
      case MSG_TYPES.SEEK: {
        syncControllerRef.current?.handleSeek(msg);
        break;
      }
      case MSG_TYPES.STATE_SNAPSHOT: {
        syncControllerRef.current?.handleStateSnapshot(msg);
        break;
      }
      case MSG_TYPES.PLAY_ACK: {
        performanceMetrics.recordPlayAck(remotePeerId, msg.skewMs);
        showToast(`Peer sync skew: ${msg.skewMs} ms`);
        break;
      }
      default:
        break;
    }
  };

  // Create Space Handler
  const handleCreateSpace = async (hostDisplayName) => {
    setIsCreatingSpace(true);
    try {
      const peerId = `host-${Date.now()}`;
      const res = await api.createSpace(peerId, hostDisplayName);

      const spaceInfo = {
        code: res.code,
        peerId,
        isHost: true,
        displayName: hostDisplayName
      };

      performanceMetrics.setContext({
        isHost: true,
        spaceCode: res.code,
        localPeerId: peerId
      });
      performanceMetrics.markHostSpaceCreated(peerId);

      setActiveSpace(spaceInfo);
      initializeSpaceNetworking(spaceInfo);
      showToast(`Space created: ${res.code}`);
    } finally {
      setIsCreatingSpace(false);
    }
  };

  // Join Space Handler
  const handleJoinSpace = async (spaceCode, guestDisplayName) => {
    setIsCreatingSpace(true);
    const peerId = `guest-${Date.now()}`;
    performanceMetrics.markJoinInitiated(peerId);
    performanceMetrics.setContext({
      isHost: false,
      spaceCode,
      localPeerId: peerId
    });

    try {
      const res = await api.joinSpace(spaceCode, peerId, guestDisplayName);

      const spaceInfo = {
        code: res.code,
        peerId,
        isHost: false,
        displayName: guestDisplayName,
        hostPeerId: res.hostPeerId
      };

      setActiveSpace(spaceInfo);
      initializeSpaceNetworking(spaceInfo);
      showToast(`Joined Space: ${res.code}`);
    } finally {
      setIsCreatingSpace(false);
    }
  };

  // Leave Space Handler
  const handleLeaveSpace = async () => {
    if (activeSpace) {
      await api.leaveSpace(activeSpace.code, activeSpace.peerId);
    }
    signalingClientRef.current?.stop();
    webrtcManagerRef.current?.closeAll();
    syncControllerRef.current?.cleanup();
    performanceMetrics.reset();

    setActiveSpace(null);
    setConnectionState('idle');
    setIsDataChannelOpen(false);
    setConnectedPeers([]);
    setTransferProgress(null);
    setTransferResult(null);
    setPingResult('');
    showToast('Left listening space');
  };

  // Milestone 4: Trigger Test Ping
  const handleSendTestPing = () => {
    if (!webrtcManagerRef.current || !activeSpace) return;
    const pingMsg = createPingMessage(activeSpace.peerId);
    const sent = webrtcManagerRef.current.broadcastControlMessage(pingMsg);
    if (sent > 0) {
      setPingResult('Ping sent, awaiting PONG...');
    } else {
      setPingResult('No open data channels');
    }
  };

  // Milestone 4: Trigger Direct Audio Transfer
  const handleTriggerAudioTransfer = async () => {
    if (!activeSpace?.isHost || !currentTrack || !audioTransferRef.current) return;

    if (connectedPeers.length === 0) {
      showToast('No guests connected in space to transfer to');
      return;
    }

    setIsTransferring(true);
    try {
      for (const peerId of connectedPeers) {
        await audioTransferRef.current.sendTrack(
          peerId,
          activeSpace.code,
          currentTrack,
          syncControllerRef.current?.generationId || `gen-${Date.now()}`
        );
      }
      showToast(`Completed P2P transfer of ${currentTrack.title}`);
    } catch (err) {
      showToast(`Transfer error: ${err.message}`);
    } finally {
      setIsTransferring(false);
    }
  };

  // Filter songs based on collection and search query
  const filteredSongs = songs.filter((song) => {
    const matchesCollection =
      selectedCollection === 'all' ||
      song.collection.toLowerCase() ===
        CURATED_COLLECTIONS.find((c) => c.id === selectedCollection)?.collectionTag?.toLowerCase();

    const matchesSearch =
      !searchQuery ||
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCollection && matchesSearch;
  });

  return (
    <div className="app-container">
      <div className="app-main-layout">
        <Sidebar
          selectedCollection={selectedCollection}
          onSelectCollection={setSelectedCollection}
          activeSpace={activeSpace}
          onOpenSpaceModal={() => setIsSpaceModalOpen(true)}
        />

        <main className="main-content">
          <Navbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            activeSpace={activeSpace}
            onOpenSpaceModal={() => setIsSpaceModalOpen(true)}
            connectionStatus={
              isDataChannelOpen
                ? 'connected'
                : connectionState === 'connecting'
                ? 'buffering'
                : ''
            }
          />

          <div className="content-body">
            {/* Active Space Banner & Diagnostics */}
            {activeSpace && (
              <PeerStatusPanel
                activeSpace={activeSpace}
                connectionState={connectionState}
                isDataChannelOpen={isDataChannelOpen}
                peers={connectedPeers}
                transferProgress={transferProgress}
                transferResult={transferResult}
                syncDriftMs={syncDriftMs}
                metricsSnapshot={metricsSnapshot}
                onSendTestPing={handleSendTestPing}
                pingResult={pingResult}
                onTriggerAudioTransfer={handleTriggerAudioTransfer}
                isTransferring={isTransferring}
                onLeaveSpace={handleLeaveSpace}
              />
            )}

            {/* Curated Collections Row */}
            <section>
              <div className="section-header">
                <div>
                  <h2 className="section-title">Curated Collections</h2>
                  <p className="section-subtitle">
                    Manually selected demo groups from the verified tracks
                  </p>
                </div>
              </div>

              <div className="collections-grid">
                {CURATED_COLLECTIONS.map((col) => (
                  <CollectionCard
                    key={col.id}
                    collection={col}
                    isSelected={selectedCollection === col.id}
                    onClick={() => setSelectedCollection(col.id)}
                  />
                ))}
              </div>
            </section>

            {/* Song Table */}
            <section>
              <div className="section-header">
                <div>
                  <h3 className="section-title">
                    {CURATED_COLLECTIONS.find((c) => c.id === selectedCollection)?.name || 'Tracks'}
                  </h3>
                  <p className="section-subtitle">
                    Showing {filteredSongs.length} of {songs.length} playable demo files
                  </p>
                </div>
              </div>

              <div className="songs-table-container">
                <div className="songs-table-header">
                  <div>#</div>
                  <div>Title</div>
                  <div>Collection</div>
                  <div>File Size</div>
                  <div style={{ textAlign: 'right' }}>Duration</div>
                </div>

                {filteredSongs.map((song, idx) => (
                  <SongRow
                    key={song.id}
                    song={song}
                    index={idx}
                    isCurrent={currentTrack?.id === song.id}
                    isPlaying={isPlaying}
                    onPlay={handlePlaySong}
                    onPause={handlePause}
                  />
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* Persistent Bottom Player */}
      <Player
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        activeSpace={activeSpace}
        onPlay={() => handlePlaySong(currentTrack || songs[0])}
        onPause={handlePause}
        onSeek={handleSeek}
        onNext={handleNextTrack}
        onPrevious={handlePreviousTrack}
        onVolumeChange={handleVolumeChange}
      />

      {/* Space Modal */}
      <SpaceModal
        isOpen={isSpaceModalOpen}
        onClose={() => setIsSpaceModalOpen(false)}
        onCreateSpace={handleCreateSpace}
        onJoinSpace={handleJoinSpace}
        isCreating={isCreatingSpace}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-banner">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
