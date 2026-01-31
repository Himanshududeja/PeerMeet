import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { Video, Users, MessageSquare, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');

  const createRoom = () => {
    const newRoomId = nanoid(10);
    if (userName.trim()) {
      navigate(`/room/${newRoomId}`, { state: { userName } });
    }
  };

  const joinRoom = () => {
    if (roomId.trim() && userName.trim()) {
      navigate(`/room/${roomId}`, { state: { userName } });
    }
  };

  const features = [
    { icon: Video, text: 'HD Video & Audio', color: 'var(--color-primary)' },
    { icon: MessageSquare, text: 'Real-time Chat', color: 'var(--color-secondary)' },
    { icon: Users, text: 'Multi-participant', color: 'var(--color-accent)' },
    { icon: Zap, text: 'Instant Connect', color: 'var(--color-primary)' }
  ];

  return (
    <div className="home">

      <div className="home-container">
        {/* Hero Section */}
        <motion.div
          className="hero"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="brand">
            <div className="brand-icon">
              <Video size={48} strokeWidth={3} />
            </div>
            <h1 className="brand-title">
              <span className="text-primary">PEER</span>
              <span className="text-secondary">MEET</span>
            </h1>
          </div>

          <p className="tagline">
            Face-to-face connections in milliseconds
          </p>

          {/* Feature Grid */}
          <div className="features-grid">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="feature-card"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
              >
                <feature.icon
                  size={24}
                  strokeWidth={2.5}
                  style={{ color: feature.color }}
                />
                <span>{feature.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Main Action Area */}
        <motion.div
          className="action-area"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className="input-group">
            <label className="input-label">
              <span>&gt;_</span> Your Name
            </label>
            <input
              type="text"
              className="input"
              placeholder="Enter your name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && createRoom()}
            />
          </div>

          <button
            className="btn btn-primary btn-large"
            onClick={createRoom}
            disabled={!userName.trim()}
          >
            <span>Create New Meeting</span>
            <span>→</span>
          </button>

          <div className="divider">
            <span>OR</span>
          </div>

          <div className="input-group">
            <label className="input-label">
              <span>&gt;_</span> Room ID
            </label>
            <input
              type="text"
              className="input"
              placeholder="Enter room code"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
            />
          </div>

          <button
            className="btn btn-join"
            onClick={joinRoom}
            disabled={!roomId.trim() || !userName.trim()}
          >
            <span>Join Meeting</span>
            <span>→</span>
          </button>
        </motion.div>

        {/* Footer */}
        <motion.footer
          className="footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <p className="text-mono">
            Built with WebRTC + Socket.io
          </p>
          <div className="status-indicator">
            <span className="status-dot"></span>
            <span className="text-mono">System Online</span>
          </div>
        </motion.footer>
      </div>
    </div>
  );
};

export default Home;