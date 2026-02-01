import { useEffect, useRef, useState } from 'react';

export const useWebRTC = (roomId, socket, localStream) => {
  const [peers, setPeers] = useState({});
  const peersRef = useRef({});

  useEffect(() => {
    if (!socket || !localStream) return;

    // Handle existing users in room
    socket.on('existing-users', ({ users }) => {
      users.forEach(userId => {
        createPeerConnection(userId, true);
      });
    });

    // User joined - create offer
    socket.on('user-joined', ({ userId, userName }) => {
      console.log('User joined:', userId, userName);
      createPeerConnection(userId, true, userName);
    });

    // Receive offer - create answer
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

    // Receive answer
    socket.on('answer', async ({ from, answer }) => {
      console.log('Received answer from:', from);
      const pc = peersRef.current[from]?.peer;
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error('Error setting remote description:', err);
        }
      }
    });

    // Handle ICE candidate
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

    // User left
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
  }, [socket, localStream, roomId]);

  const createPeerConnection = (userId, isInitiator, userName = 'Anonymous') => {
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

    // Add local stream tracks to peer connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle incoming stream
    pc.ontrack = (event) => {
      console.log('Received track from:', userId);
      if (event.streams && event.streams[0]) {
        peersRef.current[userId] = {
          peer: pc,
          userName,
          stream: event.streams[0]
        };
        setPeers({ ...peersRef.current });
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          to: userId,
          candidate: event.candidate
        });
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.log('Connection failed with:', userId);
      }
    };

    // Store peer connection
    peersRef.current[userId] = {
      peer: pc,
      userName
    };
    setPeers({ ...peersRef.current });

    // Create offer if initiator
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
  };

  return { peers };
};