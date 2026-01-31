import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

const VideoGrid = ({ localStream, peers, localUserName }) => {
  const localVideoRef = useRef();

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const peerEntries = Object.entries(peers);

  return (
    <div className="video-grid">
      {/* Local Video */}
      <motion.div
        className="video-container local-video"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <video
          ref={localVideoRef}
          autoPlay
          muted
          className="video"
        />
        <div className="video-label">
          {localUserName} (You)
        </div>
      </motion.div>

      {/* Peer Videos */}
      {peerEntries.map(([peerId, peer], index) => (
        <motion.div
          key={peerId}
          className="video-container"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: (index + 1) * 0.1 }}
        >
          <PeerVideo peer={peer} peerId={peerId} />
        </motion.div>
      ))}
    </div>
  );
};

const PeerVideo = ({ peer, peerId }) => {
  const videoRef = useRef();

  useEffect(() => {
    if (peer && videoRef.current) {
      peer.on('stream', (stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });

      peer.on('error', (err) => {
        console.error('Peer video error:', err);
      });
    }

    return () => {
      if (peer) {
        peer.off('stream');
        peer.off('error');
      }
    };
  }, [peer]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        className="video"
      />
      <div className="video-label">
        Peer {peerId.slice(0, 4)}
      </div>
    </>
  );
};

export default VideoGrid;