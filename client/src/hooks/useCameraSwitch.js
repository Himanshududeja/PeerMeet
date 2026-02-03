import { useState } from 'react';

export const useCameraSwitch = (stream, setStream, peers, socket) => {
  const [facingMode, setFacingMode] = useState('user');
  const [isSwitching, setIsSwitching] = useState(false);

  const switchCamera = async () => {
    if (!stream || isSwitching) return;

    try {
      setIsSwitching(true);
      const newFacingMode = facingMode === 'user' ? 'environment' : 'user';

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
        audio: true
      });

      // Stop old video tracks
      stream.getVideoTracks().forEach(track => track.stop());

      // Replace tracks in peer connections
      const newVideoTrack = newStream.getVideoTracks()[0];

      Object.values(peers).forEach(peerData => {
        if (peerData.peer) {
          const senders = peerData.peer.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(newVideoTrack);
          }
        }
      });

      setStream(newStream);
      setFacingMode(newFacingMode);
      setIsSwitching(false);

      return newStream;
    } catch (error) {
      console.error('❌ Error switching camera:', error);
      setIsSwitching(false);
      return null;
    }
  };

  return { switchCamera, facingMode, isSwitching };
};