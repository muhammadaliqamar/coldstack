import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './store';

let socket: Socket | null = null;

export const initSocket = () => {
  if (socket) return socket;

  socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', {
    withCredentials: true,
  });

  socket.on('connect', () => {
    console.log('Socket connected');
    const user = useAuthStore.getState().user;
    if (user) {
      socket?.emit('auth', user.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  return socket;
};

export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
