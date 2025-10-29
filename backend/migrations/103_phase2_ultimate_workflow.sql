/**
 * Phase 2 Ultimate Workflow Migration
 *
 * Implements the 4 core enhancements from KUDA Ultimate Workflow:
 * 1. Three-tier access control (Kuda Ocean/River/Minnow)
 * 2. Smart notification timing (Tue-Thu 10AM-4PM)
 * 3. Email threading & automation
 * 4. Auto-generated revision changelogs
 */

-- ============================================================================
-- TABLE 1: campaign_access (Three-Tier Access Control)
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  access_tier VARCHAR(20) NOT NULL CHECK (access_tier IN ('kuda_ocean', 'kuda_river', 'kuda_minnow')),
  granted_by VARCHAR(255) NOT NULL,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for access control queries
CREATE INDEX idx_campaign_access_campaign ON campaign_access(campaign_id);
CREATE INDEX idx_campaign_access_user ON campaign_access(user_email);
CREATE INDEX idx_campaign_access_tier ON campaign_access(access_tier);
CREATE INDEX idx_campaign_access_active ON campaign_access(is_active) WHERE is_active = TRUE;

-- Composite index for fast access checks
CREATE INDEX idx_campaign_access_lookup ON campaign_access(campaign_id, user_email, is_active);

-- Comments for access tiers
COMMENT ON COLUMN campaign_access.access_tier IS
'Three-tier access model:
- kuda_ocean: Full platform control (AMs, designers, engineers)
- kuda_river: Client approval interface (client stakeholders)
- kuda_minnow: View-only access (observers, stakeholders)';

-- ============================================================================
-- TABLE 2: email_threads (Email Threading & Automation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  thread_id VARCHAR(255) NOT NULL UNIQUE, -- Gmail thread ID
  subject VARCHAR(500) NOT NULL,
  thread_type VARCHAR(50) NOT NULL CHECK (thread_type IN (
    'campaign_kickoff',
    'asset_pack_submission',
    'asset_pack_feedback',
    'deliverable_submission',
    'deliverable_feedback',
    'revision_submission',
    'final_approval'
  )),
  gmail_message_ids JSONB DEFAULT '[]'::JSONB, -- Array of Gmail message IDs
  participants JSONB NOT NULL, -- {to: [], cc: [], bcc: []}
  total_messages INTEGER DEFAULT 0,
  last_message_at TIMESTAMP,
  thread_status VARCHAR(50) DEFAULT 'active' CHECK (thread_status IN ('active', 'resolved', 'archived')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for email threading
CREATE INDEX idx_email_threads_campaign ON email_threads(campaign_id);
CREATE INDEX idx_email_threads_thread_id ON email_threads(thread_id);
CREATE INDEX idx_email_threads_type ON email_threads(thread_type);
CREATE INDEX idx_email_threads_status ON email_threads(thread_status);

-- Composite index for thread lookups
CREATE INDEX idx_email_threads_campaign_type ON email_threads(campaign_id, thread_type);

COMMENT ON COLUMN email_threads.thread_id IS
'Gmail thread ID for maintaining single thread continuity from campaign creation through final approval';

COMMENT ON COLUMN email_threads.gmail_message_ids IS
'Array of Gmail message IDs in chronological order. Used for thread reconstruction and reply threading.';

-- ============================================================================
-- TABLE 3: notification_schedule (Smart Notification Timing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type VARCHAR(100) NOT NULL,
  reference_type VARCHAR(50) NOT NULL, -- 'campaign', 'asset_pack', 'deliverable'
  reference_id UUID NOT NULL,
  sender_tier VARCHAR(20) CHECK (sender_tier IN ('kuda_ocean', 'system')),
  recipients JSONB NOT NULL, -- {to: [], cc: [], bcc: []}
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  html_body TEXT,
  template_name VARCHAR(100),
  template_data JSONB,

  -- Timing control
  requested_send_time TIMESTAMP NOT NULL,
  calculated_send_time TIMESTAMP NOT NULL,
  actual_send_time TIMESTAMP,

  -- Smart timing metadata
  timing_rule_applied VARCHAR(100), -- 'immediate', 'tuesday_10am', 'next_optimal_window'
  was_delayed BOOLEAN DEFAULT FALSE,
  delay_reason VARCHAR(255),

  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for notification scheduling
CREATE INDEX idx_notification_schedule_calculated_time ON notification_schedule(calculated_send_time) WHERE status = 'pending';
CREATE INDEX idx_notification_schedule_status ON notification_schedule(status);
CREATE INDEX idx_notification_schedule_reference ON notification_schedule(reference_type, reference_id);
CREATE INDEX idx_notification_schedule_type ON notification_schedule(notification_type);

-- Composite index for scheduled job processing
CREATE INDEX idx_notification_schedule_processing ON notification_schedule(status, calculated_send_time)
  WHERE status = 'pending';

COMMENT ON COLUMN notification_schedule.calculated_send_time IS
'Final send time after applying smart timing rules (Tue-Thu 10AM-4PM).
Kuda Ocean tier and rejection emails bypass smart timing for immediate send.';

COMMENT ON COLUMN notification_schedule.timing_rule_applied IS
'Tracks which timing rule was applied:
- immediate: Kuda Ocean or rejection email (bypass smart timing)
- friday_pm_to_tuesday: Friday after 4PM → Tuesday 10AM
- weekend_to_tuesday: Saturday/Sunday → Tuesday 10AM
- monday_to_tuesday: Monday → Tuesday 10AM (avoid Monday inbox overload)
- next_optimal_window: Scheduled for next Tue-Thu 10-11AM window';

-- ============================================================================
-- TABLE 4: revision_changelogs (Auto-Generated Revision Changelogs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS revision_changelogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id UUID NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  previous_version_id UUID REFERENCES deliverables(id),

  -- Change detection categories
  changes_detected JSONB NOT NULL, -- {font: [], color: [], layout: [], copy: [], video: []}
  total_changes INTEGER NOT NULL DEFAULT 0,

  -- Auto-generated changelog text
  changelog_text TEXT NOT NULL,
  changelog_html TEXT,

  -- Metadata
  generated_by VARCHAR(50) DEFAULT 'auto', -- 'auto' or 'manual'
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure one changelog per revision
  UNIQUE(deliverable_id, revision_number)
);

-- Indexes for changelog queries
CREATE INDEX idx_revision_changelogs_deliverable ON revision_changelogs(deliverable_id);
CREATE INDEX idx_revision_changelogs_revision ON revision_changelogs(revision_number);
CREATE INDEX idx_revision_changelogs_previous ON revision_changelogs(previous_version_id);

COMMENT ON COLUMN revision_changelogs.changes_detected IS
'Categorized changes detected between revisions:
{
  "font": ["Changed heading from Arial to Helvetica", "Updated body text size from 14px to 16px"],
  "color": ["Primary brand color updated from #0066CC to #0055BB"],
  "layout": ["Repositioned logo 20px higher", "Increased CTA button size"],
  "copy": ["Updated headline from X to Y", "Fixed typo in disclaimer"],
  "video": ["Extended video duration from 15s to 30s", "Updated video codec"]
}';

COMMENT ON COLUMN revision_changelogs.changelog_text IS
'Plain text version of auto-generated changelog for email inclusion.
Format: "WHAT CHANGED (X changes): Font (2 changes): ..., Color (1 change): ..., etc."';

-- ============================================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================================

-- Update updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all Phase 2 tables
CREATE TRIGGER update_campaign_access_updated_at BEFORE UPDATE ON campaign_access
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_threads_updated_at BEFORE UPDATE ON email_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_schedule_updated_at BEFORE UPDATE ON notification_schedule
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_revision_changelogs_updated_at BEFORE UPDATE ON revision_changelogs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MATERIALIZED VIEW: Phase 2 Performance Analytics
-- ============================================================================

CREATE MATERIALIZED VIEW phase2_workflow_analytics AS
SELECT
  DATE_TRUNC('day', c.created_at) as workflow_date,

  -- Campaign metrics
  COUNT(DISTINCT c.id) as total_campaigns,

  -- Access control metrics
  AVG((SELECT COUNT(*) FROM campaign_access ca WHERE ca.campaign_id = c.id AND ca.access_tier = 'kuda_ocean' AND ca.is_active = TRUE)) as avg_ocean_users,
  AVG((SELECT COUNT(*) FROM campaign_access ca WHERE ca.campaign_id = c.id AND ca.access_tier = 'kuda_river' AND ca.is_active = TRUE)) as avg_river_users,
  AVG((SELECT COUNT(*) FROM campaign_access ca WHERE ca.campaign_id = c.id AND ca.access_tier = 'kuda_minnow' AND ca.is_active = TRUE)) as avg_minnow_users,

  -- Email threading metrics
  AVG((SELECT COUNT(*) FROM email_threads et WHERE et.campaign_id = c.id)) as avg_email_threads_per_campaign,
  AVG((SELECT SUM(total_messages) FROM email_threads et WHERE et.campaign_id = c.id)) as avg_total_emails,

  -- Smart timing metrics
  COUNT(CASE WHEN EXISTS(
    SELECT 1 FROM notification_schedule ns
    WHERE ns.reference_type = 'campaign' AND ns.reference_id = c.id AND ns.was_delayed = TRUE
  ) THEN 1 END) as campaigns_with_delayed_notifications,

  -- Revision metrics
  AVG((SELECT COUNT(*) FROM revision_changelogs rc
       JOIN deliverables d ON rc.deliverable_id = d.id
       WHERE d.campaign_id = c.id)) as avg_revisions_per_campaign

FROM campaigns c
WHERE c.created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', c.created_at)
ORDER BY workflow_date DESC;

-- Index on materialized view
CREATE INDEX idx_phase2_analytics_date ON phase2_workflow_analytics(workflow_date DESC);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_phase2_analytics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY phase2_workflow_analytics;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED DATA: Default Access Tiers for Testing
-- ============================================================================

-- Note: This is commented out for production. Uncomment for development/testing.
-- INSERT INTO campaign_access (campaign_id, user_email, access_tier, granted_by, notes)
-- VALUES
--   ('[test-campaign-id]', 'am@kargo.com', 'kuda_ocean', 'system', 'Account Manager - full control'),
--   ('[test-campaign-id]', 'designer@kargo.com', 'kuda_ocean', 'system', 'Designer - full control'),
--   ('[test-campaign-id]', 'client@amazon.com', 'kuda_river', 'am@kargo.com', 'Client approver'),
--   ('[test-campaign-id]', 'observer@amazon.com', 'kuda_minnow', 'am@kargo.com', 'Client observer');

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify all tables created
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('campaign_access', 'email_threads', 'notification_schedule', 'revision_changelogs');

  IF table_count = 4 THEN
    RAISE NOTICE 'Phase 2 Migration Success: All 4 tables created';
  ELSE
    RAISE WARNING 'Phase 2 Migration Warning: Only % of 4 tables created', table_count;
  END IF;
END $$;
