import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { getDb } from '../database/db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { generateToken } from '../utils/jwt';

export async function signup(req: AuthenticatedRequest, res: Response) {
  try {
    const { name, email, password, role } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const db = await getDb();
    
    // Check if email already exists
    const existingUser = await db.get('SELECT * FROM Users WHERE email = ?', email);
    if (existingUser) {
      return res.status(409).json({ error: 'A user with this email address already exists' });
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);
    const userRole = role === 'ADMIN' ? 'ADMIN' : 'USER'; // Default to USER

    await db.run(
      `INSERT INTO Users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
      userId, name, email, passwordHash, userRole
    );

    // Create a default organization for the user on signup
    const orgId = uuidv4();
    await db.run(
      `INSERT INTO Organizations (id, name, owner_id) VALUES (?, ?, ?)`,
      orgId, `${name}'s Organization`, userId
    );

    // Return token and user info
    const token = generateToken({ userId, email, role: userRole });

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: userId, name, email, role: userRole }
    });
  } catch (error: any) {
    console.error('Error during signup:', error);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
}

export async function login(req: AuthenticatedRequest, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = await getDb();
    const user = await db.get('SELECT * FROM Users WHERE email = ?', email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken({ userId: user.id, email: user.email, role: user.role });

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error: any) {
    console.error('Error during login:', error);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
}

export async function getProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await getDb();
    const user = await db.get('SELECT id, name, email, role, created_at FROM Users WHERE id = ?', userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get organizations user belongs to/owns
    const orgs = await db.all('SELECT * FROM Organizations WHERE owner_id = ?', userId);

    return res.status(200).json({ user, organizations: orgs });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
