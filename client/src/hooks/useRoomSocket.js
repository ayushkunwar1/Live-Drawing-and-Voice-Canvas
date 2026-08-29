import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || '/api/socket-io/socket.io';

export function useRoomSocket(roomId, name) {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [actions, setActions] = useState([]);
  const [members, setMembers] = useState([]);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState('');

  useEffect(() => {
    const instance = io(SOCKET_URL, { autoConnect: false, path: SOCKET_PATH, transports: ['websocket'] });
    socketRef.current = instance;
    setSocket(instance);

    const onConnect = () => {
      setStatus('connected');
      setError('');
      instance.emit('room:join', { roomId, name });
    };
    const onDisconnect = () => setStatus('disconnected');
    const onConnectError = () => setStatus('error');
    const onRoomState = ({ actions: incomingActions, members: incomingMembers }) => {
      setActions(incomingActions || []);
      setMembers(incomingMembers || []);
    };
    const onMembers = (incomingMembers) => setMembers(incomingMembers || []);
    const onAction = (action) => setActions((prev) => [...prev, action]);
    const onStrokePoint = ({ strokeId, point }) => {
      setActions((prev) => prev.map((action) =>
        action.id === strokeId
          ? { ...action, points: [...(action.points || []), point] }
          : action,
      ));
    };
    const onCleared = () => setActions([]);
    const onRoomError = ({ message }) => setError(message || 'Room error');

    instance.on('connect', onConnect);
    instance.on('disconnect', onDisconnect);
    instance.on('connect_error', onConnectError);
    instance.on('room:state', onRoomState);
    instance.on('members-updated', onMembers);
    instance.on('board:action', onAction);
    instance.on('board:stroke-point', onStrokePoint);
    instance.on('board:cleared', onCleared);
    instance.on('room:error', onRoomError);
    instance.connect();

    return () => {
      instance.removeAllListeners();
      instance.disconnect();
      socketRef.current = null;
    };
  }, [roomId, name]);

  const beginAction = useCallback((action) => {
    setActions((prev) => [...prev, action]);
    socketRef.current?.emit('board:action', action);
  }, []);

  const appendStrokePoint = useCallback((strokeId, point) => {
    setActions((prev) => prev.map((action) =>
      action.id === strokeId
        ? { ...action, points: [...(action.points || []), point] }
        : action,
    ));
    socketRef.current?.emit('board:stroke-point', { strokeId, point });
  }, []);

  const clearBoard = useCallback(() => {
    socketRef.current?.emit('board:clear');
    setActions([]);
  }, []);

  return {
    socket,
    actions,
    members,
    status,
    error,
    beginAction,
    appendStrokePoint,
    clearBoard,
  };
}
