import { useEffect, useRef, useState } from 'react';

export const useWebRTC = (roomId, socket, localStream, localUserName = 'Anonymous') => {
  const [peers, setPeers] = useState({});
  const peersRef = useRef({});

  useEffect(() => {
    if (!socket || !localStream) return;

    socket.on('existing-users', ({ users }) => {
      users.forEach(user => {
        // Handle both old format (id string) and new format (user object)
        const userId = user.id || user;
        const userName = user.userName || 'Anonymous';
        createPeerConnection(userId, true, userName);
      });
    });

    socket.on('user-joined', ({ userId, userName }) => {
      console.log('User joined:', userId, userName);
    });

    socket.on('offer', async ({ from, offer, userName }) => {
      console.log('Received offer from:', from, userName);
      const pc = createPeerConnection(from, false, userName);

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', {
          callerId: from,
          signal: answer,
          userName: localUserName
        });
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    });

    socket.on('answer', async ({ from, answer, userName }) => {
      console.log('Received answer from:', from);
      const pc = peersRef.current[from]?.peer;

      // Update username if provided
      if (peersRef.current[from] && userName) {
        peersRef.current[from].userName = userName;
        setPeers({ ...peersRef.current });
      }

      // Only set remote description if we're in the right state
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
  }, [socket, localStream, roomId, localUserName]);

  const createPeerConnection = (userId, isInitiator, userName = 'Anonymous') => {
    if (peersRef.current[userId]) return peersRef.current[userId].peer;

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

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    pc.ontrack = (event) => {
      console.log('Received track from:', userId);
      if (event.streams && event.streams[0]) {
        peersRef.current[userId] = {
          peer: pc,
          userName: peersRef.current[userId]?.userName || userName,
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
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        console.log('✅ Connected to:', userId);
      }
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
            signal: pc.localDescription,
            userName: localUserName
          });
        })
        .catch(err => console.error('Error creating offer:', err));
    }

    return pc;
  };

  return { peers };
};