import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(WebSocketContext);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // The server runs on port 3002 (CRM backend)
    const socketInstance = io(import.meta.env.VITE_API_URL || 'http://localhost:3002');

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('🔌 Connected to WebSocket Server');
      
      // Optionally emit a join_room based on user role if available from local storage
      const user = localStorage.getItem('user');
      if (user) {
        try {
          const parsed = JSON.parse(user);
          socketInstance.emit('join_room', { role: parsed.role, userId: parsed.id });
        } catch (e) {
          console.error(e);
        }
      }
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('❌ Disconnected from WebSocket Server');
    });

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};
