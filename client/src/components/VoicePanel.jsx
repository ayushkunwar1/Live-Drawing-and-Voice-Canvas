import { useEffect, useRef } from 'react';

function RemoteAudio({ stream }) {
  const audioRef = useRef(null);
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch(() => {});
    }
  }, [stream]);
  return <audio ref={audioRef} autoPlay playsInline />;
}

export default function VoicePanel({ members, remoteStreams, voiceEnabled }) {
  if (!voiceEnabled && remoteStreams.size === 0) return null;
  return (
    <div className="voice-panel">
      <div className="voice-panel-title">Voice room</div>
      <div className="voice-avatars">
        {members.map((member) => (
          <div key={member.id} className="voice-person">
            <span className="avatar">{member.name.slice(0, 1).toUpperCase()}</span>
            <span>{member.name}</span>
            {remoteStreams.has(member.id) && <span className="speaking-dot" />}
          </div>
        ))}
      </div>
      {[...remoteStreams.entries()].map(([id, stream]) => <RemoteAudio key={id} stream={stream} />)}
    </div>
  );
}
