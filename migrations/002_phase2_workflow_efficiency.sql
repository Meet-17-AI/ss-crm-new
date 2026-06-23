-- Migration: Phase 2 - Workflow Efficiency Improvements
-- Purpose: Add autosave, toggle system, and pre-therapy tracking
-- Date: June 22, 2026

-- Modify leads table for Phase 2 features
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pretherapy_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pretherapy_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS auto_progression_enabled BOOLEAN DEFAULT TRUE;

-- Create index for pre-therapy status queries
CREATE INDEX IF NOT EXISTS idx_leads_pretherapy_completed ON leads(pretherapy_completed);
CREATE INDEX IF NOT EXISTS idx_leads_pretherapy_completed_at ON leads(pretherapy_completed_at);

-- Create table for form field values (if not exists from Phase 1)
-- This stores the actual field values for both pre-therapy and follow-up forms
CREATE TABLE IF NOT EXISTS form_field_values (
  field_id SERIAL PRIMARY KEY,
  lead_id UUID NOT NULL,
  form_type VARCHAR(50) NOT NULL, -- 'pretherapy_form', 'followup_remarks'
  field_name VARCHAR(100) NOT NULL,
  field_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  UNIQUE(lead_id, form_type, field_name)
);

CREATE INDEX IF NOT EXISTS idx_form_field_values_lead_id ON form_field_values(lead_id);
CREATE INDEX IF NOT EXISTS idx_form_field_values_form_type ON form_field_values(form_type);

-- Create table for form submissions (tracks when form was last submitted)
CREATE TABLE IF NOT EXISTS form_submissions (
  submission_id SERIAL PRIMARY KEY,
  lead_id UUID NOT NULL,
  form_type VARCHAR(50) NOT NULL, -- 'pretherapy_form', 'followup_remarks'
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  submitted_by VARCHAR(100),
  submission_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_lead_id ON form_submissions(lead_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_type ON form_submissions(form_type);
CREATE INDEX IF NOT EXISTS idx_form_submissions_submitted_at ON form_submissions(submitted_at);

-- Create table for autosave activity tracking
CREATE TABLE IF NOT EXISTS autosave_activity (
  activity_id SERIAL PRIMARY KEY,
  lead_id UUID NOT NULL,
  form_type VARCHAR(50),
  save_count INTEGER DEFAULT 0,
  last_keystroke_at TIMESTAMP WITH TIME ZONE,
  last_save_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  total_characters INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_autosave_activity_lead_id ON autosave_activity(lead_id);

-- Create function to update pretherapy_completed when form submitted
CREATE OR REPLACE FUNCTION mark_pretherapy_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.form_type = 'pretherapy_form' THEN
    UPDATE leads
    SET pretherapy_completed = TRUE,
        pretherapy_completed_at = CURRENT_TIMESTAMP
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for form submission
DROP TRIGGER IF NOT EXISTS trigger_pretherapy_completed ON form_submissions;
CREATE TRIGGER trigger_pretherapy_completed
AFTER INSERT ON form_submissions
FOR EACH ROW
EXECUTE FUNCTION mark_pretherapy_completed();

-- Create function to update auto-progression status based on booking
CREATE OR REPLACE FUNCTION update_auto_progression_from_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- When a booking is confirmed for first session
  -- This would be called from webhook
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Log migration
INSERT INTO migration_history (name, description, status, created_at)
VALUES (
  '002_phase2_workflow_efficiency',
  'Add autosave support, form field storage, pre-therapy tracking, and form submission history',
  'completed',
  CURRENT_TIMESTAMP
) ON CONFLICT (name) DO UPDATE SET status = 'completed', updated_at = CURRENT_TIMESTAMP;

-- Commit message:
-- Phase 2: Add workflow efficiency tables and triggers
-- New tables: form_field_values, form_submissions, autosave_activity
-- New fields on leads: pretherapy_completed, pretherapy_completed_at, auto_progression_enabled
-- New triggers: Update pretherapy_completed on form submission
-- Migration date: June 22, 2026
