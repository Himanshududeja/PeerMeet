import { useEffect, useRef, useState } from 'react';

export const useWebRTC = (roomId, socket, localStream, screenStream, userName = 'Anonymous') => {
  const [peers, setPeers] = useState({});
  const peersRef = useRef({});

  // Helper to update peers state
  const updatePeers = () => {
    setPeers({ ...peersRef.current });
  };

  // Create peer connection function
  const createPeerConnection = (userId, isInitiator, remoteUserName = 'Anonymous') => {
    if (peersRef.current[userId]?.peer) {
      console.log(`⚠️ Peer ${userId} already exists, skipping`);
      return peersRef.current[userId].peer;
    }

    console.log(`🔌 Creating peer connection for ${userId}, initiator: ${isInitiator}`);

    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(config);

    // Dynamic track adding - will be handled by useEffect but we add initial tracks if available
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log(`📥 Received track from ${userId}`);
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
      console.log(`🔗 Connection state for ${userId}:`, pc.connectionState);
      if (pc.connectionState === 'failed') pc.restartIce();
    };

    peersRef.current[userId] = {
      peer: pc,
      userName: remoteUserName
    };
    updatePeers();

    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('offer', {
            userToSignal: userId,
            callerId: socket.id,
            signal: pc.localDescription
          });
        })
        .catch(err => console.error(`❌ Error creating offer:`, err));
    }

    return pc;
  };

  // Set up socket listeners immediately when socket is available
  useEffect(() => {
    if (!socket || !roomId) return;

    console.log('🚀 Setting up WebRTC socket listeners');

    socket.on('existing-users', ({ users }) => {
      console.log(`👥 Existing users:`, users);
      users.forEach(userId => createPeerConnection(userId, true));
    });

    socket.on('user-joined', ({ userId, userName: remoteName }) => {
      console.log(`👋 User joined: ${userId}`);
      // Joiner triggers offer, we wait as receiver (glare fix)
      createPeerConnection(userId, false, remoteName);
    });

    socket.on('offer', async ({ from, offer, userName: remoteName }) => {
      console.log(`📨 Received offer from: ${from}`);
      const pc = createPeerConnection(from, false, remoteName);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { callerId: from, signal: answer });
      } catch (err) {
        console.error(`❌ Offer error:`, err);
      }
    });

    socket.on('answer', async ({ from, answer }) => {
      const pc = peersRef.current[from]?.peer;
      if (pc && pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('ice-candidate', async ({ from, candidate }) => {
      const pc = peersRef.current[from]?.peer;
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on('user-left', ({ userId }) => {
      if (peersRef.current[userId]) {
        peersRef.current[userId].peer.close();
        delete peersRef.current[userId];
        updatePeers();
      }
    });

    // CRITICAL: Join room AFTER listeners are ready
    console.log('✅ Joining room:', roomId);
    socket.emit('join-room', { roomId, userName });

    return () => {
      console.log('🧹 Cleaning up WebRTC');
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

  // Handle localStream changes (initial load or camera switch)
  useEffect(() => {
    if (!localStream) return;

    Object.entries(peersRef.current).forEach(([userId, peerData]) => {
      if (!peerData.peer) return;

      const senders = peerData.peer.getSenders();
      localStream.getTracks().forEach(track => {
        const sender = senders.find(s => s.track && s.track.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          peerData.peer.addTrack(track, localStream);
        }
      });
    });
  }, [localStream]);

  // Handle screen sharing
  useEffect(() => {
    if (!screenStream) return;

    const screenTrack = screenStream.getVideoTracks()[0];
    Object.values(peersRef.current).forEach(peerData => {
      const senders = peerData.peer.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
      if (videoSender) videoSender.replaceTrack(screenTrack);
    });

    screenTrack.onended = () => {
      if (!localStream) return;
      const cameraTrack = localStream.getVideoTracks()[0];
      Object.values(peersRef.current).forEach(peerData => {
        const senders = peerData.peer.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) videoSender.replaceTrack(cameraTrack);
      });
    };
  }, [screenStream, localStream]);

  return { peers };
};