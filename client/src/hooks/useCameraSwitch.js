import { useState, useCallback } from 'react';

export const useCameraSwitch = (stream, setStream) => {
  const [facingMode, setFacingMode] = useState('user'); // 'user' or 'environment'
  const [isSwitching, setIsSwitching] = useState(false);

  const switchCamera = useCallback(async () => {
    if (isSwitching) return;
    
    setIsSwitching(true);
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    
    try {
      // Stop current video track
      if (stream) {
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.stop();
        }
      }

      // Get new stream with switched camera
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newFacingMode,
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Keep existing audio track if it exists
      if (stream) {
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          newStream.removeTrack(newStream.getAudioTracks()[0]);
          newStream.addTrack(audioTrack);
        }
      }

      setStream(newStream);
      setFacingMode(newFacingMode);
      setIsSwitching(false);
      
      console.log(`✅ Camera switched to: ${newFacingMode}`);
      return newStream;
    } catch (error) {
      console.error('❌ Error switching camera:', error);
      setIsSwitching(false);
      return null;
    }
  }, [stream, facingMode, isSwitching, setStream]);

  return {
    switchCamera,
    facingMode,
    isSwitching
  };
};