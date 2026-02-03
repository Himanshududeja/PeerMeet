import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, MonitorOff, SwitchCamera } from 'lucide-react';
import './MediaControls.css';

const MediaControls = ({
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  onLeave,
  isScreenSharing,
  onToggleScreenShare,
  onSwitchCamera,
  showCameraSwitch = true
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

      {showCameraSwitch && onSwitchCamera && (
        <button
          className="control-btn"
          onClick={onSwitchCamera}
          title="Switch Camera"
        >
          <SwitchCamera size={24} strokeWidth={2.5} />
          <span className="control-label text-mono">FLIP</span>
        </button>
      )}

      <button
        className={`control-btn ${isScreenSharing ? 'active' : ''}`}
        onClick={onToggleScreenShare}
        title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
      >
        {isScreenSharing ? (
          <MonitorOff size={24} strokeWidth={2.5} />
        ) : (
          <Monitor size={24} strokeWidth={2.5} />
        )}
        <span className="control-label text-mono">
          {isScreenSharing ? 'STOP SHARE' : 'SHARE'}
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