import { useEffect, useRef } from 'react';
import './VideoGrid.css';

const VideoTile = ({ stream, userName, isLocal, muted, isPinned, isScreenShare }) => {
  const videoRef = useRef();

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      
      // Force play on mobile
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err);
      });
    }
  }, [stream]);

  return (
    <div className={`video-tile ${isPinned ? 'pinned' : ''} ${isScreenShare ? 'screen-share' : ''}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="video-element"
        webkit-playsinline="true"
        x5-playsinline="true"
        x5-video-player-type="h5"
        x5-video-player-fullscreen="false"
      />
      <div className="video-overlay">
        <span className="video-name text-mono">
          {isLocal ? `${userName} (You)` : userName}
          {isScreenShare && ' - Screen Share'}
        </span>
      </div>
      {isLocal && <div className="local-indicator">LOCAL</div>}
      {isScreenShare && <div className="screen-share-indicator">📺 PRESENTING</div>}
    </div>
  );
};

const VideoGrid = ({ localStream, peers, localUserName, screenStream, isSharing }) => {
  const peerCount = Object.keys(peers).length;
  const totalVideos = peerCount + 1;

  // Check if anyone is sharing screen
  const screenSharingPeer = Object.entries(peers).find(([_, peerData]) => {
    // Check if this peer's stream has screen share characteristics
    const videoTrack = peerData.stream?.getVideoTracks()[0];
    return videoTrack?.label?.includes('screen') || videoTrack?.label?.includes('window');
  });

  const isAnyoneSharing = isSharing || screenSharingPeer;

  const getGridClass = () => {
    // If someone is sharing screen, use pinned layout
    if (isAnyoneSharing) {
      return 'grid-pinned';
    }

    // Normal grid layouts
    if (totalVideos === 1) return 'grid-1';
    if (totalVideos === 2) return 'grid-2';
    if (totalVideos === 3) return 'grid-3';
    if (totalVideos === 4) return 'grid-4';
    if (totalVideos === 5) return 'grid-5';
    if (totalVideos === 6) return 'grid-6';
    return 'grid-many';
  };

  // Show screen stream if local user is sharing, otherwise show camera
  const displayStream = screenStream || localStream;

  return (
    <div className={`video-grid ${getGridClass()}`}>
      {/* Main/Pinned Video Area */}
      {isAnyoneSharing ? (
        <>
          {/* Pinned Screen Share */}
          <div className="main-video-area">
            {isSharing ? (
              // Local screen share
              <VideoTile
                stream={screenStream}
                userName={localUserName}
                isLocal={true}
                muted={true}
                isPinned={true}
                isScreenShare={true}
              />
            ) : screenSharingPeer ? (
              // Remote screen share
              <VideoTile
                stream={screenSharingPeer[1].stream}
                userName={screenSharingPeer[1].userName}
                isLocal={false}
                muted={false}
                isPinned={true}
                isScreenShare={true}
              />
            ) : null}
          </div>

          {/* Thumbnail Strip (Other Participants) */}
          <div className="thumbnail-strip">
            {/* Local camera (if not screen sharing) or local screen (if screen sharing) */}
            {!isSharing && localStream && (
              <VideoTile
                stream={localStream}
                userName={localUserName}
                isLocal={true}
                muted={true}
                isPinned={false}
              />
            )}

            {/* Remote participants */}
            {Object.entries(peers).map(([peerId, peerData]) => {
              // Skip the peer who is screen sharing (already shown as pinned)
              if (screenSharingPeer && screenSharingPeer[0] === peerId) {
                return null;
              }

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
                    isPinned={false}
                  />
                );
              }
              return null;
            })}
          </div>
        </>
      ) : (
        <>
          {/* Normal Grid Layout (No Screen Sharing) */}
          {displayStream && (
            <VideoTile
              stream={displayStream}
              userName={localUserName}
              isLocal={true}
              muted={true}
            />
          )}

          {Object.entries(peers).map(([peerId, peerData]) => {
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
        </>
      )}
    </div>
  );
};

export default VideoGrid;