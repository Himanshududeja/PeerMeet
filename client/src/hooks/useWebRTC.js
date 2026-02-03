import { useEffect, useRef, useState } from 'react';

export const useWebRTC = (roomId, socket, localStream, screenStream, userName = 'Anonymous') => {
  const [peers, setPeers] = useState({});
  const peersRef = useRef({});
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  // Keep track of signaling state to prevent glare errors
  const makingOfferRef = useRef({}); // userId -> boolean

  // Keep refs updated to avoid stale closures in socket listeners
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  // Helper to update peers state
  const updatePeers = () => {
    setPeers({ ...peersRef.current });
  };

  // Create peer connection function
  const createPeerConnection = (userId, remoteUserName = 'Anonymous') => {
    if (peersRef.current[userId]?.peer) {
      return peersRef.current[userId].peer;
    }

    console.log(`🔌 Initializing PeerConnection for ${userId} (${remoteUserName})`);

    const isPolite = socket.id > userId; // Smaller ID is "impolite" (imposes its offer)

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Track handling
    pc.ontrack = (event) => {
      console.log(`📥 Track received from ${userId}:`, event.track.kind);
      if (event.streams && event.streams[0]) {
        peersRef.current[userId] = {
          ...peersRef.current[userId],
          stream: event.streams[0]
        };
        updatePeers();
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { to: userId, candidate: event.candidate });
      }
    };

    // Perfect Negotiation: Handle onnegotiationneeded for BOTH sides
    pc.onnegotiationneeded = async () => {
      try {
        console.log(`🔄 Negotiation needed for ${userId}`);
        makingOfferRef.current[userId] = true;
        await pc.setLocalDescription(); // Implicitly creates offer
        socket.emit('offer', {
          userToSignal: userId,
          callerId: socket.id,
          signal: pc.localDescription,
          userName: userName
        });
      } catch (err) {
        console.error(`❌ Negotiation failed for ${userId}:`, err);
      } finally {
        makingOfferRef.current[userId] = false;
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`🔗 Connection status [${userId}]:`, pc.connectionState);
      if (pc.connectionState === 'failed') pc.restartIce();
    };

    // Store peer
    peersRef.current[userId] = {
      peer: pc,
      userName: remoteUserName,
      stream: null,
      iceCandidatesQueue: [],
      isPolite
    };
    updatePeers();

    // Add current streams if available
    const currentStream = screenStreamRef.current || localStreamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach(track => pc.addTrack(track, currentStream));
    }

    return pc;
  };

  useEffect(() => {
    if (!socket || !roomId) return;

    socket.on('existing-users', ({ users }) => {
      users.forEach(user => {
        const userId = typeof user === 'string' ? user : user.id;
        const remoteName = typeof user === 'string' ? 'Anonymous' : user.userName;
        createPeerConnection(userId, remoteName);
      });
    });

    socket.on('user-joined', ({ userId, userName: remoteName }) => {
      createPeerConnection(userId, remoteName);
    });

    socket.on('offer', async ({ from, offer, userName: remoteName }) => {
      const pc = createPeerConnection(from, remoteName);
      const peerData = peersRef.current[from];

      try {
        const offerCollision = makingOfferRef.current[from] || pc.signalingState !== 'stable';
        const ignoreOffer = !peerData.isPolite && offerCollision;

        if (ignoreOffer) {
          console.warn(`🛑 Ignoring offer from ${from} due to glare (Impolite peer)`);
          return;
        }

        console.log(`📨 Processing offer from ${from}`);
        await pc.setRemoteDescription(offer);

        // Process queued ICE candidates
        while (peerData.iceCandidatesQueue.length > 0) {
          await pc.addIceCandidate(peerData.iceCandidatesQueue.shift());
        }

        await pc.setLocalDescription(); // Implicitly creates answer
        socket.emit('answer', { callerId: from, signal: pc.localDescription });
      } catch (err) {
        console.error(`❌ Offer processing failed:`, err);
      }
    });

    socket.on('answer', async ({ from, answer }) => {
      const pc = peersRef.current[from]?.peer;
      if (pc) {
        console.log(`📨 Answer received from ${from}`);
        await pc.setRemoteDescription(answer);
      }
    });

    socket.on('ice-candidate', async ({ from, candidate }) => {
      const peerData = peersRef.current[from];
      if (!peerData) return;

      if (peerData.peer.remoteDescription) {
        try {
          await peerData.peer.addIceCandidate(candidate);
        } catch (e) {
          console.warn('ICE failed:', e);
        }
      } else {
        peerData.iceCandidatesQueue.push(candidate);
      }
    });

    socket.on('user-left', ({ userId }) => {
      if (peersRef.current[userId]) {
        peersRef.current[userId].peer.close();
        delete peersRef.current[userId];
        delete makingOfferRef.current[userId];
        updatePeers();
      }
    });

    socket.on('connect', () => {
      console.log('🔄 Socket reconnected, re-joining room...');
      socket.emit('join-room', { roomId, userName });
    });

    socket.emit('join-room', { roomId, userName });

    return () => {
      socket.emit('leave-room', roomId);
      Object.values(peersRef.current).forEach(p => p.peer.close());
      socket.off('existing-users');
      socket.off('user-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-left');
    };
  }, [socket, roomId, userName]);

  // Track synchronization (Reactive)
  useEffect(() => {
    if (!localStream) return;
    Object.values(peersRef.current).forEach(peerData => {
      const pc = peerData.peer;
      const senders = pc.getSenders();
      localStream.getTracks().forEach(track => {
        const sender = senders.find(s => s.track?.kind === track.kind);
        if (sender) {
          if (sender.track !== track) sender.replaceTrack(track);
        } else {
          pc.addTrack(track, localStream);
        }
      });
    });
  }, [localStream]);

  useEffect(() => {
    if (!screenStream) return;
    const screenTrack = screenStream.getVideoTracks()[0];
    Object.values(peersRef.current).forEach(peerData => {
      const videoSender = peerData.peer.getSenders().find(s => s.track?.kind === 'video');
      if (videoSender) videoSender.replaceTrack(screenTrack);
    });
    screenTrack.onended = () => {
      if (localStreamRef.current) {
        const camTrack = localStreamRef.current.getVideoTracks()[0];
        Object.values(peersRef.current).forEach(peerData => {
          const videoSender = peerData.peer.getSenders().find(s => s.track?.kind === 'video');
          if (videoSender) videoSender.replaceTrack(camTrack);
        });
      }
    };
  }, [screenStream]);

  return { peers };
};