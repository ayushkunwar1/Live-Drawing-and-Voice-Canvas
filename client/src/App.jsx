import { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import CanvasBoard from './components/CanvasBoard.jsx';
import Toolbar from './components/Toolbar.jsx';
import VoicePanel from './components/VoicePanel.jsx';
import { useRoomSocket } from './hooks/useRoomSocket.js';
import { useWebRTC } from './hooks/useWebRTC.js';

function makeRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function ExportMenu({ onPng, onPdf }) {
  return (
    <div className="export-menu">
      <button onClick={onPng}>PNG image</button>
      <button onClick={onPdf}>PDF document</button>
    </div>
  );
}

function RoomSetup({ onEnter }) {
  const params = new URLSearchParams(window.location.search);
  const [name, setName] = useState('Guest');
  const [roomId, setRoomId] = useState(params.get('room') || makeRoomId());

  const submit = (event) => {
    event.preventDefault();
    const cleanRoom = roomId.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!cleanRoom) return;
    const cleanName = name.trim().replace(/\s+/g, ' ').slice(0, 32) || 'Guest';
    window.history.replaceState({}, '', `?room=${encodeURIComponent(cleanRoom)}`);
    onEnter({ roomId: cleanRoom, name: cleanName });
  };

  return (
    <main className="setup-screen">
      <div className="setup-card">
        <div className="setup-icon">✦</div>
        <p className="eyebrow">REAL-TIME BRAINSTORMING</p>
        <h1>Live Drawing &amp;<br />Voice Canvas</h1>
        <p className="setup-copy">Sketch ideas, drop notes, and talk with your team in one shared room.</p>
        <form onSubmit={submit} className="setup-form">
          <label>
            Your name
            <input value={name} maxLength={32} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ayush" />
          </label>
          <label>
            Room ID
            <div className="room-input-row">
              <input value={roomId} maxLength={64} onChange={(event) => setRoomId(event.target.value.toUpperCase())} />
              <button type="button" className="generate-room" onClick={() => setRoomId(makeRoomId())}>New</button>
            </div>
          </label>
          <button className="enter-button" type="submit">Enter shared room →</button>
        </form>
        <div className="setup-foot">No account required · WebRTC voice · Socket.IO sync</div>
      </div>
    </main>
  );
}

function Workspace({ roomId, name, onLeave }) {
  const { socket, actions, members, status, error, beginAction, appendStrokePoint, clearBoard } = useRoomSocket(roomId, name);
  const { voiceEnabled, toggleVoice, remoteStreams } = useWebRTC(socket, members);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#0f172a');
  const [size, setSize] = useState(4);
  const [exportOpen, setExportOpen] = useState(false);

  const self = useMemo(() => members.find((member) => member.id === socket?.id), [members, socket]);

  const getCanvas = () => document.querySelector('.board-canvas');
  const exportPng = () => {
    const canvas = getCanvas();
    if (!canvas) return;
    const anchor = document.createElement('a');
    anchor.href = canvas.toDataURL('image/png');
    anchor.download = `live-canvas-${roomId}.png`;
    anchor.click();
    setExportOpen(false);
  };

  const exportPdf = () => {
    const canvas = getCanvas();
    if (!canvas) return;
    const img = canvas.toDataURL('image/png');
    const landscape = canvas.width >= canvas.height;
    const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    const pageW = landscape ? 297 : 210;
    const pageH = landscape ? 210 : 297;
    const margin = 8;
    const ratio = canvas.width / canvas.height;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    doc.addImage(img, 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h, undefined, 'FAST');
    doc.save(`live-canvas-${roomId}.pdf`);
    setExportOpen(false);
  };

  return (
    <main className="workspace">
      <header className="topbar">
        <Toolbar
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          size={size}
          setSize={setSize}
          onClear={() => {
            if (window.confirm('Clear the shared canvas for everyone?')) clearBoard();
          }}
          onExport={() => setExportOpen((value) => !value)}
          voiceEnabled={voiceEnabled}
          onToggleVoice={() => toggleVoice().catch(() => window.alert('Microphone permission is required for voice chat.'))}
          status={status}
          memberCount={members.length}
        />
        {exportOpen && <ExportMenu onPng={exportPng} onPdf={exportPdf} />}
      </header>

      <div className="workspace-body">
        <aside className="sidebar">
          <div className="room-card">
            <div className="eyebrow">ROOM</div>
            <div className="room-code">{roomId}</div>
            <button className="copy-button" onClick={() => navigator.clipboard?.writeText(window.location.href)}>Copy room link</button>
          </div>
          <div className="members-card">
            <div className="section-heading"><span>People</span><span>{members.length}</span></div>
            <div className="member-list">
              {members.map((member) => (
                <div className="member-row" key={member.id}>
                  <span className="avatar">{member.name.slice(0, 1).toUpperCase()}</span>
                  <div className="member-info">
                    <span>{member.name}{member.id === socket?.id ? ' (you)' : ''}</span>
                    <small>{member.id === socket?.id ? 'Editing' : 'Collaborating'}</small>
                  </div>
                  {member.id === socket?.id && <span className="self-dot" />}
                </div>
              ))}
            </div>
          </div>
          <div className="hint-card">
            <strong>Tip</strong>
            <p>Use the Text tool for sticky-note-style ideas. Everyone sees new strokes and notes instantly.</p>
          </div>
          <button className="leave-button" onClick={onLeave}>Leave room</button>
          <div className="footer-status"><span className={`status-dot ${status === 'connected' ? 'online' : ''}`} /> {status}</div>
          {self && <div className="hidden-self">{self.name}</div>}
        </aside>

        <div className="canvas-wrap">
          {error && <div className="error-banner">{error}</div>}
          <CanvasBoard actions={actions} tool={tool} color={color} size={size} onAction={beginAction} onStrokePoint={appendStrokePoint} onText={beginAction} />
          <VoicePanel members={members} remoteStreams={remoteStreams} voiceEnabled={voiceEnabled} />
          <div className="canvas-footer">Everything on this board is synchronized within room <b>{roomId}</b>.</div>
        </div>
      </div>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  if (!session) return <RoomSetup onEnter={setSession} />;
  return <Workspace {...session} onLeave={() => setSession(null)} />;
}
