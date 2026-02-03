import { useState, useRef } from 'react';

export const useScreenShare = () => {
  const [isSharing, setIsSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const screenStreamRef = useRef(null);

  const startScreenShare = async () => {
    try {
      // Check if getDisplayMedia is supported
      if (!navigator.mediaDevices.getDisplayMedia) {
        console.error('❌ Screen sharing not supported on this device');
        alert('Screen sharing is not supported on this device');
        return null;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 30 }
        },
        audio: false // Mobile often doesn't support audio in screen share
      });

      console.log('✅ Screen share started:', {
        video: stream.getVideoTracks().length,
        audio: stream.getAudioTracks().length
      });

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsSharing(true);

      // Handle when user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        console.log('📺 Screen share stopped by user');
        stopScreenShare();
      };

      return stream;
    } catch (error) {
      console.error('❌ Error starting screen share:', error);
      if (error.name === 'NotAllowedError') {
        alert('Screen sharing permission denied');
      } else if (error.name === 'NotSupportedError') {
        alert('Screen sharing is not supported on this device');
      }
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