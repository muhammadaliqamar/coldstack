import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';

let io: SocketServer;

/**
 * Initialize Socket.io server.
 */
export function initSocket(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Authenticate and join user room
    socket.on('auth', (userId: string) => {
      socket.join(`user:${userId}`);
      console.log(`User ${userId} joined their room`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Get the Socket.io server instance.
 */
export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

/**
 * Emit an event to a specific user.
 */
export function emitToUser(userId: string, event: string, data: any) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

/**
 * Emit an event to all connected clients.
 */
export function emitToAll(event: string, data: any) {
  if (io) {
    io.emit(event, data);
  }
}
