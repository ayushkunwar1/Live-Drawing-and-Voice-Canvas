import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';


// ==========================================
// ICE / STUN SERVERS
// ==========================================

const ICE_SERVERS = import.meta.env.VITE_STUN_SERVER
  ? [
      {
        urls: import.meta.env.VITE_STUN_SERVER,
      },
    ]
  : [
      {
        urls: 'stun:stun.l.google.com:19302',
      },
    ];


// ==========================================
// WEBRTC HOOK
// ==========================================

export function useWebRTC(socket, members) {

  const [voiceEnabled, setVoiceEnabled] =
    useState(false);

  const [localStream, setLocalStream] =
    useState(null);

  const [remoteStreams, setRemoteStreams] =
    useState(new Map());


  // Store peer connections
  const peerConnections =
    useRef(new Map());


  // Store ICE candidates received
  // before a remote description exists
  const pendingCandidates =
    useRef(new Map());


  // Keep latest values available to callbacks
  const membersRef =
    useRef(members);

  const voiceEnabledRef =
    useRef(voiceEnabled);

  const localStreamRef =
    useRef(localStream);


  useEffect(() => {
    membersRef.current = members;
  }, [members]);


  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);


  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);


  // ==========================================
  // CLOSE ONE PEER
  // ==========================================

  const closePeer = useCallback(
    (peerId) => {

      const pc =
        peerConnections.current.get(peerId);

      if (pc) {
        try {
          pc.close();
        } catch {
          // Ignore already closed connections
        }
      }


      peerConnections.current.delete(peerId);

      pendingCandidates.current.delete(peerId);


      setRemoteStreams((previous) => {

        const next =
          new Map(previous);

        next.delete(peerId);

        return next;
      });
    },
    []
  );


  // ==========================================
  // ADD QUEUED ICE CANDIDATES
  // ==========================================

  const addPendingCandidates =
    useCallback(
      async (peerId, pc) => {

        const queued =
          pendingCandidates.current.get(peerId) || [];


        for (const candidate of queued) {

          try {

            await pc.addIceCandidate(
              candidate
            );

          } catch {
            // Ignore stale/invalid candidates
          }
        }


        pendingCandidates.current.delete(
          peerId
        );
      },
      []
    );


  // ==========================================
  // CREATE PEER CONNECTION
  // ==========================================

  const ensurePeer =
    useCallback(
      (peerId) => {

        const existing =
          peerConnections.current.get(
            peerId
          );

        if (existing) {
          return existing;
        }


        const pc =
          new RTCPeerConnection({
            iceServers: ICE_SERVERS,
          });


        // --------------------------------------
        // Add local microphone tracks
        // --------------------------------------

        const stream =
          localStreamRef.current;

        if (stream) {

          stream
            .getTracks()
            .forEach((track) => {

              pc.addTrack(
                track,
                stream
              );

            });
        }


        // --------------------------------------
        // ICE candidates
        // --------------------------------------

        pc.onicecandidate =
          (event) => {

            if (
              !event.candidate ||
              !socket
            ) {
              return;
            }


            socket.emit(
              'webrtc-ice-candidate',
              {
                to: peerId,
                candidate:
                  event.candidate,
              }
            );
          };


        // --------------------------------------
        // Remote audio
        // --------------------------------------

        pc.ontrack =
          (event) => {

            const stream =
              event.streams?.[0];

            if (!stream) {
              return;
            }


            setRemoteStreams(
              (previous) => {

                const next =
                  new Map(previous);

                next.set(
                  peerId,
                  stream
                );

                return next;
              }
            );
          };


        // --------------------------------------
        // Connection state
        // --------------------------------------

        pc.onconnectionstatechange =
          () => {

            console.log(
              `WebRTC ${peerId}:`,
              pc.connectionState
            );


            if (
              [
                'failed',
                'closed',
                'disconnected',
              ].includes(
                pc.connectionState
              )
            ) {

              closePeer(peerId);

            }
          };


        // --------------------------------------
        // ICE connection state
        // --------------------------------------

        pc.oniceconnectionstatechange =
          () => {

            console.log(
              `ICE ${peerId}:`,
              pc.iceConnectionState
            );


            if (
              pc.iceConnectionState ===
              'failed'
            ) {
              closePeer(peerId);
            }
          };


        peerConnections.current.set(
          peerId,
          pc
        );


        return pc;
      },
      [
        closePeer,
        socket,
      ]
    );


  // ==========================================
  // CREATE OFFER
  // ==========================================

  const createOfferForPeer =
    useCallback(
      async (peerId) => {

        if (
          !voiceEnabledRef.current ||
          !socket ||
          !localStreamRef.current ||
          !socket.id
        ) {
          return;
        }


        const pc =
          ensurePeer(peerId);


        if (
          pc.signalingState !==
          'stable'
        ) {
          return;
        }


        try {

          const offer =
            await pc.createOffer();


          await pc.setLocalDescription(
            offer
          );


          socket.emit(
            'webrtc-offer',
            {
              to: peerId,
              offer:
                pc.localDescription,
            }
          );

        } catch (error) {

          console.error(
            'Failed to create WebRTC offer:',
            error
          );


          closePeer(peerId);
        }
      },
      [
        closePeer,
        ensurePeer,
        socket,
      ]
    );


  // ==========================================
  // SIGNALING EVENT HANDLERS
  // ==========================================

  useEffect(() => {

    if (!socket) {
      return;
    }


    // ----------------------------------------
    // RECEIVE OFFER
    // ----------------------------------------

    const onOffer =
      async ({
        from,
        offer,
      }) => {

        if (
          !from ||
          !offer ||
          !voiceEnabledRef.current ||
          !localStreamRef.current
        ) {
          return;
        }


        try {

          const pc =
            ensurePeer(from);


          await pc.setRemoteDescription(
            offer
          );


          await addPendingCandidates(
            from,
            pc
          );


          const answer =
            await pc.createAnswer();


          await pc.setLocalDescription(
            answer
          );


          socket.emit(
            'webrtc-answer',
            {
              to: from,
              answer:
                pc.localDescription,
            }
          );

        } catch (error) {

          console.error(
            'Failed to handle WebRTC offer:',
            error
          );


          closePeer(from);
        }
      };


    // ----------------------------------------
    // RECEIVE ANSWER
    // ----------------------------------------

    const onAnswer =
      async ({
        from,
        answer,
      }) => {

        if (
          !from ||
          !answer
        ) {
          return;
        }


        const pc =
          peerConnections.current.get(
            from
          );


        if (!pc) {
          return;
        }


        try {

          await pc.setRemoteDescription(
            answer
          );


          await addPendingCandidates(
            from,
            pc
          );

        } catch (error) {

          console.error(
            'Failed to handle WebRTC answer:',
            error
          );


          closePeer(from);
        }
      };


    // ----------------------------------------
    // RECEIVE ICE CANDIDATE
    // ----------------------------------------

    const onCandidate =
      async ({
        from,
        candidate,
      }) => {

        if (
          !from ||
          !candidate
        ) {
          return;
        }


        const pc =
          peerConnections.current.get(
            from
          );


        // Peer doesn't exist yet
        if (!pc) {

          const queue =
            pendingCandidates.current
              .get(from) || [];


          queue.push(candidate);


          pendingCandidates.current.set(
            from,
            queue
          );


          return;
        }


        // Remote description isn't ready yet
        if (
          !pc.remoteDescription
        ) {

          const queue =
            pendingCandidates.current
              .get(from) || [];


          queue.push(candidate);


          pendingCandidates.current.set(
            from,
            queue
          );


          return;
        }


        try {

          await pc.addIceCandidate(
            candidate
          );

        } catch (error) {

          console.error(
            'Failed to add ICE candidate:',
            error
          );
        }
      };


    // ----------------------------------------
    // PEER READY
    // ----------------------------------------

    const onPeerReady =
      ({ id }) => {

        if (
          !id ||
          !socket.id ||
          !voiceEnabledRef.current
        ) {
          return;
        }


        // Only one side creates the offer.
        // This prevents both peers from
        // creating offers simultaneously.

        if (
          String(socket.id) <
          String(id)
        ) {

          createOfferForPeer(
            id
          ).catch((error) => {

            console.error(
              'Offer creation failed:',
              error
            );

          });

        }
      };


    // ----------------------------------------
    // PEER STOPPED
    // ----------------------------------------

    const onPeerStopped =
      ({ id }) => {

        if (id) {
          closePeer(id);
        }
      };


    // ----------------------------------------
    // PEER LEFT
    // ----------------------------------------

    const onPeerLeft =
      ({ id }) => {

        if (id) {
          closePeer(id);
        }
      };


    // ----------------------------------------
    // REGISTER EVENTS
    // ----------------------------------------

    socket.on(
      'webrtc-offer',
      onOffer
    );

    socket.on(
      'webrtc-answer',
      onAnswer
    );

    socket.on(
      'webrtc-ice-candidate',
      onCandidate
    );

    socket.on(
      'voice-peer-ready',
      onPeerReady
    );

    socket.on(
      'voice-peer-stopped',
      onPeerStopped
    );

    socket.on(
      'member-left',
      onPeerLeft
    );


    // ----------------------------------------
    // CLEANUP
    // ----------------------------------------

    return () => {

      socket.off(
        'webrtc-offer',
        onOffer
      );

      socket.off(
        'webrtc-answer',
        onAnswer
      );

      socket.off(
        'webrtc-ice-candidate',
        onCandidate
      );

      socket.off(
        'voice-peer-ready',
        onPeerReady
      );

      socket.off(
        'voice-peer-stopped',
        onPeerStopped
      );

      socket.off(
        'member-left',
        onPeerLeft
      );

    };

  }, [
    addPendingCandidates,
    closePeer,
    createOfferForPeer,
    ensurePeer,
    socket,
  ]);


  // ==========================================
  // CONNECT TO CURRENT MEMBERS
  // ==========================================

  useEffect(() => {

    if (
      !voiceEnabled ||
      !localStream ||
      !socket ||
      !socket.id
    ) {
      return;
    }


    const currentMembers =
      membersRef.current;


    currentMembers
      .filter(
        (member) =>
          member.id !== socket.id
      )
      .forEach(
        (member) => {

          // Deterministically select
          // which peer creates the offer.

          if (
            String(socket.id) <
            String(member.id)
          ) {

            createOfferForPeer(
              member.id
            ).catch((error) => {

              console.error(
                'Failed to connect to peer:',
                error
              );

            });

          }

        }
      );

  }, [
    createOfferForPeer,
    localStream,
    members,
    socket,
    voiceEnabled,
  ]);


  // ==========================================
  // CLEAN UP PEERS THAT LEFT
  // ==========================================

  useEffect(() => {

    const currentIds =
      new Set(
        members.map(
          (member) =>
            member.id
        )
      );


    for (
      const peerId
      of peerConnections.current.keys()
    ) {

      if (
        socket?.id &&
        peerId !== socket.id &&
        !currentIds.has(peerId)
      ) {

        closePeer(peerId);

      }
    }

  }, [
    closePeer,
    members,
    socket,
  ]);


  // ==========================================
  // TOGGLE VOICE
  // ==========================================

  const toggleVoice =
    useCallback(
      async () => {

        // --------------------------------------
        // TURN VOICE OFF
        // --------------------------------------

        if (
          voiceEnabledRef.current
        ) {

          const stream =
            localStreamRef.current;


          if (stream) {

            stream
              .getTracks()
              .forEach(
                (track) =>
                  track.stop()
              );

          }


          peerConnections.current
            .forEach(
              (pc) => {

                try {
                  pc.close();
                } catch {
                  // Ignore
                }

              }
            );


          peerConnections.current.clear();

          pendingCandidates.current.clear();


          setRemoteStreams(
            new Map()
          );


          setLocalStream(
            null
          );


          setVoiceEnabled(
            false
          );


          socket?.emit(
            'voice-stopped'
          );


          return;
        }


        // --------------------------------------
        // TURN VOICE ON
        // --------------------------------------

        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {

          throw new Error(
            'Your browser does not support microphone access.'
          );

        }


        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              audio: true,
              video: false,
            }
          );


        setLocalStream(
          stream
        );


        setVoiceEnabled(
          true
        );


        socket?.emit(
          'voice-ready'
        );

      },
      [
        socket,
      ]
    );


  // ==========================================
  // GLOBAL CLEANUP
  // ==========================================

  useEffect(() => {

    return () => {

      const stream =
        localStreamRef.current;


      if (stream) {

        stream
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );

      }


      peerConnections.current
        .forEach(
          (pc) => {

            try {
              pc.close();
            } catch {
              // Ignore
            }

          }
        );


      peerConnections.current.clear();

      pendingCandidates.current.clear();

    };

  }, []);


  // ==========================================
  // RETURN
  // ==========================================

  return {
    voiceEnabled,
    toggleVoice,
    localStream,
    remoteStreams,
  };
}
