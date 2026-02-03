import { useState, useEffect } from 'react';

export const useMediaStream = () => {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getMedia = async () => {
      try {
        // High-quality constraints
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 },
            frameRate: { min: 15, ideal: 30, max: 30 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
            channelCount: 1
          }
        });
        
        setStream(mediaStream);
        setLoading(false);
        console.log('✅ Media stream obtained:', {
          audio: mediaStream.getAudioTracks().length,
          video: mediaStream.getVideoTracks().length,
          videoSettings: mediaStream.getVideoTracks()[0]?.getSettings()
        });
      } catch (err) {
        console.error('❌ Media access error:', err);
        
        // Fallback for mobile or restrictive browsers
        try {
          console.log('⚠️ Trying fallback constraints...');
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { facingMode: 'user' }
          });
          setStream(fallbackStream);
          setLoading(false);
          console.log('✅ Media stream obtained with fallback');
        } catch (fallbackErr) {
          console.error('❌ Fallback failed:', fallbackErr);
          setError(fallbackErr.message);
          setLoading(false);
        }
      }
    };

    getMedia();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop();
          console.log(`🛑 Stopped ${track.kind} track`);
        });
      }
    };
  }, []);

  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  return {
    stream,
    error,
    audioEnabled,
    videoEnabled,
    loading,
    toggleAudio,
    toggleVideo
  };
};