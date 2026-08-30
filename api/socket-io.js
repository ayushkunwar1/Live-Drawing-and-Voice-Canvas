import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'live-drawing-voice-canvas',
  });
});

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  path: '/api/socket-io/socket.io',

  cors: {
    origin: true,
    credentials: true,
  },

  transports: ['websocket'],

  allowEIO3: true,
});


// ==========================================
// ROOM STORAGE
// ==========================================

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


// ==========================================
// HELPERS
// ==========================================

function cleanRoom(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);
}

function cleanName(value) {
  return (
    String(value || 'Guest')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 32) || 'Guest'
  );
}

function getMembers(room) {
  return [...room.members].map(
    ([id, member]) => ({
      id,
      ...member,
    })
  );
}

function broadcastMembers(roomId) {
  const room = rooms.get(roomId);

  if (!room) {
    return;
  }

  io.to(roomId).emit(
    'members-updated',
    getMembers(room)
  );
}


// ==========================================
// CONNECTION
// ==========================================

io.on('connection', (socket) => {

  console.log(
    'Socket connected:',
    socket.id
  );


  // ========================================
  // JOIN ROOM
  // ========================================

  socket.on(
    'room:join',
    ({ roomId: rawRoomId, name: rawName } = {}) => {

      const roomId = cleanRoom(rawRoomId);

      const name = cleanName(rawName);


      if (!roomId) {

        socket.emit(
          'room:error',
          {
            message:
              'A valid room ID is required.',
          }
        );

        return;
      }


      const room = getRoom(roomId);


      socket.join(roomId);

      socket.data.roomId = roomId;

      socket.data.name = name;


      room.members.set(
        socket.id,
        {
          name,
          joinedAt: Date.now(),
        }
      );


      // Send current state to joining user

      socket.emit(
        'room:state',
        {
          roomId,
          actions: room.actions,
          members: getMembers(room),
        }
      );


      // Tell everyone else

      socket
        .to(roomId)
        .emit(
          'room:user-joined',
          {
            id: socket.id,
            name,
          }
        );


      broadcastMembers(roomId);


      console.log(
        `User ${name} joined room ${roomId}`
      );
    }
  );


  // ========================================
  // BOARD ACTION
  // ========================================

  socket.on(
    'board:action',
    (action) => {

      const roomId =
        socket.data.roomId;

      const room =
        rooms.get(roomId);


      if (
        !room ||
        !action?.id ||
        !action?.type
      ) {
        return;
      }


      if (
        JSON.stringify(action).length >
        100000
      ) {
        return;
      }


      room.actions.push(action);


      socket
        .to(roomId)
        .emit(
          'board:action',
          action
        );
    }
  );


  // ========================================
  // STROKE POINT
  // ========================================

  socket.on(
    'board:stroke-point',
    ({ strokeId, point } = {}) => {

      const room =
        rooms.get(
          socket.data.roomId
        );


      if (
        !room ||
        !strokeId ||
        !point
      ) {
        return;
      }


      const action =
        room.actions.find(
          (item) =>
            item.id === strokeId &&
            item.type === 'stroke'
        );


      if (
        !action ||
        !Array.isArray(action.points)
      ) {
        return;
      }


      if (
        action.points.length >= 3000
      ) {
        return;
      }


      action.points.push(point);


      socket
        .to(socket.data.roomId)
        .emit(
          'board:stroke-point',
          {
            strokeId,
            point,
          }
        );
    }
  );


  // ========================================
  // CLEAR BOARD
  // ========================================

  socket.on(
    'board:clear',
    () => {

      const room =
        rooms.get(
          socket.data.roomId
        );


      if (!room) {
        return;
      }


      room.actions = [];


      io.to(
        socket.data.roomId
      ).emit(
        'board:cleared'
      );
    }
  );


  // ========================================
  // WEBRTC OFFER
  // ========================================

  socket.on(
    'webrtc:offer',
    ({ to, offer } = {}) => {

      if (!to || !offer) {
        return;
      }


      io.to(to).emit(
        'webrtc:offer',
        {
          from: socket.id,
          offer,
        }
      );
    }
  );


  // ========================================
  // WEBRTC ANSWER
  // ========================================

  socket.on(
    'webrtc:answer',
    ({ to, answer } = {}) => {

      if (!to || !answer) {
        return;
      }


      io.to(to).emit(
        'webrtc:answer',
        {
          from: socket.id,
          answer,
        }
      );
    }
  );


  // ========================================
  // ICE CANDIDATE
  // ========================================

  socket.on(
    'webrtc:ice-candidate',
    ({ to, candidate } = {}) => {

      if (!to || !candidate) {
        return;
      }


      io.to(to).emit(
        'webrtc:ice-candidate',
        {
          from: socket.id,
          candidate,
        }
      );
    }
  );


  // ========================================
  // VOICE READY
  // ========================================

  socket.on(
    'voice:ready',
    () => {

      const roomId =
        socket.data.roomId;


      if (!roomId) {
        return;
      }


      socket
        .to(roomId)
        .emit(
          'voice:peer-ready',
          {
            id: socket.id,
          }
        );
    }
  );


  // ========================================
  // VOICE STOPPED
  // ========================================

  socket.on(
    'voice:stopped',
    () => {

      const roomId =
        socket.data.roomId;


      if (!roomId) {
        return;
      }


      socket
        .to(roomId)
        .emit(
          'voice:peer-stopped',
          {
            id: socket.id,
          }
        );
    }
  );


  // ========================================
  // DISCONNECT
  // ========================================

  socket.on(
    'disconnect',
    (reason) => {

      console.log(
        'Socket disconnected:',
        socket.id,
        reason
      );


      const roomId =
        socket.data.roomId;


      if (!roomId) {
        return;
      }


      const room =
        rooms.get(roomId);


      if (!room) {
        return;
      }


      room.members.delete(
        socket.id
      );


      socket
        .to(roomId)
        .emit(
          'room:user-left',
          {
            id: socket.id,
          }
        );


      broadcastMembers(
        roomId
      );


      if (
        room.members.size === 0
      ) {
        rooms.delete(roomId);
      }
    }
  );
});


// ==========================================
// VERCEL EXPORT
// ==========================================

export default httpServer;
