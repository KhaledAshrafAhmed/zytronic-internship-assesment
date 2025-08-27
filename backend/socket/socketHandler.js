const jwt = require('jsonwebtoken');
const db = require('../config/database');

const socketHandler = (io) => {
  const connectedUsers = new Map();

  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const [users] = await db.execute(
        'SELECT id, username, email FROM users WHERE id = ?',
        [decoded.userId]
      );

      if (users.length === 0) {
        return next(new Error('Authentication error'));
      }

      socket.userId = users[0].id;
      socket.user = users[0];
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User ${socket.user.username} connected`);

    // Store connected user
    connectedUsers.set(socket.userId, socket.id);

    // Update user online status
    await db.execute(
      'UPDATE users SET is_online = TRUE WHERE id = ?',
      [socket.userId]
    );

    // Broadcast user online status to all clients
    socket.broadcast.emit('user_online', {
      userId: socket.userId,
      username: socket.user.username
    });

    // Join user to their conversation rooms
    try {
      const [conversations] = await db.execute(`
        SELECT id FROM conversations 
        WHERE user1_id = ? OR user2_id = ?
      `, [socket.userId, socket.userId]);

      conversations.forEach(conv => {
        socket.join(`conversation_${conv.id}`);
      });
    } catch (error) {
      console.error('Error joining conversation rooms:', error);
    }

    // Handle joining specific conversation
    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation_${conversationId}`);
    });

    // Handle sending message
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, messageText, messageType = 'text', imageUrl = null } = data;

        // Verify user is part of conversation
        const [conversation] = await db.execute(
          'SELECT user1_id, user2_id FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
          [conversationId, socket.userId, socket.userId]
        );

        if (conversation.length === 0) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Insert message into database
        const [result] = await db.execute(
          'INSERT INTO messages (conversation_id, sender_id, message_text, message_type, image_url) VALUES (?, ?, ?, ?, ?)',
          [conversationId, socket.userId, messageText, messageType, imageUrl]
        );

        // Update conversation timestamp
        await db.execute(
          'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [conversationId]
        );

        const messageData = {
          id: result.insertId,
          conversation_id: conversationId,
          sender_id: socket.userId,
          sender_name: socket.user.username,
          message_text: messageText,
          message_type: messageType,
          image_url: imageUrl,
          is_read: false,
          created_at: new Date()
        };

        // Emit to all users in the conversation
        io.to(`conversation_${conversationId}`).emit('new_message', messageData);

        // Send push notification to offline users (implement as needed)
        const otherUserId = conversation[0].user1_id === socket.userId 
          ? conversation[0].user2_id 
          : conversation[0].user1_id;
        
        if (!connectedUsers.has(otherUserId)) {
          // User is offline, could send push notification here
          console.log(`User ${otherUserId} is offline, message queued`);
        }

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      socket.to(`conversation_${data.conversationId}`).emit('user_typing', {
        userId: socket.userId,
        username: socket.user.username,
        conversationId: data.conversationId
      });
    });

    socket.on('typing_stop', (data) => {
      socket.to(`conversation_${data.conversationId}`).emit('user_stopped_typing', {
        userId: socket.userId,
        conversationId: data.conversationId
      });
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User ${socket.user.username} disconnected`);
      
      // Remove from connected users
      connectedUsers.delete(socket.userId);

      // Update user offline status
      await db.execute(
        'UPDATE users SET is_online = FALSE, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
        [socket.userId]
      );

      // Broadcast user offline status
      socket.broadcast.emit('user_offline', {
        userId: socket.userId,
        username: socket.user.username
      });
    });
  });
};

module.exports = socketHandler;