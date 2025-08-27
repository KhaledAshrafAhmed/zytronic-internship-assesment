const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get or create conversation
router.post('/conversation', authenticateToken, async (req, res) => {
  try {
    const { otherUserId } = req.body;
    const currentUserId = req.user.id;

    if (currentUserId === otherUserId) {
      return res.status(400).json({ error: 'Cannot create conversation with yourself' });
    }

    // Check if conversation exists
    const [existingConversation] = await db.execute(`
      SELECT id FROM conversations 
      WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
    `, [currentUserId, otherUserId, otherUserId, currentUserId]);

    if (existingConversation.length > 0) {
      return res.json({ conversation_id: existingConversation[0].id });
    }

    // Create new conversation
    const [result] = await db.execute(
      'INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)',
      [Math.min(currentUserId, otherUserId), Math.max(currentUserId, otherUserId)]
    );

    res.json({ conversation_id: result.insertId });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages for a conversation
router.get('/conversation/:conversationId', authenticateToken, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversationId);
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 50;
    const offset = (page - 1) * limit;

    // Validate conversationId
    if (isNaN(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    // Verify user is part of conversation
    const [conversation] = await db.execute(
      'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [conversationId, req.user.id, req.user.id]
    );

    if (conversation.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get messages - all parameters are now properly typed
    const [messages] = await db.execute(`
      SELECT 
        m.id,
        m.sender_id,
        m.message_text,
        m.message_type,
        m.image_url,
        m.is_read,
        m.created_at,
        u.username as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `, [conversationId]);

    // Mark messages as read
    await db.execute(
      'UPDATE messages SET is_read = TRUE WHERE conversation_id = ? AND sender_id != ?',
      [conversationId, req.user.id]
    );

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send text message
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { conversationId, messageText } = req.body;

    if (!messageText || !messageText.trim()) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    // Verify user is part of conversation
    const [conversation] = await db.execute(
      'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [conversationId, req.user.id, req.user.id]
    );

    if (conversation.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Insert message
    const [result] = await db.execute(
      'INSERT INTO messages (conversation_id, sender_id, message_text, message_type) VALUES (?, ?, ?, ?)',
      [conversationId, req.user.id, messageText.trim(), 'text']
    );

    // Update conversation timestamp
    await db.execute(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [conversationId]
    );

    res.json({ message_id: result.insertId, success: true });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send image message
router.post('/send-image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { conversationId } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    // Verify user is part of conversation
    const [conversation] = await db.execute(
      'SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [conversationId, req.user.id, req.user.id]
    );

    if (conversation.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    // Insert message
    const [result] = await db.execute(
      'INSERT INTO messages (conversation_id, sender_id, message_type, image_url) VALUES (?, ?, ?, ?)',
      [conversationId, req.user.id, 'image', imageUrl]
    );

    // Update conversation timestamp
    await db.execute(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [conversationId]
    );

    res.json({ message_id: result.insertId, image_url: imageUrl, success: true });
  } catch (error) {
    console.error('Send image error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;