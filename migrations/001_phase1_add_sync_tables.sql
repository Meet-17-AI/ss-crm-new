-- Migration: Phase 1 - Add Lead Sync Tables
-- Purpose: Enable automatic booking to CRM sync
-- Date: June 22, 2026

-- Table 1: lead_sync_log
-- Purpose: Track all sync operations
CREATE TABLE IF NOT EXISTS lead_sync_log (
  sync_id SERIAL PRIMARY KEY,
  sync_type VARCHAR(50) NOT NULL, -- 'booking_to_lead', 'aisensy_to_lead'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  sync_metadata JSONB,
  created_by VARCHAR(100),
  INDEX idx_sync_type_status (sync_type, status),
  INDEX idx_completed_at (completed_at)
);

-- Table 2: booking_to_lead_mapping
-- Purpose: Link bookings to leads for sync tracking
CREATE TABLE IF NOT EXISTS booking_to_lead_mapping (
  mapping_id SERIAL PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE,
  lead_id UUID,
  lead_email VARCHAR(255),
  lead_phone VARCHAR(20),
  lead_name VARCHAR(255),
  match_type VARCHAR(50), -- 'email_match', 'phone_match', 'name_match', 'exact_match'
  match_score FLOAT, -- 0.0 to 1.0, confidence of match
  auto_progression_status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
  auto_progression_at TIMESTAMP WITH TIME ZONE,
  therapist_id INTEGER,
  sync_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_booking_id (booking_id),
  INDEX idx_lead_id (lead_id),
  INDEX idx_email_phone (lead_email, lead_phone)
);

-- Table 3: interaction_log
-- Purpose: Track all lead interactions (calls, emails, stage moves, etc.)
CREATE TABLE IF NOT EXISTS interaction_log (
  interaction_id SERIAL PRIMARY KEY,
  lead_id UUID NOT NULL,
  interaction_type VARCHAR(50) NOT NULL, -- 'stage_move', 'call', 'email', 'text', 'form_submit', 'remark_added'
  interaction_detail TEXT,
  interacted_by VARCHAR(100), -- User who performed action
  interacted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  from_stage VARCHAR(50),
  to_stage VARCHAR(50),
  booking_linked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lead_id_interacted_at (lead_id, interacted_at),
  INDEX idx_interaction_type (interaction_type),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Table 4: duplicate_alerts
-- Purpose: Store detected duplicate leads for resolution
CREATE TABLE IF NOT EXISTS duplicate_alerts (
  alert_id SERIAL PRIMARY KEY,
  lead_id_1 UUID NOT NULL,
  lead_id_2 UUID NOT NULL,
  match_type VARCHAR(50), -- 'phone', 'email', 'name', 'fuzzy'
  match_score FLOAT, -- 0.0 to 1.0
  status VARCHAR(20) DEFAULT 'pending', -- pending, merged, dismissed, false_positive
  merged_by VARCHAR(100),
  merged_at TIMESTAMP WITH TIME ZONE,
  primary_lead_id UUID, -- Which one is kept after merge
  archived_lead_id UUID, -- Which one is archived
  merge_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE,
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (lead_id_1) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id_2) REFERENCES leads(id) ON DELETE CASCADE
);

-- Table 5: form_draft_storage
-- Purpose: Store autosave drafts of forms
CREATE TABLE IF NOT EXISTS form_draft_storage (
  draft_id SERIAL PRIMARY KEY,
  lead_id UUID NOT NULL,
  form_type VARCHAR(50), -- 'pretherapy_form', 'followup_remarks', 'stage_remarks'
  draft_data JSONB NOT NULL,
  last_autosave_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  autosaved_by VARCHAR(100),
  is_submitted BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lead_id_form_type (lead_id, form_type),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Alter leads table to add new fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_interaction_type VARCHAR(50);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS duplicate_of_lead_id UUID;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'pending'; -- pending, synced, failed
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_aisensy BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS aisensy_interaction_type VARCHAR(50); -- 'free_consultation', 'talk_to_team', 'other'
ALTER TABLE leads ADD COLUMN IF NOT EXISTS active_form_type VARCHAR(50); -- 'pretherapy_form', 'followup_remarks'
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_autosave_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS booking_id TEXT; -- Link to booking record

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_last_interaction_at ON leads(last_interaction_at);
CREATE INDEX IF NOT EXISTS idx_leads_is_duplicate ON leads(is_duplicate);
CREATE INDEX IF NOT EXISTS idx_leads_sync_status ON leads(sync_status);
CREATE INDEX IF NOT EXISTS idx_leads_source_aisensy ON leads(source_aisensy);
CREATE INDEX IF NOT EXISTS idx_leads_booking_id ON leads(booking_id);

-- Create function to update last_interaction_at
CREATE OR REPLACE FUNCTION update_lead_interaction()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE leads
  SET last_interaction_at = NEW.interacted_at,
      last_interaction_type = NEW.interaction_type
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for interaction logging
DROP TRIGGER IF NOT EXISTS trigger_update_lead_interaction ON interaction_log;
CREATE TRIGGER trigger_update_lead_interaction
AFTER INSERT ON interaction_log
FOR EACH ROW
EXECUTE FUNCTION update_lead_interaction();

-- Log this migration
INSERT INTO migration_history (name, description, status, created_at)
VALUES (
  '001_phase1_add_sync_tables',
  'Add sync tables and interaction tracking for Phase 1',
  'completed',
  CURRENT_TIMESTAMP
) ON CONFLICT DO NOTHING;

-- Commit message:
-- Phase 1: Add database tables for lead sync, duplicate detection, and interaction tracking
-- New tables: lead_sync_log, booking_to_lead_mapping, interaction_log, duplicate_alerts, form_draft_storage
-- New fields on leads: last_interaction_at, is_duplicate, sync_status, source_aisensy, etc.
-- Migration date: June 22, 2026
