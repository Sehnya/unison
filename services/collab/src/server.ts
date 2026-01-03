/**
 * Hocuspocus Collaboration Server
 * 
 * Provides real-time document collaboration using Yjs and WebSockets.
 * Documents are persisted to PostgreSQL.
 */

import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { Pool } from 'pg';
import * as jwt from 'jsonwebtoken';
import 'dotenv/config';

// Configuration
const PORT = parseInt(process.env.COLLAB_PORT || '1234', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const DATABASE_URL = process.env.DATABASE_URL;

// Database connection pool
let pool: Pool | null = null;

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  
  // Create documents table if it doesn't exist
  pool.query(`
    CREATE TABLE IF NOT EXISTS collab_documents (
      name VARCHAR(255) PRIMARY KEY,
      data BYTEA NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).then(() => {
    console.log('✅ Collab documents table ready');
  }).catch((err) => {
    console.error('Failed to create collab_documents table:', err);
  });
}

// Verify JWT token and extract user info
function verifyToken(token: string): { userId: string; username: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      userId: decoded.sub || decoded.userId,
      username: decoded.username || 'Anonymous',
    };
  } catch (err) {
    console.error('Token verification failed:', err);
    return null;
  }
}

// Create Hocuspocus server
const server = Server.configure({
  port: PORT,
  
  // Authentication
  async onAuthenticate({ token, documentName }) {
    // Allow anonymous access for development
    if (!token && process.env.NODE_ENV !== 'production') {
      return {
        user: {
          id: 'anonymous',
          name: 'Anonymous',
        },
      };
    }

    const user = verifyToken(token || '');
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Optional: Check if user has access to this document
    // documentName format: "channel-{channelId}" or "guild-{guildId}-{channelId}"
    console.log(`User ${user.username} authenticated for document: ${documentName}`);

    return {
      user: {
        id: user.userId,
        name: user.username,
      },
    };
  },

  // Connection events
  async onConnect({ documentName }) {
    console.log(`📝 New connection to document: ${documentName}`);
  },

  async onDisconnect({ documentName }) {
    console.log(`👋 Disconnected from document: ${documentName}`);
  },

  // Extensions
  extensions: pool ? [
    new Database({
      // Fetch document from database
      fetch: async ({ documentName }) => {
        try {
          const result = await pool!.query(
            'SELECT data FROM collab_documents WHERE name = $1',
            [documentName]
          );
          
          if (result.rows.length > 0) {
            console.log(`📖 Loaded document: ${documentName}`);
            return result.rows[0].data;
          }
          
          console.log(`📄 New document: ${documentName}`);
          return null;
        } catch (err) {
          console.error('Error fetching document:', err);
          return null;
        }
      },
      
      // Store document to database
      store: async ({ documentName, state }) => {
        try {
          await pool!.query(
            `INSERT INTO collab_documents (name, data, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (name) 
             DO UPDATE SET data = $2, updated_at = NOW()`,
            [documentName, state]
          );
          console.log(`💾 Saved document: ${documentName}`);
        } catch (err) {
          console.error('Error storing document:', err);
        }
      },
    }),
  ] : [],
});

// Start server
server.listen().then(() => {
  console.log(`🚀 Hocuspocus collaboration server running on port ${PORT}`);
  console.log(`   Database persistence: ${pool ? 'enabled' : 'disabled (in-memory only)'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down collaboration server...');
  await server.destroy();
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down collaboration server...');
  await server.destroy();
  if (pool) {
    await pool.end();
  }
  process.exit(0);
});

