import { useEffect, useRef, useState } from 'react';

export const useWebRTC = (roomId, socket, localStream, screenStream) => {
  const [peers, setPeers] = useState({});
  const peersRef = useRef({});

  // Helper to update peers state
  const updatePeers = () => {
    setPeers({ ...peersRef.current });
  };

  // Create peer connection function
  const createPeerConnection = (userId, isInitiator, userName = 'Anonymous') => {
    // Don't create duplicate connections
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
      ],
      iceTransportPolicy: 'all'
    };

    const pc = new RTCPeerConnection(config);

    // CRITICAL: Always use localStream initially (camera + mic)
    if (localStream) {
      localStream.getTracks().forEach(track => {
        try {
          const sender = pc.addTrack(track, localStream);
          console.log(`✅ Added ${track.kind} track to peer ${userId}`, {
            enabled: track.enabled,
            readyState: track.readyState
          });
        } catch (err) {
          console.error(`❌ Error adding ${track.kind} track:`, err);
        }
      });
    } else {
      console.error('❌ No localStream available when creating peer connection');
    }

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log(`📥 Received ${event.track.kind} track from ${userId}:`, {
        enabled: event.track.enabled,
        readyState: event.track.readyState,
        muted: event.track.muted
      });

      if (event.streams && event.streams[0]) {
        // CRITICAL: Store the stream immediately
        const existingPeerData = peersRef.current[userId];
        peersRef.current[userId] = {
          peer: existingPeerData?.peer || pc,
          userName: existingPeerData?.userName || userName,
          stream: event.streams[0]
        };
        
        console.log(`✅ Stream stored for ${userId}:`, {
          audioTracks: event.streams[0].getAudioTracks().length,
          videoTracks: event.streams[0].getVideoTracks().length,
          hasStream: !!peersRef.current[userId].stream
        });
        
        // Force update
        setPeers({ ...peersRef.current });
      } else {
        console.error(`❌ No streams in ontrack event for ${userId}`);
      }
    };

    // ICE candidate handling
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          to: userId,
          candidate: event.candidate
        });
      }
    };

    // Connection state monitoring
    pc.onconnectionstatechange = () => {
      console.log(`🔗 Connection state for ${userId}:`, pc.connectionState);
      
      if (pc.connectionState === 'connected') {
        console.log(`✅ Connected to: ${userId} (${userName})`);
      } else if (pc.connectionState === 'failed') {
        console.log(`❌ Connection failed with: ${userId}`);
        // Try to restart ICE
        pc.restartIce();
      } else if (pc.connectionState === 'disconnected') {
        console.log(`⚠️ Disconnected from: ${userId}`);
      }
    };

    // ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE state for ${userId}:`, pc.iceConnectionState);
    };

    // Store peer before creating offer/answer
    peersRef.current[userId] = {
      peer: pc,
      userName
    };
    updatePeers();

    // Create offer if initiator
    if (isInitiator) {
      pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      })
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          console.log(`📤 Sending offer to ${userId}`);
          socket.emit('offer', {
            userToSignal: userId,
            callerId: socket.id,
            signal: pc.localDescription
          });
        })
        .catch(err => console.error(`❌ Error creating offer for ${userId}:`, err));
    }

    return pc;
  };

  useEffect(() => {
    if (!socket || !localStream) {
      console.log('⏳ Waiting for socket and localStream...');
      return;
    }

    console.log('🚀 WebRTC hook initialized');

    // Handle existing users
    socket.on('existing-users', ({ users }) => {
      console.log(`👥 Existing users in room:`, users);
      users.forEach(userId => {
        createPeerConnection(userId, true);
      });
    });

    // Handle new user joined
    socket.on('user-joined', ({ userId, userName }) => {
      console.log(`👋 User joined: ${userId} (${userName})`);
      createPeerConnection(userId, true, userName);
    });

    // Handle offer
    socket.on('offer', async ({ from, offer, userName }) => {
      console.log(`📨 Received offer from: ${from} (${userName})`);
      const pc = createPeerConnection(from, false, userName);
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        await pc.setLocalDescription(answer);
        
        console.log(`📤 Sending answer to ${from}`);
        socket.emit('answer', { 
          callerId: from, 
          signal: answer 
        });
      } catch (err) {
        console.error(`❌ Error handling offer from ${from}:`, err);
      }
    });

    // Handle answer
    socket.on('answer', async ({ from, answer }) => {
      console.log(`📨 Received answer from: ${from}`);
      const peerData = peersRef.current[from];
      
      if (!peerData || !peerData.peer) {
        console.error(`❌ No peer found for ${from}`);
        return;
      }

      const pc = peerData.peer;
      
      if (pc.signalingState !== 'stable') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          console.log(`✅ Answer set successfully for ${from}`);
        } catch (err) {
          console.error(`❌ Error setting remote description for ${from}:`, err);
        }
      } else {
        console.log(`⚠️ Peer ${from} already in stable state, skipping answer`);
      }
    });

    // Handle ICE candidate
    socket.on('ice-candidate', async ({ from, candidate }) => {
      const peerData = peersRef.current[from];
      
      if (peerData && peerData.peer && candidate) {
        try {
          await peerData.peer.addIceCandidate(new RTCIceCandidate(candidate));
          console.log(`✅ ICE candidate added for ${from}`);
        } catch (err) {
          console.error(`❌ Error adding ICE candidate for ${from}:`, err);
        }
      }
    });

    // Handle user left
    socket.on('user-left', ({ userId }) => {
      console.log(`👋 User left: ${userId}`);
      const peerData = peersRef.current[userId];
      
      if (peerData && peerData.peer) {
        peerData.peer.close();
        delete peersRef.current[userId];
        updatePeers();
      }
    });

    return () => {
      console.log('🧹 Cleaning up WebRTC connections');
      Object.entries(peersRef.current).forEach(([userId, peerData]) => {
        if (peerData.peer) {
          peerData.peer.close();
        }
      });
      socket.off('existing-users');
      socket.off('user-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-left');
    };
  }, [socket, localStream, roomId]);

  // Handle screen sharing
  useEffect(() => {
    if (!screenStream || Object.keys(peersRef.current).length === 0) return;

    console.log('📺 Starting screen share for all peers');
    const screenVideoTrack = screenStream.getVideoTracks()[0];
    
    if (!screenVideoTrack) {
      console.error('❌ No screen video track found');
      return;
    }

    Object.entries(peersRef.current).forEach(([userId, peerData]) => {
      if (!peerData.peer) return;

      const senders = peerData.peer.getSenders();
      const videoSender = senders.find(sender => 
        sender.track && sender.track.kind === 'video'
      );

      if (videoSender) {
        videoSender.replaceTrack(screenVideoTrack)
          .then(() => console.log(`✅ Screen track sent to peer: ${userId}`))
          .catch(err => console.error(`❌ Error sending screen to ${userId}:`, err));
      } else {
        console.error(`❌ No video sender found for ${userId}`);
      }
    });

    // Restore camera when screen sharing stops
    screenVideoTrack.onended = () => {
      console.log('📹 Screen share ended, switching back to camera');
      
      if (!localStream) return;
      
      const cameraVideoTrack = localStream.getVideoTracks()[0];
      if (!cameraVideoTrack) {
        console.error('❌ No camera video track found');
        return;
      }

      Object.entries(peersRef.current).forEach(([userId, peerData]) => {
        if (!peerData.peer) return;

        const senders = peerData.peer.getSenders();
        const videoSender = senders.find(sender => 
          sender.track && sender.track.kind === 'video'
        );

        if (videoSender) {
          videoSender.replaceTrack(cameraVideoTrack)
            .then(() => console.log(`✅ Camera restored for peer: ${userId}`))
            .catch(err => console.error(`❌ Error restoring camera for ${userId}:`, err));
        }
      });
    };
  }, [screenStream, localStream]);

  return { peers };
};