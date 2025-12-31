-- Migration: Create channel_documents table for collaborative document editing
-- This table stores the document content for document-type channels

CREATE TABLE IF NOT EXISTS channel_documents (
    channel_id BIGINT PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    last_edited_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    last_edited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_channel_documents_last_edited ON channel_documents(last_edited_at DESC);

-- Comment on table
COMMENT ON TABLE channel_documents IS 'Stores document content for document-type channels';
COMMENT ON COLUMN channel_documents.content IS 'The document content in JSON format (for rich text editors like TipTap)';
COMMENT ON COLUMN channel_documents.version IS 'Version number for optimistic concurrency control';
