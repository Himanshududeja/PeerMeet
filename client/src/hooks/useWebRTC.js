import { useEffect, useRef, useState, useCallback } from 'react';

export const useWebRTC = (roomId, socket, localStream, screenStream) => {
  const [peers, setPeers] = useState({});
  const peersRef = useRef({});

  // Function to get current stream to send (screen or camera)
  const getCurrentStream = useCallback(() => {
    return screenStream || localStream;
  }, [screenStream, localStream]);

  useEffect(() => {
    if (!socket || !localStream) return;

    socket.on('existing-users', ({ users }) => {
      users.forEach(userId => {
        createPeerConnection(userId, true);
      });
    });

    socket.on('user-joined', ({ userId, userName }) => {
      console.log('User joined:', userId, userName);
      createPeerConnection(userId, true, userName);
    });

    socket.on('offer', async ({ from, offer, userName }) => {
      console.log('Received offer from:', from);
      const pc = createPeerConnection(from, false, userName);
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { callerId: from, signal: answer });
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    });

    socket.on('answer', async ({ from, answer }) => {
      console.log('Received answer from:', from);
      const pc = peersRef.current[from]?.peer;
      
      if (pc && pc.signalingState !== 'stable') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('Answer set successfully');
        } catch (err) {
          console.error('Error setting remote description:', err);
        }
      }
    });

    socket.on('ice-candidate', async ({ from, candidate }) => {
      const pc = peersRef.current[from]?.peer;
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    });

    socket.on('user-left', ({ userId }) => {
      console.log('User left:', userId);
      if (peersRef.current[userId]) {
        peersRef.current[userId].peer.close();
        delete peersRef.current[userId];
        setPeers({ ...peersRef.current });
      }
    });

    return () => {
      Object.values(peersRef.current).forEach(({ peer }) => {
        if (peer) peer.close();
      });
      socket.off('existing-users');
      socket.off('user-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-left');
    };
  }, [socket, localStream, roomId, createPeerConnection]);

  // Handle screen share - replace video track in all peer connections
  useEffect(() => {
    if (!screenStream || Object.keys(peersRef.current).length === 0) return;

    console.log('📺 Starting screen share for all peers');
    const screenVideoTrack = screenStream.getVideoTracks()[0];
    
    Object.entries(peersRef.current).forEach(([userId, { peer }]) => {
      const senders = peer.getSenders();
      const videoSender = senders.find(sender => 
        sender.track && sender.track.kind === 'video'
      );

      if (videoSender && screenVideoTrack) {
        videoSender.replaceTrack(screenVideoTrack)
          .then(() => console.log(`✅ Screen track sent to peer: ${userId}`))
          .catch(err => console.error(`❌ Error sending screen to ${userId}:`, err));
      }
    });

    // When screen sharing stops, switch back to camera
    screenVideoTrack.onended = () => {
      console.log('📹 Screen share ended, switching back to camera');
      if (localStream) {
        const cameraVideoTrack = localStream.getVideoTracks()[0];
        Object.entries(peersRef.current).forEach(([userId, { peer }]) => {
          const senders = peer.getSenders();
          const videoSender = senders.find(sender => 
            sender.track && sender.track.kind === 'video'
          );

          if (videoSender && cameraVideoTrack) {
            videoSender.replaceTrack(cameraVideoTrack)
              .then(() => console.log(`✅ Camera restored for peer: ${userId}`))
              .catch(err => console.error(`❌ Error restoring camera for ${userId}:`, err));
          }
        });
      }
    };
  }, [screenStream, localStream]);

  const createPeerConnection = useCallback((userId, isInitiator, userName = 'Anonymous') => {
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

    // IMPORTANT: Always use localStream initially (not screenStream)
    // We'll replace the video track later if screen sharing
    if (localStream) {
      localStream.getTracks().forEach(track => {
        console.log(`Adding ${track.kind} track to peer ${userId}`);
        pc.addTrack(track, localStream);
      });
    }

    pc.ontrack = (event) => {
      console.log(`📥 Received ${event.track.kind} track from:`, userId);
      if (event.streams && event.streams[0]) {
        peersRef.current[userId] = {
          peer: pc,
          userName,
          stream: event.streams[0]
        };
        setPeers({ ...peersRef.current });
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
      console.log(`Connection state for ${userId}:`, pc.connectionState);
      if (pc.connectionState === 'connected') {
        console.log('✅ Connected to:', userId);
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.log('❌ Connection issue with:', userId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${userId}:`, pc.iceConnectionState);
    };

    peersRef.current[userId] = {
      peer: pc,
      userName
    };
    setPeers({ ...peersRef.current });

    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('offer', {
            userToSignal: userId,
            callerId: socket.id,
            signal: pc.localDescription
          });
        })
        .catch(err => console.error('Error creating offer:', err));
    }

    return pc;
  }, [socket, localStream]);

  return { peers };
};