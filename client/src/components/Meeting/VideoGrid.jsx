import { useEffect, useRef } from 'react';
import './VideoGrid.css';

const VideoTile = ({ stream, userName, isLocal, muted, isPinned, isScreenShare }) => {
  const videoRef = useRef();

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      
      // Force play and log status
      videoRef.current.play()
        .then(() => {
          console.log(`✅ Video playing for ${userName}:`, {
            isLocal,
            tracks: stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState }))
          });
        })
        .catch(err => {
          console.error(`❌ Error playing video for ${userName}:`, err);
        });
    }
  }, [stream, userName, isLocal]);

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
          {isScreenShare && ' - Screen'}
        </span>
      </div>
      {isLocal && <div className="local-indicator">LOCAL</div>}
      {isScreenShare && <div className="screen-share-indicator">📺 PRESENTING</div>}
    </div>
  );
};

const VideoGrid = ({ localStream, peers, localUserName, screenStream, isSharing }) => {
  const peerCount = Object.keys(peers || {}).length;
  const totalVideos = peerCount + 1;

  console.log('VideoGrid render:', {
    totalVideos,
    peerCount,
    hasLocalStream: !!localStream,
    hasScreenStream: !!screenStream,
    isSharing,
    peerIds: Object.keys(peers || {})
  });

  // Check if anyone is sharing screen
  const screenSharingPeer = Object.entries(peers || {}).find(([_, peerData]) => {
    if (!peerData.stream) return false;
    const videoTrack = peerData.stream.getVideoTracks()[0];
    return videoTrack?.label?.includes('screen') || videoTrack?.label?.includes('window');
  });

  const isAnyoneSharing = isSharing || screenSharingPeer;

  const getGridClass = () => {
    if (isAnyoneSharing) return 'grid-pinned';
    if (totalVideos === 1) return 'grid-1';
    if (totalVideos === 2) return 'grid-2';
    if (totalVideos === 3) return 'grid-3';
    if (totalVideos === 4) return 'grid-4';
    if (totalVideos === 5) return 'grid-5';
    if (totalVideos === 6) return 'grid-6';
    return 'grid-many';
  };

  const displayStream = screenStream || localStream;

  return (
    <div className={`video-grid ${getGridClass()}`}>
      {isAnyoneSharing ? (
        <>
          {/* Pinned Screen Share */}
          <div className="main-video-area">
            {isSharing ? (
              <VideoTile
                stream={screenStream}
                userName={localUserName}
                isLocal={true}
                muted={true}
                isPinned={true}
                isScreenShare={true}
              />
            ) : screenSharingPeer ? (
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

          {/* Thumbnail Strip */}
          <div className="thumbnail-strip">
            {!isSharing && localStream && (
              <VideoTile
                stream={localStream}
                userName={localUserName}
                isLocal={true}
                muted={true}
              />
            )}

            {Object.entries(peers || {}).map(([peerId, peerData]) => {
              if (screenSharingPeer && screenSharingPeer[0] === peerId) return null;
              if (!peerData.stream) return null;

              return (
                <VideoTile
                  key={peerId}
                  stream={peerData.stream}
                  userName={peerData.userName || 'Anonymous'}
                  isLocal={false}
                  muted={false}
                />
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Normal Grid */}
          {displayStream && (
            <VideoTile
              stream={displayStream}
              userName={localUserName}
              isLocal={true}
              muted={true}
            />
          )}

          {Object.entries(peers || {}).map(([peerId, peerData]) => {
            if (!peerData.stream) {
              console.warn(`⚠️ No stream for peer ${peerId}`);
              return null;
            }

            return (
              <VideoTile
                key={peerId}
                stream={peerData.stream}
                userName={peerData.userName || 'Anonymous'}
                isLocal={false}
                muted={false}
              />
            );
          })}
        </>
      )}
    </div>
  );
};

export default VideoGrid;