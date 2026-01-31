import { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useMediaStream } from '../hooks/useMediaStream';
import { useWebRTC } from '../hooks/useWebRTC';
import { useChat } from '../hooks/useChat';
import { useSound } from '../hooks/useSound';
import VideoGrid from '../components/Meeting/VideoGrid';
import MediaControls from '../components/Controls/MediaControls';
import ChatPanel from '../components/Chat/ChatPanel';
import ParticipantsList from '../components/Participants/ParticipantsList';
import { Copy, Users, MessageSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './Room.css';

const Room = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { socket, connected } = useSocket();

  const userName = location.state?.userName || 'Anonymous';

  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [copied, setCopied] = useState(false);
  const [participants, setParticipants] = useState([]);

  const { stream, audioEnabled, videoEnabled, toggleAudio, toggleVideo } = useMediaStream();
  const { peers } = useWebRTC(roomId, socket, stream);

  const { playJoinSound, playPeerJoinSound, playLeaveSound, playMessageSound } = useSound();
  // Pass playMessageSound (or handle internally in useChat, but passing is safer if useChat shouldn't know about UI sounds, though here I will pass it if I modify useChat, OR I can just listen to messages here too? No, useChat has the listener. I will update useChat next. For now, just integrate others).

  const { messages, sendMessage } = useChat(socket, roomId, playMessageSound);

  useEffect(() => {
    if (!socket || !connected) return;

    // Join room
    socket.emit('join-room', { roomId, userName });
    playJoinSound();

    // Handle participants updates
    socket.on('participants-update', (participantsList) => {
      setParticipants(participantsList);
    });

    // Listen for new users specifically for sound effect
    socket.on('user-joined', () => {
      playPeerJoinSound();
    });

    return () => {
      socket.emit('leave-room', roomId);
      socket.off('participants-update');
      socket.off('user-joined');
    };
  }, [socket, connected, roomId, userName]);

  const copyRoomLink = () => {
    const link = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const leaveRoom = () => {
    playLeaveSound();
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    navigate('/');
  };

  const totalParticipants = Object.keys(peers).length + 1; // +1 for local user

  return (
    <div className="room">
      {/* Header */}
      <header className="room-header">
        <div className="room-info">
          <div className="room-id-container">
            <span className="text-mono room-label">ROOM:</span>
            <code className="room-id">{roomId}</code>
            <button
              className="btn-icon"
              onClick={copyRoomLink}
              title="Copy room link"
            >
              {copied ? (
                <span className="text-primary text-mono">✓</span>
              ) : (
                <Copy size={18} />
              )}
            </button>
          </div>
          <div className="participant-count">
            <Users size={18} />
            <span className="text-mono">{totalParticipants}</span>
          </div>
        </div>

        <div className="room-actions">
          <button
            className={`btn-icon ${showParticipants ? 'active' : ''}`}
            onClick={() => {
              setShowParticipants(!showParticipants);
              setShowChat(false);
            }}
            title="Participants"
          >
            <Users size={20} />
          </button>

          <button
            className={`btn-icon ${showChat ? 'active' : ''}`}
            onClick={() => {
              setShowChat(!showChat);
              setShowParticipants(false);
            }}
            title="Chat"
          >
            <MessageSquare size={20} />
            {messages.length > 0 && !showChat && (
              <span className="notification-badge">{messages.length}</span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="room-content">
        {/* Video Grid */}
        <div className="video-section">
          <VideoGrid
            localStream={stream}
            peers={peers}
            localUserName={userName}
          />
        </div>

        {/* Side Panels */}
        <AnimatePresence>
          {showChat && (
            <motion.div
              className="side-panel"
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <div className="panel-header">
                <h3 className="text-mono">CHAT</h3>
                <button
                  className="btn-icon"
                  onClick={() => setShowChat(false)}
                >
                  <X size={20} />
                </button>
              </div>
              <ChatPanel
                messages={messages}
                onSendMessage={sendMessage}
                currentUserId={socket?.id}
              />
            </motion.div>
          )}

          {showParticipants && (
            <motion.div
              className="side-panel"
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <div className="panel-header">
                <h3 className="text-mono">PARTICIPANTS ({totalParticipants})</h3>
                <button
                  className="btn-icon"
                  onClick={() => setShowParticipants(false)}
                >
                  <X size={20} />
                </button>
              </div>
              <ParticipantsList
                participants={[
                  { id: socket?.id, name: userName, isLocal: true },
                  ...participants
                ]}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="room-controls">
        <MediaControls
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onLeave={leaveRoom}
        />
      </div>
    </div>
  );
};

export default Room;