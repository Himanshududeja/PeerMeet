import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// CORS configuration
app.use(cors({
    origin: [process.env.CLIENT_URL || 'http://localhost:3000', 'https://peer-meet-git-main-himanshus-projects-67799945.vercel.app'],
    methods: ['GET', 'POST']
}));

app.use(express.json());

// Socket.io setup
const io = new Server(httpServer, {
    cors: {
        origin: [process.env.CLIENT_URL || 'http://localhost:3000', 'https://peer-meet-git-main-himanshus-projects-67799945.vercel.app'],
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 100e6, // 100MB
    pingTimeout: 120000,      // 120 seconds
    pingInterval: 30000       // 30 seconds
});

// Store room information
const rooms = new Map();

// Get all users in a room
const getUsersInRoom = (roomId) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room) return [];

    // Get user details from our map
    const users = [];
    if (rooms.has(roomId)) {
        const roomUsers = rooms.get(roomId);
        room.forEach(socketId => {
            if (roomUsers.has(socketId)) {
                users.push({
                    id: socketId,
                    userName: roomUsers.get(socketId).userName
                });
            }
        });
    }
    return users;
};

// Socket.io event handlers
io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.id}`);

    // Join room
    socket.on('join-room', ({ roomId, userName }) => {
        console.log(`👤 ${userName} (${socket.id}) joining room: ${roomId}`);

        // Get existing users before joining (this will now return objects)
        const existingUsers = getUsersInRoom(roomId);

        // Join the room
        socket.join(roomId);

        // Store user info
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
        }
        rooms.get(roomId).set(socket.id, { userName, audioEnabled: true, videoEnabled: true });

        // Send existing users to the new user
        socket.emit('existing-users', {
            users: existingUsers
        });

        // Notify others in room about new user
        socket.to(roomId).emit('user-joined', {
            userId: socket.id,
            userName
        });

        // Update participants list
        updateParticipants(roomId);
    });

    // WebRTC signaling - offer
    socket.on('offer', ({ userToSignal, callerId, signal, userName }) => {
        console.log(`📡 Offer from ${callerId} (${userName}) to ${userToSignal}`);
        io.to(userToSignal).emit('offer', {
            from: callerId,
            offer: signal,
            userName
        });
    });

    // WebRTC signaling - answer
    socket.on('answer', ({ callerId, signal, userName }) => {
        console.log(`📡 Answer to ${callerId} from ${userName}`);
        io.to(callerId).emit('answer', {
            from: socket.id,
            answer: signal,
            userName
        });
    });

    // ICE candidate
    socket.on('ice-candidate', ({ to, candidate }) => {
        io.to(to).emit('ice-candidate', {
            from: socket.id,
            candidate
        });
    });

    // Chat message
    socket.on('send-message', ({ roomId, message }) => {
        if (message.type === 'text') {
            console.log(`💬 Message in room ${roomId}:`, message.text);
        } else {
            console.log(`📎 File shared in room ${roomId}: ${message.fileName} (${message.fileType})`);
        }
        io.to(roomId).emit('chat-message', message);
    });

    // Leave room
    socket.on('leave-room', (roomId) => {
        handleLeaveRoom(socket, roomId);
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`❌ User disconnected: ${socket.id}`);

        // Remove from all rooms
        for (const [roomId, users] of rooms.entries()) {
            if (users.has(socket.id)) {
                handleLeaveRoom(socket, roomId);
            }
        }
    });

    // Helper function to handle leaving room
    function handleLeaveRoom(socket, roomId) {
        console.log(`👋 User ${socket.id} leaving room: ${roomId}`);

        // Notify others
        socket.to(roomId).emit('user-left', {
            userId: socket.id
        });

        // Remove user from room data
        if (rooms.has(roomId)) {
            rooms.get(roomId).delete(socket.id);
            if (rooms.get(roomId).size === 0) {
                rooms.delete(roomId);
            }
        }

        // Leave the socket.io room
        socket.leave(roomId);

        // Update participants
        updateParticipants(roomId);
    }

    // Update participants list for a room
    function updateParticipants(roomId) {
        if (!rooms.has(roomId)) return;

        const participants = Array.from(rooms.get(roomId).entries()).map(([id, data]) => ({
            id,
            name: data.userName,
            audioEnabled: data.audioEnabled,
            videoEnabled: data.videoEnabled
        }));

        io.to(roomId).emit('participants-update', participants);
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        activeRooms: rooms.size,
        connections: io.sockets.sockets.size
    });
});

// Get room info
app.get('/api/rooms/:roomId', (req, res) => {
    const { roomId } = req.params;
    const users = getUsersInRoom(roomId);

    res.json({
        roomId,
        participantCount: users.length,
        participants: users
    });
});

const PORT = process.env.PORT || 5555;

httpServer.listen(PORT, () => {
    console.log(`
  ╔═══════════════════════════════════════╗
  ║                                       ║
  ║   🚀 PEERMEET SERVER RUNNING          ║
  ║                                       ║
  ║   Port: ${PORT}                        ║
  ║   Environment: ${process.env.NODE_ENV || 'development'}           ║
  ║                                       ║
  ╚═══════════════════════════════════════╝
  `);
});

export default app;
