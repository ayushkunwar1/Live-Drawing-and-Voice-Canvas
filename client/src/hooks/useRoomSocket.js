import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws`;

export function useRoomSocket(roomId, name) {

  const wsRef = useRef(null);

  const [socket, setSocket] = useState(null);

  const [actions, setActions] = useState([]);

  const [members, setMembers] = useState([]);

  const [status, setStatus] = useState('connecting');

  const [error, setError] = useState('');

  const listeners = useRef(
    new Map()
  );


  const emitEvent = useCallback(
    (type, payload = {}) => {

      const ws = wsRef.current;

      if (
        ws &&
        ws.readyState === WebSocket.OPEN
      ) {
        ws.send(
          JSON.stringify({
            type,
            ...payload,
          })
        );
      }
    },
    []
  );


  const on = useCallback(
    (type, handler) => {

      if (!listeners.current.has(type)) {
        listeners.current.set(
          type,
          new Set()
        );
      }

      listeners.current
        .get(type)
        .add(handler);
    },
    []
  );


  const off = useCallback(
    (type, handler) => {

      listeners.current
        .get(type)
        ?.delete(handler);
    },
    []
  );


  useEffect(() => {

    console.log(
      'Connecting WebSocket:',
      WS_URL
    );


    const ws =
      new WebSocket(WS_URL);


    wsRef.current = ws;


    const socketAdapter = {

      id: null,

      emit: (
        type,
        payload = {}
      ) => {

        emitEvent(
          type,
          payload
        );

      },

      on,

      off,

    };


    setSocket(socketAdapter);


    ws.onopen = () => {

      console.log(
        'WebSocket connected'
      );


      setStatus(
        'connected'
      );

      setError('');


      ws.send(
        JSON.stringify({
          type: 'join',
          roomId,
          name,
        })
      );

    };


    ws.onmessage = (event) => {

      let message;

      try {
        message =
          JSON.parse(event.data);
      } catch {
        return;
      }


      // --------------------------------
      // State
      // --------------------------------

      if (
        message.type === 'state'
      ) {

        socketAdapter.id =
          message.selfId;


        setActions(
          message.actions || []
        );


        setMembers(
          message.members || []
        );

        return;
      }


      // --------------------------------
      // Members
      // --------------------------------

      if (
        message.type === 'members'
      ) {

        setMembers(
          message.members || []
        );

        return;
      }


      // --------------------------------
      // New action
      // --------------------------------

      if (
        message.type === 'action'
      ) {

        setActions(
          (prev) => [
            ...prev,
            message.action,
          ]
        );

        return;
      }


      // --------------------------------
      // Stroke point
      // --------------------------------

      if (
        message.type ===
        'stroke-point'
      ) {

        setActions(
          (prev) =>
            prev.map(
              (action) => {

                if (
                  action.id !==
                  message.strokeId
                ) {
                  return action;
                }

                return {
                  ...action,

                  points: [
                    ...(action.points || []),
                    message.point,
                  ],
                };

              }
            )
        );

        return;
      }


      // --------------------------------
      // Cleared
      // --------------------------------

      if (
        message.type === 'cleared'
      ) {

        setActions([]);

        return;
      }


      // --------------------------------
      // Error
      // --------------------------------

      if (
        message.type === 'error'
      ) {

        setError(
          message.message
        );

        return;
      }


      // --------------------------------
      // Forward WebRTC events
      // --------------------------------

      const handlers =
        listeners.current
          .get(message.type);


      if (handlers) {

        handlers.forEach(
          (handler) => {

            handler(message);

          }
        );

      }

    };


    ws.onerror = (event) => {

      console.error(
        'WebSocket error:',
        event
      );


      setStatus('error');

      setError(
        'WebSocket connection error'
      );

    };


    ws.onclose = () => {

      console.log(
        'WebSocket closed'
      );


      setStatus(
        'disconnected'
      );

    };


    return () => {

      ws.close();

      wsRef.current = null;

    };

  }, [
    emitEvent,
    name,
    off,
    on,
    roomId,
  ]);


  const beginAction =
    useCallback(
      (action) => {

        setActions(
          (prev) => [
            ...prev,
            action,
          ]
        );


        emitEvent(
          'action',
          {
            action,
          }
        );

      },
      [emitEvent]
    );


  const appendStrokePoint =
    useCallback(
      (
        strokeId,
        point
      ) => {

        setActions(
          (prev) =>
            prev.map(
              (action) => {

                if (
                  action.id !== strokeId
                ) {
                  return action;
                }

                return {
                  ...action,

                  points: [
                    ...(action.points || []),
                    point,
                  ],
                };

              }
            )
        );


        emitEvent(
          'stroke-point',
          {
            strokeId,
            point,
          }
        );

      },
      [emitEvent]
    );


  const clearBoard =
    useCallback(() => {

      emitEvent('clear');

      setActions([]);

    }, [emitEvent]);


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
