require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Assuming Vite dev server
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:"],
    },
  },
}));
app.use(express.json());

// Handle Chrome DevTools requests
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/peermeet')
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Socket.io connection
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join-room', (data) => {
    const { roomId, userName } = data;
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName || 'Anonymous';

    // Send current participants to the new user
    const roomSockets = io.sockets.adapter.rooms.get(roomId);
    if (roomSockets) {
      const participants = Array.from(roomSockets).map(id => {
        const s = io.sockets.sockets.get(id);
        return { id, name: s.userName };
      });
      socket.emit('participants-update', participants);
    }

    // Notify others in the room
    socket.to(roomId).emit('user-connected', socket.id);
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit('user-disconnected', socket.id);
  });

  socket.on('sending-signal', (payload) => {
    io.to(payload.userToSignal).emit('receiving-signal', {
      signal: payload.signal,
      callerID: payload.callerID
    });
  });

  socket.on('returning-signal', (payload) => {
    io.to(payload.callerID).emit('receiving-returned-signal', {
      signal: payload.signal,
      id: socket.id
    });
  });

  socket.on('send-message', (data) => {
    const { roomId, message } = data;
    socket.to(roomId).emit('receive-message', message);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.roomId) {
      socket.to(socket.roomId).emit('user-disconnected', socket.id);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});