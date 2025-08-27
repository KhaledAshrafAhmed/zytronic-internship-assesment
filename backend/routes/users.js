const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all users except current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [users] = await db.execute(
      'SELECT id, username, email, is_online, last_seen FROM users WHERE id != ?',
      [req.user.id]
    );

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user conversations
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const [conversations] = await db.execute(`
      SELECT 
        c.id as conversation_id,
        c.updated_at,
        CASE 
          WHEN c.user1_id = ? THEN u2.id
          ELSE u1.id
        END as other_user_id,
        CASE 
          WHEN c.user1_id = ? THEN u2.username
          ELSE u1.username
        END as other_user_name,
        CASE 
          WHEN c.user1_id = ? THEN u2.is_online
          ELSE u1.is_online
        END as other_user_online,
        latest_msg.message_text as last_message,
        latest_msg.message_type as last_message_type,
        latest_msg.created_at as last_message_time,
        COALESCE(unread_counts.unread_count, 0) as unread_count
      FROM conversations c
      LEFT JOIN users u1 ON c.user1_id = u1.id
      LEFT JOIN users u2 ON c.user2_id = u2.id
      LEFT JOIN (
        SELECT DISTINCT
          conversation_id,
          message_text,
          message_type,
          created_at
        FROM messages m1
        WHERE m1.id = (
          SELECT MAX(m2.id) 
          FROM messages m2 
          WHERE m2.conversation_id = m1.conversation_id
        )
      ) latest_msg ON c.id = latest_msg.conversation_id
      LEFT JOIN (
        SELECT 
          conversation_id,
          COUNT(*) as unread_count
        FROM messages
        WHERE is_read = FALSE AND sender_id != ?
        GROUP BY conversation_id
      ) unread_counts ON c.id = unread_counts.conversation_id
      WHERE (c.user1_id = ? OR c.user2_id = ?)
      ORDER BY 
        CASE WHEN latest_msg.created_at IS NOT NULL THEN latest_msg.created_at ELSE c.updated_at END DESC
    `, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]);

    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;