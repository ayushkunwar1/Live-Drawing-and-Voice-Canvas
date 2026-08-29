import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'live-drawing-voice-canvas' }));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, credentials: true },
  transports: ['websocket', 'polling'],
});

// In-memory room state. Replace with Redis/database persistence for production.
const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      actions: [],
      members: new Map(),
    });
  }
  return rooms.get(roomId);
}

function sanitizeRoomId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);
}

function sanitizeName(value) {
  const name = String(value || 'Guest').trim().replace(/\s+/g, ' ');
  return name.slice(0, 32) || 'Guest';
}

function broadcastMembers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  io.to(roomId).emit('members-updated', [...room.members].map(([id, member]) => ({ id, ...member })));
}

io.on('connection', (socket) => {
  socket.on('room:join', ({ roomId: rawRoomId, name: rawName }) => {
    const roomId = sanitizeRoomId(rawRoomId);
    const name = sanitizeName(rawName);
    if (!roomId) return socket.emit('room:error', { message: 'A valid room ID is required.' });

    const room = getRoom(roomId);
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = name;
    room.members.set(socket.id, { name, joinedAt: Date.now() });

    socket.emit('room:state', {
      roomId,
      actions: room.actions,
      members: [...room.members].map(([id, member]) => ({ id, ...member })),
    });

    socket.to(roomId).emit('room:user-joined', { id: socket.id, name });
    broadcastMembers(roomId);
  });

  socket.on('board:action', (action) => {
    const roomId = socket.data.roomId;
    if (!roomId || !action?.id || !action?.type) return;
    const room = rooms.get(roomId);
    if (!room) return;

    // Size guard for malformed client messages.
    const serialized = JSON.stringify(action);
    if (serialized.length > 100_000) return;

    room.actions.push(action);
    // Broadcast to everyone except the sender; sender already rendered locally.
    socket.to(roomId).emit('board:action', action);
  });

  socket.on('board:stroke-point', ({ strokeId, point }) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room || !strokeId || !point) return;
    const action = room.actions.find((item) => item.id === strokeId && item.type === 'stroke');
    if (!action) return;
    if (action.points.length >= 3000) return;
    action.points.push(point);
    socket.to(roomId).emit('board:stroke-point', { strokeId, point });
  });

  socket.on('board:clear', () => {
    const roomId = socket.data.roomId;
    if (!rooms.has(roomId)) return;
    rooms.get(roomId).actions = [];
    io.to(roomId).emit('board:cleared');
  });

  // WebRTC signaling is intentionally payload-agnostic; Socket.IO just routes messages.
  socket.on('webrtc:offer', ({ to, offer }) => {
    if (to && offer) io.to(to).emit('webrtc:offer', { from: socket.id, offer });
  });

  socket.on('webrtc:answer', ({ to, answer }) => {
    if (to && answer) io.to(to).emit('webrtc:answer', { from: socket.id, answer });
  });

  socket.on('webrtc:ice-candidate', ({ to, candidate }) => {
    if (to && candidate) io.to(to).emit('webrtc:ice-candidate', { from: socket.id, candidate });
  });

  socket.on('voice:ready', () => {
    const roomId = socket.data.roomId;
    if (roomId) socket.to(roomId).emit('voice:peer-ready', { id: socket.id });
  });

  socket.on('voice:stopped', () => {
    const roomId = socket.data.roomId;
    if (roomId) socket.to(roomId).emit('voice:peer-stopped', { id: socket.id });
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    room.members.delete(socket.id);
    socket.to(roomId).emit('room:user-left', { id: socket.id });
    broadcastMembers(roomId);

    if (room.members.size === 0) rooms.delete(roomId);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Live Drawing server listening on http://localhost:${PORT}`);
});
