-- ============================================================================
-- KCAP (Kargo Creative Approval Platform) - Complete Database Schema
-- ============================================================================
--
-- Workflow: Client uploads assets → Kargo builds creatives → Client approves
--
-- Phase 1: Asset Pack Submission & Review
-- Phase 2: Static Mock Production & Approval
-- Phase 3: Animated Production & Approval
-- Phase 4: Launch Preparation
--
-- ============================================================================

-- Drop existing tables if rebuilding
DROP TABLE IF EXISTS portal_notifications CASCADE;
DROP TABLE IF EXISTS deliverable_revisions CASCADE;
DROP TABLE IF EXISTS format_approvals CASCADE;
DROP TABLE IF EXISTS deliverable_demo_urls CASCADE;
DROP TABLE IF EXISTS sla_timers CASCADE;
DROP TABLE IF EXISTS deliverables CASCADE;
DROP TABLE IF EXISTS campaign_formats CASCADE;
DROP TABLE IF EXISTS asset_pack_files CASCADE;
DROP TABLE IF EXISTS asset_packs CASCADE;
DROP TABLE IF EXISTS format_library CASCADE;

-- Keep existing tables (reuse)
-- campaigns (already exists, will be enhanced)
-- client_portal_tokens (reuse as-is)

-- ============================================================================
-- Table 1: Format Library (21 Kargo High-Impact Formats)
-- ============================================================================

CREATE TABLE format_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format_name VARCHAR(100) UNIQUE NOT NULL,
  format_type VARCHAR(50) NOT NULL,           -- 'video', 'display', 'ctv'
  device_support VARCHAR(50) NOT NULL,        -- 'cross-platform', 'mobile-only', 'ctv-only'
  devices JSONB NOT NULL,                     -- ["desktop", "mobile", "tablet"] OR ["mobile"] OR ["ctv"]
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_format_library_type ON format_library(format_type);
CREATE INDEX idx_format_library_device_support ON format_library(device_support);

COMMENT ON TABLE format_library IS 'Predefined library of 21 Kargo high-impact ad formats';
COMMENT ON COLUMN format_library.devices IS 'JSON array of supported devices for this format';

-- ============================================================================
-- Table 2: Enhanced Campaigns Table (Add KCAP-specific fields)
-- ============================================================================

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS expected_formats JSONB,              -- Array of format names client expects
ADD COLUMN IF NOT EXISTS primary_contact_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS secondary_contact_emails JSONB,      -- Array of additional client emails
ADD COLUMN IF NOT EXISTS expected_launch_date DATE,
ADD COLUMN IF NOT EXISTS current_phase VARCHAR(100) DEFAULT 'asset_pack_upload';
                                                              -- Phases: asset_pack_upload, asset_pack_review, static_mock_production,
                                                              --         static_mock_approval, animated_production, animated_approval,
                                                              --         ready_for_launch

CREATE INDEX idx_campaigns_current_phase ON campaigns(current_phase);

COMMENT ON COLUMN campaigns.expected_formats IS 'JSON array of format names (e.g., ["Venti Video", "Lighthouse Display"])';
COMMENT ON COLUMN campaigns.current_phase IS 'Current workflow phase for tracking progress';

-- ============================================================================
-- Table 3: Asset Packs (Client Uploads Source Materials)
-- ============================================================================

CREATE TABLE asset_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  -- Upload metadata
  uploaded_by VARCHAR(255) NOT NULL,          -- Client email from portal token
  upload_method VARCHAR(50) NOT NULL,         -- 'portal', 'manual_am'

  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending',       -- 'pending', 'approved', 'rejected'

  -- Approval/Rejection
  reviewed_by VARCHAR(255),                   -- AM email
  reviewed_at TIMESTAMP,
  rejection_note TEXT,                        -- MANDATORY if status = 'rejected'

  -- File statistics
  total_files INT DEFAULT 0,
  total_size_bytes BIGINT DEFAULT 0,

  -- Notes
  client_notes TEXT,
  internal_notes TEXT,                        -- AM notes visible only to Kargo team

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_asset_packs_campaign ON asset_packs(campaign_id);
CREATE INDEX idx_asset_packs_status ON asset_packs(status);

COMMENT ON TABLE asset_packs IS 'Client-uploaded source materials (logos, images, copy, brand guidelines)';
COMMENT ON COLUMN asset_packs.rejection_note IS 'MANDATORY when status = rejected. Details what assets are missing or incorrect.';

-- Constraint: rejection_note is required if status is 'rejected'
ALTER TABLE asset_packs
ADD CONSTRAINT check_rejection_note_required
CHECK (
  (status != 'rejected') OR
  (status = 'rejected' AND rejection_note IS NOT NULL AND LENGTH(TRIM(rejection_note)) > 0)
);

-- ============================================================================
-- Table 4: Asset Pack Files (Individual Files in Asset Pack)
-- ============================================================================

CREATE TABLE asset_pack_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_pack_id UUID NOT NULL REFERENCES asset_packs(id) ON DELETE CASCADE,

  -- File metadata
  original_filename VARCHAR(500) NOT NULL,
  s3_key VARCHAR(1000) NOT NULL,
  s3_url VARCHAR(1000) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type VARCHAR(100),

  -- Categorization (optional AI-assisted)
  category VARCHAR(100),                      -- 'logo', 'image', 'copy', 'brand_guide', 'font', 'other'
  is_extracted_from_zip BOOLEAN DEFAULT false,

  -- Timestamps
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_asset_pack_files_pack ON asset_pack_files(asset_pack_id);
CREATE INDEX idx_asset_pack_files_category ON asset_pack_files(category);

COMMENT ON TABLE asset_pack_files IS 'Individual files within an asset pack upload';
COMMENT ON COLUMN asset_pack_files.is_extracted_from_zip IS 'True if file was extracted from ZIP archive';

-- ============================================================================
-- Table 5: Campaign Formats (Formats Included in Campaign)
-- ============================================================================

CREATE TABLE campaign_formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  format_id UUID NOT NULL REFERENCES format_library(id) ON DELETE RESTRICT,

  -- Creative variation
  variation_name VARCHAR(255),                -- 'Ravens vs Dolphins', 'Chiefs vs Bills', etc.
  variation_order INT DEFAULT 1,              -- Display order in portal

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(campaign_id, format_id, variation_name)
);

CREATE INDEX idx_campaign_formats_campaign ON campaign_formats(campaign_id);
CREATE INDEX idx_campaign_formats_format ON campaign_formats(format_id);

COMMENT ON TABLE campaign_formats IS 'Formats included in a campaign with optional creative variations';
COMMENT ON COLUMN campaign_formats.variation_name IS 'Creative variation (e.g., different product, headline, or messaging)';

-- ============================================================================
-- Table 6: Deliverables (Static Mocks & Animated Creatives)
-- ============================================================================

CREATE TABLE deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  -- Deliverable type
  deliverable_type VARCHAR(50) NOT NULL,      -- 'static_mock', 'animated'
  round_number INT DEFAULT 1,                 -- R1, R2, R3, etc.
  revision_number INT DEFAULT 0,              -- R1.0, R1.1, R1.2, etc.

  -- Delivery method
  delivery_method VARCHAR(50) NOT NULL,       -- 'google_slides_url', 'dropbox_url', 'demo_urls'
  google_slides_url TEXT,
  dropbox_url TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'in_production', -- 'in_production', 'ready_for_review', 'approved', 'changes_requested'

  -- SLA tracking
  production_started_at TIMESTAMP,
  delivered_at TIMESTAMP,
  approved_at TIMESTAMP,

  -- Notes
  am_notes TEXT,                              -- AM notes about deliverable

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deliverables_campaign ON deliverables(campaign_id);
CREATE INDEX idx_deliverables_type ON deliverables(deliverable_type);
CREATE INDEX idx_deliverables_status ON deliverables(status);

COMMENT ON TABLE deliverables IS 'Static mocks or animated creatives delivered by Kargo to client';
COMMENT ON COLUMN deliverables.delivery_method IS 'How deliverable is provided: Google Slides URL, Dropbox link, or demo URLs';

-- ============================================================================
-- Table 7: Deliverable Demo URLs (Per Format/Device)
-- ============================================================================

CREATE TABLE deliverable_demo_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id UUID NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  campaign_format_id UUID NOT NULL REFERENCES campaign_formats(id) ON DELETE CASCADE,

  -- Device-specific demo URL
  device VARCHAR(50) NOT NULL,                -- 'desktop', 'mobile', 'tablet', 'ctv'
  demo_url TEXT NOT NULL,                     -- Full demo.kargo.com URL

  -- URL metadata
  kargo_creative_id VARCHAR(100),             -- ID from Kargo Marketplace/Deal Manager
  preview_uuid VARCHAR(100),                  -- UUID from demo.kargo.com URL

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(deliverable_id, campaign_format_id, device)
);

CREATE INDEX idx_demo_urls_deliverable ON deliverable_demo_urls(deliverable_id);
CREATE INDEX idx_demo_urls_campaign_format ON deliverable_demo_urls(campaign_format_id);

COMMENT ON TABLE deliverable_demo_urls IS 'Demo URLs for animated creatives (per format and device)';
COMMENT ON COLUMN deliverable_demo_urls.demo_url IS 'Full URL to demo.kargo.com preview';

-- ============================================================================
-- Table 8: Format Approvals (Hybrid Approval Tracking)
-- ============================================================================

CREATE TABLE format_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id UUID NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  campaign_format_id UUID NOT NULL REFERENCES campaign_formats(id) ON DELETE CASCADE,

  -- Approval granularity
  approval_level VARCHAR(50) NOT NULL,        -- 'format' (all devices) OR 'device' (specific device)
  device VARCHAR(50),                         -- NULL if approval_level='format', specific device if approval_level='device'

  -- Status
  status VARCHAR(50) DEFAULT 'pending',       -- 'pending', 'approved', 'rejected'

  -- Approval/Rejection
  reviewed_by VARCHAR(255),                   -- Client email
  reviewed_at TIMESTAMP,
  rejection_feedback TEXT,                    -- MANDATORY if status = 'rejected'

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_format_approvals_deliverable ON format_approvals(deliverable_id);
CREATE INDEX idx_format_approvals_format ON format_approvals(campaign_format_id);
CREATE INDEX idx_format_approvals_status ON format_approvals(status);

COMMENT ON TABLE format_approvals IS 'Hybrid approval: client can approve entire format OR specific device views';
COMMENT ON COLUMN format_approvals.approval_level IS 'format = approve all devices, device = approve specific device only';
COMMENT ON COLUMN format_approvals.rejection_feedback IS 'MANDATORY when status = rejected. Comprehensive feedback for designers.';

-- Constraint: rejection_feedback is required if status is 'rejected'
ALTER TABLE format_approvals
ADD CONSTRAINT check_rejection_feedback_required
CHECK (
  (status != 'rejected') OR
  (status = 'rejected' AND rejection_feedback IS NOT NULL AND LENGTH(TRIM(rejection_feedback)) > 0)
);

-- Constraint: device is required if approval_level is 'device'
ALTER TABLE format_approvals
ADD CONSTRAINT check_device_required_for_device_level
CHECK (
  (approval_level != 'device') OR
  (approval_level = 'device' AND device IS NOT NULL)
);

-- ============================================================================
-- Table 9: SLA Timers (Countdown Tracking)
-- ============================================================================

CREATE TABLE sla_timers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference (asset pack, deliverable, etc.)
  reference_type VARCHAR(50) NOT NULL,        -- 'asset_pack_review', 'static_mock_production', 'animated_production', 'revision'
  reference_id UUID NOT NULL,                 -- ID of asset_pack or deliverable

  -- Timer configuration
  duration_hours INT NOT NULL,                -- 48 or 24
  started_at TIMESTAMP NOT NULL,
  deadline TIMESTAMP NOT NULL,                -- Auto-calculated: started_at + duration_hours

  -- Status
  status VARCHAR(50) DEFAULT 'active',        -- 'active', 'paused', 'completed', 'expired'
  completed_at TIMESTAMP,

  -- Adjustments
  adjusted_by VARCHAR(255),                   -- AM email who adjusted SLA
  adjustment_reason TEXT,                     -- Why SLA was extended/reduced
  original_duration_hours INT,                -- Original SLA before adjustment

  -- Pause tracking (for weekends)
  paused_at TIMESTAMP,
  resumed_at TIMESTAMP,
  total_paused_hours INT DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sla_timers_reference ON sla_timers(reference_type, reference_id);
CREATE INDEX idx_sla_timers_status ON sla_timers(status);
CREATE INDEX idx_sla_timers_deadline ON sla_timers(deadline);

COMMENT ON TABLE sla_timers IS 'SLA countdown timers for deliverables (48h for initial, 24h for revisions)';
COMMENT ON COLUMN sla_timers.deadline IS 'Auto-calculated deadline accounting for adjustments and pauses';

-- ============================================================================
-- Table 10: Deliverable Revisions (Version Tracking)
-- ============================================================================

CREATE TABLE deliverable_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id UUID NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  previous_revision_id UUID REFERENCES deliverable_revisions(id) ON DELETE SET NULL,

  -- Revision metadata
  revision_label VARCHAR(50) NOT NULL,        -- 'R1', 'R1.1', 'R1.2', 'R2', etc.
  changes_summary TEXT,                       -- What changed from previous version

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deliverable_revisions_deliverable ON deliverable_revisions(deliverable_id);

COMMENT ON TABLE deliverable_revisions IS 'Track revision history for deliverables (R1, R1.1, R1.2, etc.)';

-- ============================================================================
-- Table 11: Portal Notifications (Client Notification Log)
-- ============================================================================

CREATE TABLE portal_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,

  -- Notification type
  notification_type VARCHAR(100) NOT NULL,    -- 'asset_pack_rejected', 'static_mocks_ready', 'animated_ready',
                                              -- 'changes_requested', 'all_approved', 'sla_adjusted'

  -- Content
  title VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,                            -- Link to portal or deliverable

  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,

  -- Email tracking
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_portal_notifications_campaign ON portal_notifications(campaign_id);
CREATE INDEX idx_portal_notifications_recipient ON portal_notifications(recipient_email);
CREATE INDEX idx_portal_notifications_is_read ON portal_notifications(is_read);

COMMENT ON TABLE portal_notifications IS 'Client notification log (both in-portal and email notifications)';

-- ============================================================================
-- Triggers & Functions
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_asset_packs_updated_at BEFORE UPDATE ON asset_packs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deliverables_updated_at BEFORE UPDATE ON deliverables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_format_approvals_updated_at BEFORE UPDATE ON format_approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sla_timers_updated_at BEFORE UPDATE ON sla_timers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-calculate SLA deadline
CREATE OR REPLACE FUNCTION calculate_sla_deadline()
RETURNS TRIGGER AS $$
BEGIN
  NEW.deadline = NEW.started_at + (NEW.duration_hours || ' hours')::INTERVAL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_sla_deadline BEFORE INSERT ON sla_timers
  FOR EACH ROW EXECUTE FUNCTION calculate_sla_deadline();

-- ============================================================================
-- Views for Dashboard Analytics
-- ============================================================================

-- Campaign Progress View
CREATE OR REPLACE VIEW campaign_progress AS
SELECT
  c.id as campaign_id,
  c.name as campaign_name,
  c.client_name,
  c.kargo_account_manager_email,
  c.current_phase,

  -- Asset Pack Status
  ap.status as asset_pack_status,
  ap.reviewed_at as asset_pack_reviewed_at,

  -- Deliverable Counts
  COUNT(DISTINCT CASE WHEN d.deliverable_type = 'static_mock' THEN d.id END) as static_mock_count,
  COUNT(DISTINCT CASE WHEN d.deliverable_type = 'animated' THEN d.id END) as animated_count,

  -- Approval Progress
  COUNT(DISTINCT fa.id) FILTER (WHERE fa.status = 'approved') as approved_count,
  COUNT(DISTINCT fa.id) FILTER (WHERE fa.status = 'pending') as pending_count,
  COUNT(DISTINCT fa.id) FILTER (WHERE fa.status = 'rejected') as rejected_count,

  -- Active SLA
  sla.deadline as active_sla_deadline,
  sla.status as active_sla_status

FROM campaigns c
LEFT JOIN asset_packs ap ON ap.campaign_id = c.id
LEFT JOIN deliverables d ON d.campaign_id = c.id
LEFT JOIN format_approvals fa ON fa.deliverable_id = d.id
LEFT JOIN sla_timers sla ON sla.reference_type IN ('static_mock_production', 'animated_production', 'revision')
  AND sla.status = 'active'
GROUP BY c.id, ap.status, ap.reviewed_at, sla.deadline, sla.status;

-- At-Risk Campaigns (SLA approaching deadline)
CREATE OR REPLACE VIEW campaigns_at_risk AS
SELECT
  c.id as campaign_id,
  c.name as campaign_name,
  c.kargo_account_manager_email,
  sla.deadline,
  EXTRACT(EPOCH FROM (sla.deadline - NOW())) / 3600 as hours_remaining,
  sla.reference_type
FROM campaigns c
JOIN sla_timers sla ON sla.reference_id IN (
  SELECT id FROM deliverables WHERE campaign_id = c.id
)
WHERE sla.status = 'active'
  AND sla.deadline < NOW() + INTERVAL '6 hours'
ORDER BY sla.deadline ASC;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON VIEW campaign_progress IS 'Dashboard view showing campaign phase, approval progress, and SLA status';
COMMENT ON VIEW campaigns_at_risk IS 'Campaigns with SLA deadlines approaching within 6 hours';
