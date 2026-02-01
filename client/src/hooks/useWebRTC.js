import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';

export const useWebRTC = (roomId, socket, localStream) => {
  const [peers, setPeers] = useState({});
  const peersRef = useRef({});

  useEffect(() => {
    if (!socket || !localStream) return;

    // Handle existing users in room
    socket.on('existing-users', ({ users }) => {
      users.forEach(userId => {
        const peer = createPeer(userId, socket.id, localStream);
        peersRef.current[userId] = { peer };
      });
      setPeers({ ...peersRef.current });
    });

    // User joined - create offer
    socket.on('user-joined', ({ userId, userName }) => {
      console.log('User joined:', userId, userName);
      const peer = createPeer(userId, socket.id, localStream);
      peersRef.current[userId] = { peer, userName };
      setPeers({ ...peersRef.current });
    });

    // Receive offer - create answer
    socket.on('offer', ({ from, offer, userName }) => {
      console.log('Received offer from:', from);
      const peer = addPeer(from, offer, localStream);
      peersRef.current[from] = { peer, userName };
      setPeers({ ...peersRef.current });
    });

    // Receive answer
    socket.on('answer', ({ from, answer }) => {
      console.log('Received answer from:', from);
      if (peersRef.current[from]) {
        peersRef.current[from].peer.signal(answer);
      }
    });

    // Handle ICE candidate
    socket.on('ice-candidate', ({ from, candidate }) => {
      if (peersRef.current[from]) {
        peersRef.current[from].peer.signal(candidate);
      }
    });

    // User left
    socket.on('user-left', ({ userId }) => {
      console.log('User left:', userId);
      if (peersRef.current[userId]) {
        peersRef.current[userId].peer.destroy();
        delete peersRef.current[userId];
        setPeers({ ...peersRef.current });
      }
    });

    return () => {
      Object.values(peersRef.current).forEach(({ peer }) => {
        if (peer) peer.destroy();
      });
      socket.off('existing-users');
      socket.off('user-joined');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('user-left');
    };
  }, [socket, localStream, roomId]);

  const createPeer = (userToSignal, callerId, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: true,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', signal => {
      socket.emit('offer', { userToSignal, callerId, signal });
    });

    peer.on('error', err => {
      console.error('Peer error:', err);
    });

    return peer;
  };

  const addPeer = (callerId, incomingSignal, stream) => {
    const peer = new Peer({
      initiator: false,
      trickle: true,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ]
      }
    });

    peer.on('signal', signal => {
      socket.emit('answer', { callerId, signal });
    });

    peer.on('error', err => {
      console.error('Peer error:', err);
    });

    peer.signal(incomingSignal);

    return peer;
  };

  return { peers };
};