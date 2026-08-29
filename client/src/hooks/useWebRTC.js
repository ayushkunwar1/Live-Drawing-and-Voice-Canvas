import { useCallback, useEffect, useRef, useState } from 'react';

const ICE_SERVERS = import.meta.env.VITE_STUN_SERVER
  ? [{ urls: import.meta.env.VITE_STUN_SERVER }]
  : [{ urls: 'stun:stun.l.google.com:19302' }];

export function useWebRTC(socket, members) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const peerConnections = useRef(new Map());
  const pendingCandidates = useRef(new Map());
  const membersRef = useRef(members);
  const voiceEnabledRef = useRef(voiceEnabled);

  useEffect(() => { membersRef.current = members; }, [members]);
  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

  const closePeer = useCallback((peerId) => {
    const pc = peerConnections.current.get(peerId);
    if (pc) pc.close();
    peerConnections.current.delete(peerId);
    pendingCandidates.current.delete(peerId);
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  const addPendingCandidates = useCallback(async (peerId, pc) => {
    const queued = pendingCandidates.current.get(peerId) || [];
    for (const candidate of queued) {
      try { await pc.addIceCandidate(candidate); } catch { /* connection may already be closed */ }
    }
    pendingCandidates.current.delete(peerId);
  }, []);

  const ensurePeer = useCallback((peerId) => {
    if (peerConnections.current.has(peerId)) return peerConnections.current.get(peerId);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    if (localStream) {
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }
    pc.onicecandidate = (event) => {
      if (event.candidate) socket?.emit('webrtc:ice-candidate', { to: peerId, candidate: event.candidate });
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;
      setRemoteStreams((prev) => new Map(prev).set(peerId, stream));
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) closePeer(peerId);
    };
    peerConnections.current.set(peerId, pc);
    return pc;
  }, [closePeer, localStream, socket]);

  const createOfferForPeer = useCallback(async (peerId) => {
    if (!voiceEnabledRef.current || !socket || !localStream) return;
    const pc = ensurePeer(peerId);
    if (pc.signalingState !== 'stable') return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('webrtc:offer', { to: peerId, offer: pc.localDescription });
  }, [ensurePeer, localStream, socket]);

  useEffect(() => {
    if (!socket) return;

    const onOffer = async ({ from, offer }) => {
      if (!voiceEnabledRef.current || !localStream) return;
      const pc = ensurePeer(from);
      await pc.setRemoteDescription(offer);
      await addPendingCandidates(from, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc:answer', { to: from, answer: pc.localDescription });
    };

    const onAnswer = async ({ from, answer }) => {
      const pc = peerConnections.current.get(from);
      if (!pc) return;
      await pc.setRemoteDescription(answer);
      await addPendingCandidates(from, pc);
    };

    const onCandidate = async ({ from, candidate }) => {
      const pc = peerConnections.current.get(from);
      if (!pc || !pc.remoteDescription) {
        const queue = pendingCandidates.current.get(from) || [];
        queue.push(candidate);
        pendingCandidates.current.set(from, queue);
        return;
      }
      try { await pc.addIceCandidate(candidate); } catch { /* ignore stale candidate */ }
    };

    const onPeerReady = ({ id }) => {
      if (!id || !voiceEnabledRef.current) return;
      if (String(socket.id) < String(id)) createOfferForPeer(id).catch(() => closePeer(id));
    };

    const onPeerStopped = ({ id }) => closePeer(id);
    const onPeerLeft = ({ id }) => closePeer(id);

    socket.on('webrtc:offer', onOffer);
    socket.on('webrtc:answer', onAnswer);
    socket.on('webrtc:ice-candidate', onCandidate);
    socket.on('voice:peer-ready', onPeerReady);
    socket.on('voice:peer-stopped', onPeerStopped);
    socket.on('room:user-left', onPeerLeft);

    return () => {
      socket.off('webrtc:offer', onOffer);
      socket.off('webrtc:answer', onAnswer);
      socket.off('webrtc:ice-candidate', onCandidate);
      socket.off('voice:peer-ready', onPeerReady);
      socket.off('voice:peer-stopped', onPeerStopped);
      socket.off('room:user-left', onPeerLeft);
    };
  }, [addPendingCandidates, closePeer, createOfferForPeer, ensurePeer, localStream, socket]);

  useEffect(() => {
    if (!voiceEnabled || !localStream || !socket) return;
    membersRef.current
      .filter((member) => member.id !== socket.id)
      .forEach((member) => {
        if (String(socket.id) < String(member.id)) createOfferForPeer(member.id).catch(() => closePeer(member.id));
      });
  }, [closePeer, createOfferForPeer, localStream, socket, voiceEnabled, members]);

  const toggleVoice = useCallback(async () => {
    if (voiceEnabledRef.current) {
      localStream?.getTracks().forEach((track) => track.stop());
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      pendingCandidates.current.clear();
      setRemoteStreams(new Map());
      setLocalStream(null);
      setVoiceEnabled(false);
      socket?.emit('voice:stopped');
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    setLocalStream(stream);
    setVoiceEnabled(true);
    socket?.emit('voice:ready');
  }, [localStream, socket]);

  useEffect(() => () => {
    localStream?.getTracks().forEach((track) => track.stop());
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
  }, [localStream]);

  return { voiceEnabled, toggleVoice, localStream, remoteStreams };
}
