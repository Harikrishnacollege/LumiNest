import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const getServerUrl = () => process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

let sharedSocket = null;
let refCount = 0;

function getSocket() {
  if (!sharedSocket) {
    sharedSocket = io(getServerUrl(), {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
  }
  refCount++;
  return sharedSocket;
}

function releaseSocket() {
  refCount--;
  if (refCount <= 0 && sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
    refCount = 0;
  }
}

/**
 * useSocket — connect once, share across all screens.
 * Returns { isConnected, on(event, handler), off(event, handler) }
 */
export function useSocket() {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // If already connected (shared socket), sync state
    if (socket.connected) setIsConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      releaseSocket();
    };
  }, []);

  return {
    isConnected,
    on: (event, handler) => socketRef.current?.on(event, handler),
    off: (event, handler) => socketRef.current?.off(event, handler),
  };
}

/**
 * useRealtimeRefresh — auto-refresh callback when any of the given events fire.
 * Usage: useRealtimeRefresh(socket, ['checkin:created', 'checkin:responded'], loadData);
 */
export function useRealtimeRefresh(socket, events, refreshFn) {
  useEffect(() => {
    if (!socket || !events?.length) return;
    const handler = () => refreshFn();
    events.forEach(e => socket.on(e, handler));
    return () => events.forEach(e => socket.off(e, handler));
  }, [socket, events, refreshFn]);
}
