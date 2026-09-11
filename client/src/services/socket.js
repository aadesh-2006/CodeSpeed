import { io } from 'socket.io-client';
import { getToken } from './api';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

let socketInstance = null;
let activeToken = null;

/**
 * Initialize or reuse the singleton Socket.IO connection.
 * Automatically injects the latest JWT token from localStorage.
 *
 * @param {object} [options] - Optional Socket.IO client overrides
 * @returns {import('socket.io-client').Socket | null}
 */
export function connectSocket(options = {}) {
  const token = getToken();
  if (!token) {
    disconnectSocket();
    return null;
  }

  // If already connected with the exact same token, return existing socket (prevent duplicate connections)
  if (socketInstance && activeToken === token && (socketInstance.connected || socketInstance.connecting)) {
    return socketInstance;
  }

  // If token changed or previous socket was disconnected, clean up before reconnecting
  if (socketInstance) {
    disconnectSocket();
  }

  activeToken = token;

  socketInstance = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    ...options,
  });

  socketInstance.on('connect_error', (err) => {
    console.warn('[Socket Service] Connection error:', err.message);
  });

  return socketInstance;
}

/**
 * Get the current socket instance, connecting if not already initialized.
 *
 * @returns {import('socket.io-client').Socket | null}
 */
export function getSocket() {
  if (!socketInstance || !socketInstance.connected) {
    return connectSocket();
  }
  return socketInstance;
}

/**
 * Disconnect and destroy the current socket instance.
 */
export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
  }
  activeToken = null;
}

/**
 * Check if the socket is currently connected.
 *
 * @returns {boolean}
 */
export function isSocketConnected() {
  return Boolean(socketInstance && socketInstance.connected);
}

export default {
  connectSocket,
  getSocket,
  disconnectSocket,
  isSocketConnected,
};
