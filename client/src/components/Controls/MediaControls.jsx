import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import './MediaControls.css';

const MediaControls = ({
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  onLeave
}) => {
  return (
    <div className="media-controls">
      <button
        className={`control-btn ${!audioEnabled ? 'disabled' : ''}`}
        onClick={onToggleAudio}
        title={audioEnabled ? 'Mute' : 'Unmute'}
      >
        {audioEnabled ? (
          <Mic size={24} strokeWidth={2.5} />
        ) : (
          <MicOff size={24} strokeWidth={2.5} />
        )}
        <span className="control-label text-mono">
          {audioEnabled ? 'MUTE' : 'UNMUTED'}
        </span>
      </button>

      <button
        className={`control-btn ${!videoEnabled ? 'disabled' : ''}`}
        onClick={onToggleVideo}
        title={videoEnabled ? 'Stop Video' : 'Start Video'}
      >
        {videoEnabled ? (
          <Video size={24} strokeWidth={2.5} />
        ) : (
          <VideoOff size={24} strokeWidth={2.5} />
        )}
        <span className="control-label text-mono">
          {videoEnabled ? 'CAMERA' : 'NO CAM'}
        </span>
      </button>

      <button
        className="control-btn leave-btn"
        onClick={onLeave}
        title="Leave Meeting"
      >
        <PhoneOff size={24} strokeWidth={2.5} />
        <span className="control-label text-mono">LEAVE</span>
      </button>
    </div>
  );
};

export default MediaControls;