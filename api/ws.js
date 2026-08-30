import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const app = express();

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'live-drawing-voice-canvas',
  });
});

const server = createServer(app);

const wss = new WebSocketServer({
  server,
});

const rooms = new Map();

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

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      actions: [],
      clients: new Map(),
    });
  }

  return rooms.get(roomId);
}

function send(ws, message) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(message));
  }
}

function broadcast(room, message, except = null) {
  for (const client of room.clients.values()) {
    if (client.ws !== except) {
      send(client.ws, message);
    }
  }
}

function getMembers(room) {
  return [...room.clients.entries()].map(
    ([id, client]) => ({
      id,
      name: client.name,
    })
  );
}

function broadcastMembers(room) {
  broadcast(room, {
    type: 'members',
    members: getMembers(room),
  });
}

wss.on('connection', (ws) => {
  const id =
    Math.random().toString(36).slice(2) +
    Date.now().toString(36);

  let roomId = null;

  ws.on('message', (raw) => {
    let message;

    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (message.type) {

      case 'join': {
        roomId = cleanRoom(message.roomId);
        const name = cleanName(message.name);

        if (!roomId) {
          send(ws, {
            type: 'error',
            message: 'Invalid room ID.',
          });
          return;
        }

        const room = getRoom(roomId);

        room.clients.set(id, {
          ws,
          name,
        });

        send(ws, {
          type: 'state',
          roomId,
          actions: room.actions,
          members: getMembers(room),
          selfId: id,
        });

        broadcast(
          room,
          {
            type: 'member-joined',
            member: {
              id,
              name,
            },
          },
          ws
        );

        broadcastMembers(room);

        break;
      }

      case 'action': {
        if (!roomId) return;

        const room = rooms.get(roomId);

        if (!room || !message.action) {
          return;
        }

        const action = message.action;

        if (
          !action.id ||
          !action.type ||
          JSON.stringify(action).length > 100000
        ) {
          return;
        }

        room.actions.push(action);

        broadcast(
          room,
          {
            type: 'action',
            action,
          },
          ws
        );

        break;
      }

      case 'stroke-point': {
        if (!roomId) return;

        const room = rooms.get(roomId);

        if (!room) return;

        const action = room.actions.find(
          (item) =>
            item.id === message.strokeId &&
            item.type === 'stroke'
        );

        if (!action) return;

        if (!Array.isArray(action.points)) {
          action.points = [];
        }

        if (action.points.length >= 3000) {
          return;
        }

        action.points.push(message.point);

        broadcast(
          room,
          {
            type: 'stroke-point',
            strokeId: message.strokeId,
            point: message.point,
          },
          ws
        );

        break;
      }

      case 'clear': {
        if (!roomId) return;

        const room = rooms.get(roomId);

        if (!room) return;

        room.actions = [];

        broadcast(room, {
          type: 'cleared',
        });

        break;
      }

      // ------------------------------
      // WebRTC signaling
      // ------------------------------

      case 'webrtc-offer':
      case 'webrtc-answer':
      case 'webrtc-ice-candidate': {

        if (!roomId) return;

        const room = rooms.get(roomId);

        if (!room) return;

        const target = room.clients.get(message.to);

        if (!target) return;

        send(target.ws, {
          type: message.type,
          from: id,
          offer: message.offer,
          answer: message.answer,
          candidate: message.candidate,
        });

        break;
      }

      case 'voice-ready': {

        if (!roomId) return;

        const room = rooms.get(roomId);

        if (!room) return;

        broadcast(
          room,
          {
            type: 'voice-peer-ready',
            id,
          },
          ws
        );

        break;
      }

      case 'voice-stopped': {

        if (!roomId) return;

        const room = rooms.get(roomId);

        if (!room) return;

        broadcast(
          room,
          {
            type: 'voice-peer-stopped',
            id,
          },
          ws
        );

        break;
      }
    }
  });

  ws.on('close', () => {

    if (!roomId) {
      return;
    }

    const room = rooms.get(roomId);

    if (!room) {
      return;
    }

    room.clients.delete(id);

    broadcast(room, {
      type: 'member-left',
      id,
    });

    broadcastMembers(room);

    if (room.clients.size === 0) {
      rooms.delete(roomId);
    }
  });
});

export default server;
