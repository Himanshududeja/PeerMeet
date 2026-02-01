import { useEffect, useRef } from 'react';
import './VideoGrid.css';

const VideoTile = ({ stream, userName, isLocal, muted }) => {
  const videoRef = useRef();

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-tile">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="video-element"
      />
      <div className="video-overlay">
        <span className="video-name text-mono">
          {isLocal ? `${userName} (You)` : userName}
        </span>
      </div>
      {isLocal && <div className="local-indicator">LOCAL</div>}
    </div>
  );
};

const VideoGrid = ({ localStream, peers, localUserName }) => {
  const peerCount = Object.keys(peers).length;
  const totalVideos = peerCount + 1; // +1 for local stream

  const getGridClass = () => {
    if (totalVideos === 1) return 'grid-1';
    if (totalVideos === 2) return 'grid-2';
    if (totalVideos <= 4) return 'grid-4';
    if (totalVideos <= 6) return 'grid-6';
    return 'grid-many';
  };

  return (
    <div className={`video-grid ${getGridClass()}`}>
      {/* Local Video */}
      {localStream && (
        <VideoTile
          stream={localStream}
          userName={localUserName}
          isLocal={true}
          muted={true}
        />
      )}

      {/* Remote Videos */}
      {Object.entries(peers).map(([peerId, peerData]) => {
        // Access stream from peerData
        const stream = peerData.stream;
        const userName = peerData.userName || 'Anonymous';
        
        if (stream) {
          return (
            <VideoTile
              key={peerId}
              stream={stream}
              userName={userName}
              isLocal={false}
              muted={false}
            />
          );
        }
        return null;
      })}
    </div>
  );
};

export default VideoGrid;