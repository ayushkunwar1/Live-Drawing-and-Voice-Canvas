import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  window.location.origin;

const SOCKET_PATH =
  import.meta.env.VITE_SOCKET_PATH ||
  '/api/socket-io/socket.io';


export function useRoomSocket(roomId, name) {

  const socketRef = useRef(null);

  const [socket, setSocket] = useState(null);

  const [actions, setActions] = useState([]);

  const [members, setMembers] = useState([]);

  const [status, setStatus] = useState('connecting');

  const [error, setError] = useState('');


  useEffect(() => {

    console.log('Connecting Socket.IO...');

    console.log('Socket URL:', SOCKET_URL);

    console.log('Socket path:', SOCKET_PATH);


    const instance = io(
      SOCKET_URL,
      {
        autoConnect: false,

        path: SOCKET_PATH,

        /*
         * IMPORTANT:
         * Start with polling + websocket.
         *
         * This makes debugging easier and allows
         * Socket.IO to perform its normal handshake.
         */
        transports: [
          'polling',
          'websocket'
        ],

        reconnection: true,

        reconnectionAttempts: Infinity,

        reconnectionDelay: 1000,

        reconnectionDelayMax: 5000,

        timeout: 20000,

        withCredentials: true,
      }
    );


    socketRef.current = instance;

    setSocket(instance);


    // ------------------------------------------
    // CONNECTED
    // ------------------------------------------

    const onConnect = () => {

      console.log(
        'Socket.IO connected:',
        instance.id
      );


      setStatus('connected');

      setError('');


      instance.emit(
        'room:join',
        {
          roomId,
          name,
        }
      );

    };


    // ------------------------------------------
    // DISCONNECTED
    // ------------------------------------------

    const onDisconnect = (
      reason
    ) => {

      console.log(
        'Socket.IO disconnected:',
        reason
      );


      setStatus('disconnected');

    };


    // ------------------------------------------
    // CONNECTION ERROR
    // ------------------------------------------

    const onConnectError = (
      err
    ) => {

      console.error(
        'Socket.IO connection error:',
        err
      );


      console.error(
        'Message:',
        err?.message
      );


      console.error(
        'Description:',
        err?.description
      );


      console.error(
        'Context:',
        err?.context
      );


      setStatus('error');


      setError(
        err?.message ||
        'Unable to connect to realtime server.'
      );

    };


    // ------------------------------------------
    // ROOM STATE
    // ------------------------------------------

    const onRoomState = ({
      actions: incomingActions,
      members: incomingMembers
    }) => {

      console.log(
        'Room state received:',
        {
          actions: incomingActions,
          members: incomingMembers
        }
      );


      setActions(
        incomingActions || []
      );


      setMembers(
        incomingMembers || []
      );

    };


    // ------------------------------------------
    // MEMBERS UPDATED
    // ------------------------------------------

    const onMembers = (
      incomingMembers
    ) => {

      console.log(
        'Members updated:',
        incomingMembers
      );


      setMembers(
        incomingMembers || []
      );

    };


    // ------------------------------------------
    // NEW BOARD ACTION
    // ------------------------------------------

    const onAction = (
      action
    ) => {

      setActions(
        (previous) => [
          ...previous,
          action
        ]
      );

    };


    // ------------------------------------------
    // STROKE POINT
    // ------------------------------------------

    const onStrokePoint = ({
      strokeId,
      point
    }) => {

      setActions(
        (previous) =>
          previous.map(
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
                  point
                ]
              };

            }
          )
      );

    };


    // ------------------------------------------
    // BOARD CLEARED
    // ------------------------------------------

    const onCleared = () => {

      setActions([]);

    };


    // ------------------------------------------
    // ROOM ERROR
    // ------------------------------------------

    const onRoomError = ({
      message
    }) => {

      console.error(
        'Room error:',
        message
      );


      setError(
        message ||
        'Room error'
      );

    };


    // ------------------------------------------
    // REGISTER EVENTS
    // ------------------------------------------

    instance.on(
      'connect',
      onConnect
    );

    instance.on(
      'disconnect',
      onDisconnect
    );

    instance.on(
      'connect_error',
      onConnectError
    );

    instance.on(
      'room:state',
      onRoomState
    );

    instance.on(
      'members-updated',
      onMembers
    );

    instance.on(
      'board:action',
      onAction
    );

    instance.on(
      'board:stroke-point',
      onStrokePoint
    );

    instance.on(
      'board:cleared',
      onCleared
    );

    instance.on(
      'room:error',
      onRoomError
    );


    // ------------------------------------------
    // CONNECT
    // ------------------------------------------

    instance.connect();


    // ------------------------------------------
    // CLEANUP
    // ------------------------------------------

    return () => {

      console.log(
        'Cleaning Socket.IO connection'
      );


      instance.removeAllListeners();

      instance.disconnect();

      socketRef.current = null;

    };

  }, [roomId, name]);


  // ==========================================
  // CREATE BOARD ACTION
  // ==========================================

  const beginAction = useCallback(
    (action) => {

      setActions(
        (previous) => [
          ...previous,
          action
        ]
      );


      socketRef.current?.emit(
        'board:action',
        action
      );

    },
    []
  );


  // ==========================================
  // ADD STROKE POINT
  // ==========================================

  const appendStrokePoint =
    useCallback(
      (
        strokeId,
        point
      ) => {

        setActions(
          (previous) =>
            previous.map(
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
                    point
                  ]
                };

              }
            )
        );


        socketRef.current?.emit(
          'board:stroke-point',
          {
            strokeId,
            point
          }
        );

      },
      []
    );


  // ==========================================
  // CLEAR BOARD
  // ==========================================

  const clearBoard =
    useCallback(
      () => {

        socketRef.current?.emit(
          'board:clear'
        );


        setActions([]);

      },
      []
    );


  // ==========================================
  // RETURN
  // ==========================================

  return {

    socket,

    actions,

    members,

    status,

    error,

    beginAction,

    appendStrokePoint,

    clearBoard

  };

}
