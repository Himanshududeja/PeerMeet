import { useState, useRef } from 'react';

export const useScreenShare = () => {
  const [isSharing, setIsSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const screenStreamRef = useRef(null);

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor', // Can be 'monitor', 'window', or 'browser'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsSharing(true);

      // Handle when user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      return stream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      setIsSharing(false);
      return null;
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
      setIsSharing(false);
    }
  };

  return {
    isSharing,
    screenStream,
    startScreenShare,
    stopScreenShare
  };
};