import { useEffect, useRef, useState } from 'react';

export const useWebRTC = (roomId, socket, localStream, screenStream, userName = 'Anonymous') => {
  const [peers, setPeers] = useState({});
  const peersRef = useRef({});
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

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

    console.log(`🔌 Creating RTCPeerConnection for ${userId} (${remoteUserName})`);

    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(config);

    // Track handling
    pc.ontrack = (event) => {
      console.log(`📥 Received track from ${userId}:`, event.track.kind);
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
        socket.emit('ice-candidate', {
          to: userId,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`🔗 Connection state with ${userId}:`, pc.connectionState);
      if (pc.connectionState === 'failed') pc.restartIce();
    };

    // Store peer
    peersRef.current[userId] = {
      peer: pc,
      userName: remoteUserName,
      stream: null,
      iceCandidatesQueue: [] // Queue candidates if remote desc not set
    };
    updatePeers();

    // ID-based arbitration: smaller ID initiates
    pc.onnegotiationneeded = () => {
      if (socket.id < userId) {
        console.log(`🔄 Negotiation needed for ${userId} (Acting as Initiator)`);
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit('offer', {
              userToSignal: userId,
              callerId: socket.id,
              signal: pc.localDescription
            });
          })
          .catch(err => console.error('Negotiation error:', err));
      }
    };

    // Initial track addition using REFS to ensure we have the live stream
    const activeStream = screenStreamRef.current || localStreamRef.current;
    if (activeStream) {
      console.log(`📤 Adding tracks to peer ${userId} from Ref`);
      activeStream.getTracks().forEach(track => pc.addTrack(track, activeStream));
    } else {
      console.warn(`⚠️ No stream in Ref yet for peer ${userId}`);
    }

    return pc;
  };

  useEffect(() => {
    if (!socket || !roomId) return;

    socket.on('existing-users', ({ users }) => {
      console.log('👥 Existing users:', users);
      users.forEach(uid => createPeerConnection(uid));
    });

    socket.on('user-joined', ({ userId, userName: remoteName }) => {
      console.log(`👋 User joined: ${userId}`);
      createPeerConnection(userId, remoteName);
    });

    socket.on('offer', async ({ from, offer, userName: remoteName }) => {
      console.log(`📨 Received offer from: ${from}`);
      const pc = createPeerConnection(from, remoteName);

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // Process queued ICE candidates
        const peerData = peersRef.current[from];
        if (peerData?.iceCandidatesQueue) {
          while (peerData.iceCandidatesQueue.length > 0) {
            const cand = peerData.iceCandidatesQueue.shift();
            await pc.addIceCandidate(cand);
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { callerId: from, signal: answer });
      } catch (err) {
        console.error('❌ Offer error:', err);
      }
    });

    socket.on('answer', async ({ from, answer }) => {
      const pc = peersRef.current[from]?.peer;
      if (pc && pc.signalingState !== 'stable') {
        console.log(`📨 Received answer from: ${from}`);
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('ice-candidate', async ({ from, candidate }) => {
      const peerData = peersRef.current[from];
      if (!peerData) return;
      const pc = peerData.peer;

      if (pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('ICE candidate failed:', e);
        }
      } else {
        // Queue candidates if remote desc not yet set
        peerData.iceCandidatesQueue.push(new RTCIceCandidate(candidate));
      }
    });

    socket.on('user-left', ({ userId }) => {
      if (peersRef.current[userId]) {
        peersRef.current[userId].peer.close();
        delete peersRef.current[userId];
        updatePeers();
      }
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

  // Handle stream updates (reactive track replacement)
  useEffect(() => {
    if (!localStream) return;
    Object.values(peersRef.current).forEach(peerData => {
      const pc = peerData.peer;
      const senders = pc.getSenders();
      localStream.getTracks().forEach(track => {
        const sender = senders.find(s => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          // If we didn't have tracks before, add them now
          pc.addTrack(track, localStream);
        }
      });
    });
  }, [localStream]);

  // Handle screen share
  useEffect(() => {
    if (!screenStream) return;
    const screenTrack = screenStream.getVideoTracks()[0];
    Object.values(peersRef.current).forEach(peerData => {
      const sender = peerData.peer.getSenders().find(s => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(screenTrack);
    });

    screenTrack.onended = () => {
      if (localStreamRef.current) {
        const camTrack = localStreamRef.current.getVideoTracks()[0];
        Object.values(peersRef.current).forEach(peerData => {
          const sender = peerData.peer.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(camTrack);
        });
      }
    };
  }, [screenStream]);

  return { peers };
};