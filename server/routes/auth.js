import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';
const TRAINER_USERNAME = process.env.TRAINER_USERNAME || 'pushtrainer';
const TRAINER_PASSWORD = process.env.TRAINER_PASSWORD || 'PushPerformance2025!';

// Hash the hardcoded password (you can run this once to get the hash)
const hashedPassword = bcrypt.hashSync(TRAINER_PASSWORD, 10);

/**
 * POST /api/auth/login
 * Login endpoint for trainers
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check username
    if (username !== TRAINER_USERNAME) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, hashedPassword);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { username: TRAINER_USERNAME, role: 'trainer' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        username: TRAINER_USERNAME,
        role: 'trainer',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/verify
 * Verify JWT token
 */
router.post('/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    res.json({
      success: true,
      user: decoded,
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
