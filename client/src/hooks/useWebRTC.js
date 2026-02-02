import { useEffect, useRef, useState } from 'react';

export const useWebRTC = (roomId, socket, localStream, screenStream, localUserName = 'Anonymous') => {
  const [peers, setPeers] = useState({});
  const peersRef = useRef({});
  const pendingCandidates = useRef({}); // Buffer for ICE candidates arriving before RemoteDescription

  useEffect(() => {
    if (!socket) return;

    socket.on('existing-users', ({ users }) => {
      console.log('📡 Found existing users:', users.length);
      users.forEach(user => {
        const userId = user.id || user;
        const userName = user.userName || 'Anonymous';
        console.log('📡 Initiating connection to existing user:', userId, userName);
        createPeerConnection(userId, true, userName);
      });
    });

    socket.on('user-joined', ({ userId, userName }) => {
      console.log('👤 User joined room:', userId, userName);
      // Wait for their offer (we are the existing user)
      createPeerConnection(userId, false, userName);
    });

    socket.on('offer', async ({ from, offer, userName }) => {
      console.log('📩 Received offer from:', from, userName);
      const pc = createPeerConnection(from, false, userName);

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        console.log('✅ Remote description (Offer) set for:', from);

        // Process buffered candidates
        if (pendingCandidates.current[from]) {
          console.log(`❄️ Applying ${pendingCandidates.current[from].length} buffered candidates for:`, from);
          pendingCandidates.current[from].forEach(async (candidate) => {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
              console.error('❌ Error adding buffered candidate:', e);
            }
          });
          delete pendingCandidates.current[from];
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log('📤 Sending answer to:', from);
        socket.emit('answer', {
          callerId: from,
          signal: answer,
          userName: localUserName
        });
      } catch (err) {
        console.error('❌ Error handling offer:', err);
      }
    });

    socket.on('answer', async ({ from, answer }) => {
      console.log('📩 Received answer from:', from);
      const pc = peersRef.current[from]?.peer;

      if (pc && pc.signalingState !== 'stable') {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('✅ Remote description (Answer) set for:', from);

          // Process buffered candidates
          if (pendingCandidates.current[from]) {
            console.log(`❄️ Applying ${pendingCandidates.current[from].length} buffered candidates for:`, from);
            pendingCandidates.current[from].forEach(async (candidate) => {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } catch (e) {
                console.error('❌ Error adding buffered candidate:', e);
              }
            });
            delete pendingCandidates.current[from];
          }
        } catch (err) {
          console.error('❌ Error setting remote description:', err);
        }
      }
    });

    socket.on('ice-candidate', async ({ from, candidate }) => {
      const pc = peersRef.current[from]?.peer;
      if (pc && candidate) {
        if (pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            // console.log('❄️ Successfully added ICE candidate from:', from);
          } catch (err) {
            console.error('❌ Error adding ICE candidate:', err);
          }
        } else {
          // Buffer candidate if remote description not set yet
          // console.log('⏳ Buffering ICE candidate from:', from);
          if (!pendingCandidates.current[from]) {
            pendingCandidates.current[from] = [];
          }
          pendingCandidates.current[from].push(candidate);
        }
      }
    });

    socket.on('user-left', ({ userId }) => {
      console.log('👋 User left:', userId);
      if (peersRef.current[userId]) {
        peersRef.current[userId].peer.close();
        delete peersRef.current[userId];
        if (pendingCandidates.current[userId]) {
          delete pendingCandidates.current[userId];
        }
        setPeers({ ...peersRef.current });
      }
    });

    return () => {
      console.log('🧹 Cleaning up WebRTC listeners');
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
  }, [socket, roomId, localUserName]);

  // Effect to add tracks when localStream arrives or changes
  useEffect(() => {
    if (!localStream) return;

    console.log('🎥 Local stream tracks updating...');
    Object.values(peersRef.current).forEach(({ peer }) => {
      const currentSenders = peer.getSenders();
      localStream.getTracks().forEach(track => {
        const sender = currentSenders.find(s => s.track && s.track.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track).catch(err => console.error('Error replacing track:', err));
        } else {
          peer.addTrack(track, localStream);
        }
      });
    });
  }, [localStream]);

  // Handle screen share - replace video track in all peer connections
  useEffect(() => {
    if (Object.keys(peersRef.current).length === 0) return;

    if (screenStream) {
      const screenVideoTrack = screenStream.getVideoTracks()[0];

      Object.values(peersRef.current).forEach(({ peer }) => {
        const senders = peer.getSenders();
        const videoSender = senders.find(sender =>
          sender.track && sender.track.kind === 'video'
        );

        if (videoSender && screenVideoTrack) {
          videoSender.replaceTrack(screenVideoTrack)
            .then(() => console.log('Screen track replaced'))
            .catch(err => console.error('Error replacing track:', err));
        }
      });

      screenVideoTrack.onended = () => {
        if (localStream) {
          const cameraVideoTrack = localStream.getVideoTracks()[0];
          Object.values(peersRef.current).forEach(({ peer }) => {
            const senders = peer.getSenders();
            const videoSender = senders.find(sender =>
              sender.track && sender.track.kind === 'video'
            );

            if (videoSender && cameraVideoTrack) {
              videoSender.replaceTrack(cameraVideoTrack)
                .then(() => console.log('Camera track restored'))
                .catch(err => console.error('Error restoring track:', err));
            }
          });
        }
      };
    } else if (localStream) {
      const cameraVideoTrack = localStream.getVideoTracks()[0];
      Object.values(peersRef.current).forEach(({ peer }) => {
        const senders = peer.getSenders();
        const videoSender = senders.find(sender =>
          sender.track && sender.track.kind === 'video'
        );

        if (videoSender && cameraVideoTrack && videoSender.track !== cameraVideoTrack) {
          videoSender.replaceTrack(cameraVideoTrack)
            .catch(err => console.error('Error restoring camera track:', err));
        }
      });
    }
  }, [screenStream, localStream]);

  const createPeerConnection = (userId, isInitiator, userName = 'Anonymous') => {
    if (peersRef.current[userId] &&
      peersRef.current[userId].peer.connectionState !== 'closed' &&
      peersRef.current[userId].peer.connectionState !== 'failed') {
      console.log('Using existing peer connection for:', userId);
      return peersRef.current[userId].peer;
    }

    console.log('Creating new peer connection for:', userId, 'as initiator:', isInitiator);

    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10
    };

    const pc = new RTCPeerConnection(config);

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    if (screenStream) {
      const screenVideoTrack = screenStream.getVideoTracks()[0];
      const senders = pc.getSenders();
      const videoSender = senders.find(sender =>
        sender.track && sender.track.kind === 'video'
      );

      if (videoSender && screenVideoTrack) {
        videoSender.replaceTrack(screenVideoTrack)
          .then(() => console.log('Screen track applied to new peer:', userId))
          .catch(err => console.error('Error replacing track for new peer:', err));
      }
    }

    pc.ontrack = (event) => {
      console.log('📡 Received remote track:', event.track.kind, 'from:', userId);

      // If browsers add multiple tracks, ensure we get the stream
      const remoteStream = event.streams[0] || new MediaStream([event.track]);

      const currentName = peersRef.current[userId]?.userName || userName;
      peersRef.current[userId] = {
        ...peersRef.current[userId],
        peer: pc,
        userName: currentName,
        stream: remoteStream
      };
      setPeers({ ...peersRef.current });
      console.log('📺 Stream state updated for:', userId);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          to: userId,
          candidate: event.candidate
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 ICE Connection state with ${userId}:`, pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected') {
        console.log('✅ Peer network connection established with:', userId);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`📡 Peer connection state with ${userId}:`, pc.connectionState);
      if (pc.connectionState === 'connected') {
        console.log('✅ Fully connected to:', userId);
      }
    };

    peersRef.current[userId] = {
      peer: pc,
      userName: peersRef.current[userId]?.userName || userName
    };
    setPeers({ ...peersRef.current });

    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          console.log('📤 Sending offer to:', userId);
          socket.emit('offer', {
            userToSignal: userId,
            callerId: socket.id,
            signal: pc.localDescription,
            userName: localUserName
          });
        })
        .catch(err => console.error('❌ Error creating offer:', err));
    }

    return pc;
  };

  return { peers };
};