import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'live-drawing-voice-canvas' }));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  path: '/api/socket-io/socket.io',
  cors: { origin: true, credentials: true },
  transports: ['polling', 'websocket'],
});

const rooms = new Map();
const getRoom = (roomId) => {
  if (!rooms.has(roomId)) rooms.set(roomId, { actions: [], members: new Map() });
  return rooms.get(roomId);
};
const cleanRoom = (value) => String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
const cleanName = (value) => (String(value || 'Guest').trim().replace(/\s+/g, ' ').slice(0, 32) || 'Guest');
const broadcastMembers = (roomId) => {
  const room = rooms.get(roomId);
  if (room) io.to(roomId).emit('members-updated', [...room.members].map(([id, member]) => ({ id, ...member })));
};

io.on('connection', (socket) => {
  socket.on('room:join', ({ roomId: rawRoomId, name: rawName }) => {
    const roomId = cleanRoom(rawRoomId);
    const name = cleanName(rawName);
    if (!roomId) return socket.emit('room:error', { message: 'A valid room ID is required.' });
    const room = getRoom(roomId);
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = name;
    room.members.set(socket.id, { name, joinedAt: Date.now() });
    socket.emit('room:state', { roomId, actions: room.actions, members: [...room.members].map(([id, member]) => ({ id, ...member })) });
    socket.to(roomId).emit('room:user-joined', { id: socket.id, name });
    broadcastMembers(roomId);
  });

  socket.on('board:action', (action) => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room || !action?.id || !action?.type || JSON.stringify(action).length > 100000) return;
    room.actions.push(action);
    socket.to(roomId).emit('board:action', action);
  });
  socket.on('board:stroke-point', ({ strokeId, point }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || !strokeId || !point) return;
    const action = room.actions.find((item) => item.id === strokeId && item.type === 'stroke');
    if (!action || action.points.length >= 3000) return;
    action.points.push(point);
    socket.to(socket.data.roomId).emit('board:stroke-point', { strokeId, point });
  });
  socket.on('board:clear', () => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    room.actions = [];
    io.to(socket.data.roomId).emit('board:cleared');
  });

  socket.on('webrtc:offer', ({ to, offer } = {}) => {
    if (to && offer) io.to(to).emit('webrtc:offer', { from: socket.id, offer });
  });
  socket.on('webrtc:answer', ({ to, answer } = {}) => {
    if (to && answer) io.to(to).emit('webrtc:answer', { from: socket.id, answer });
  });
  socket.on('webrtc:ice-candidate', ({ to, candidate } = {}) => {
    if (to && candidate) io.to(to).emit('webrtc:ice-candidate', { from: socket.id, candidate });
  });
  socket.on('voice:ready', () => socket.data.roomId && socket.to(socket.data.roomId).emit('voice:peer-ready', { id: socket.id }));
  socket.on('voice:stopped', () => socket.data.roomId && socket.to(socket.data.roomId).emit('voice:peer-stopped', { id: socket.id }));

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    room.members.delete(socket.id);
    socket.to(roomId).emit('room:user-left', { id: socket.id });
    broadcastMembers(roomId);
    if (!room.members.size) rooms.delete(roomId);
  });
});

export default httpServer;
