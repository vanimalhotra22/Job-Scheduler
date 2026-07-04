import { Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { publish, subscribe } from './eventBus';

let clients: Response[] = [];
let ioInstance: SocketIOServer | null = null;

export function setSocketIO(io: SocketIOServer) {
  ioInstance = io;
  console.log('[WebSockets] Socket.IO instance attached successfully.');
}

export function addSseClient(res: Response) {
  clients.push(res);
  res.on('close', () => {
    clients = clients.filter(c => c !== res);
    console.log(`[SSE] Dashboard client disconnected. Active connections: ${clients.length}`);
  });
  console.log(`[SSE] Dashboard client connected. Active connections: ${clients.length}`);
}

// Publish event to Redis event bus
export function broadcastEvent(event: string, data: any) {
  publish('scheduler:events', { event, data }).catch(err => {
    console.error('[EventBus] Fail to publish event:', err.message);
  });
}

// Initialize subscriber loop to capture events from the bus
export function initializeEventSubscriber() {
  subscribe('scheduler:events', (message: any) => {
    const { event, data } = message;
    if (!event) return;

    // 1. Forward to SSE Clients
    const payload = JSON.stringify(data);
    clients.forEach(res => {
      try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${payload}\n\n`);
      } catch (err) {
        console.error('[SSE] Failed to write event to client stream:', err);
      }
    });

    // 2. Forward to Socket.IO Clients
    if (ioInstance) {
      ioInstance.emit(event, data);
    }
  }).catch(err => {
    console.error('[EventBus] Subscribing fail:', err.message);
  });
}
