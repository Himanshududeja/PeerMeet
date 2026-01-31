import { User, Mic, MicOff } from 'lucide-react';
import './ParticipantsList.css';

const ParticipantItem = ({ participant }) => {
  return (
    <div className="participant-item">
      <div className="participant-avatar">
        <User size={20} />
      </div>
      <div className="participant-info">
        <span className="participant-name">
          {participant.name}
          {participant.isLocal && <span className="local-badge text-mono">YOU</span>}
        </span>
      </div>
      <div className="participant-status">
        {participant.audioEnabled ? (
          <Mic size={16} className="text-primary" />
        ) : (
          <MicOff size={16} className="text-muted" />
        )}
      </div>
    </div>
  );
};

const ParticipantsList = ({ participants }) => {
  return (
    <div className="participants-list">
      {participants.map((participant) => (
        <ParticipantItem key={participant.id} participant={participant} />
      ))}
    </div>
  );
};

export default ParticipantsList;