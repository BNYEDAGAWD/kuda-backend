-- Migration: Package Tracking System
-- Purpose: Track creative packages (R1 Static Mocks, R2 Animated, etc.)
-- Enables package-level workflow where R2 cannot be uploaded until R1 is approved
-- Based on real-world workflow: Google Slides deck + individual creatives per package

-- Creative Packages Table
CREATE TABLE IF NOT EXISTS creative_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  -- Package identification
  package_name VARCHAR(500) NOT NULL,        -- "R1 Static Mocks - 10.24.25"
  version VARCHAR(50),                       -- "R1", "R2", "Final", etc.
  package_type VARCHAR(100),                 -- "static_mocks", "animated", "final_delivery"

  -- Package metadata
  uploaded_by VARCHAR(255) NOT NULL,         -- Client email
  presentation_file_url VARCHAR(1000),       -- Link to Google Slides deck or PDF
  presentation_s3_key VARCHAR(1000),         -- S3 key if uploaded directly

  -- Package statistics (auto-updated via triggers)
  total_creatives INT DEFAULT 0,
  pending_count INT DEFAULT 0,
  approved_count INT DEFAULT 0,
  rejected_count INT DEFAULT 0,
  needs_changes_count INT DEFAULT 0,

  -- Package status
  status VARCHAR(50) DEFAULT 'pending',      -- pending, approved, rejected, needs_changes

  -- Workflow dependencies
  depends_on_package_id UUID REFERENCES creative_packages(id),  -- R2 depends on R1
  blocks_campaign_launch BOOLEAN DEFAULT false,                 -- Must be approved before launch

  -- Notes
  client_notes TEXT,
  internal_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  all_approved_at TIMESTAMP                  -- When last creative in package was approved
);

-- Add package_id to creatives table
ALTER TABLE creatives
ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES creative_packages(id) ON DELETE SET NULL;

-- Create index for package lookups
CREATE INDEX IF NOT EXISTS idx_creatives_package_id ON creatives(package_id);
CREATE INDEX IF NOT EXISTS idx_packages_campaign_id ON creative_packages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_packages_status ON creative_packages(status);
CREATE INDEX IF NOT EXISTS idx_packages_depends_on ON creative_packages(depends_on_package_id);

-- Function to update package statistics
CREATE OR REPLACE FUNCTION update_package_statistics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.package_id IS NOT NULL THEN
    UPDATE creative_packages
    SET
      total_creatives = (
        SELECT COUNT(*) FROM creatives WHERE package_id = NEW.package_id
      ),
      pending_count = (
        SELECT COUNT(*) FROM creatives WHERE package_id = NEW.package_id AND status = 'pending'
      ),
      approved_count = (
        SELECT COUNT(*) FROM creatives WHERE package_id = NEW.package_id AND status = 'approved'
      ),
      rejected_count = (
        SELECT COUNT(*) FROM creatives WHERE package_id = NEW.package_id AND status = 'rejected'
      ),
      needs_changes_count = (
        SELECT COUNT(*) FROM creatives WHERE package_id = NEW.package_id AND status = 'needs_changes'
      ),
      updated_at = NOW()
    WHERE id = NEW.package_id;

    -- Update package status based on creative statuses
    UPDATE creative_packages
    SET status = CASE
      -- All approved
      WHEN (SELECT COUNT(*) FROM creatives WHERE package_id = NEW.package_id AND status = 'approved') =
           (SELECT COUNT(*) FROM creatives WHERE package_id = NEW.package_id)
        THEN 'approved'
      -- Any rejected
      WHEN (SELECT COUNT(*) FROM creatives WHERE package_id = NEW.package_id AND status = 'rejected') > 0
        THEN 'rejected'
      -- Any needs changes
      WHEN (SELECT COUNT(*) FROM creatives WHERE package_id = NEW.package_id AND status = 'needs_changes') > 0
        THEN 'needs_changes'
      -- Otherwise pending
      ELSE 'pending'
    END,
    all_approved_at = CASE
      WHEN (SELECT COUNT(*) FROM creatives WHERE package_id = NEW.package_id AND status = 'approved') =
           (SELECT COUNT(*) FROM creatives WHERE package_id = NEW.package_id)
        THEN NOW()
      ELSE all_approved_at
    END
    WHERE id = NEW.package_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update package statistics when creatives change
DROP TRIGGER IF EXISTS update_package_stats_trigger ON creatives;
CREATE TRIGGER update_package_stats_trigger
AFTER INSERT OR UPDATE OF status ON creatives
FOR EACH ROW
EXECUTE FUNCTION update_package_statistics();

-- Package Dependency Check Function
-- Prevents R2 upload if R1 not approved
CREATE OR REPLACE FUNCTION check_package_dependency()
RETURNS TRIGGER AS $$
DECLARE
  dependent_package_status VARCHAR(50);
BEGIN
  IF NEW.depends_on_package_id IS NOT NULL THEN
    SELECT status INTO dependent_package_status
    FROM creative_packages
    WHERE id = NEW.depends_on_package_id;

    IF dependent_package_status != 'approved' THEN
      RAISE EXCEPTION 'Cannot upload package %. Dependent package must be fully approved first.', NEW.package_name;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce package dependencies
DROP TRIGGER IF EXISTS enforce_package_dependency_trigger ON creative_packages;
CREATE TRIGGER enforce_package_dependency_trigger
BEFORE INSERT ON creative_packages
FOR EACH ROW
EXECUTE FUNCTION check_package_dependency();

-- View: Package Dashboard
CREATE OR REPLACE VIEW package_dashboard AS
SELECT
  cp.id,
  cp.package_name,
  cp.version,
  cp.package_type,
  cp.status,
  cp.campaign_id,
  c.name as campaign_name,
  c.client_name,
  c.kargo_account_manager_email,
  cp.total_creatives,
  cp.pending_count,
  cp.approved_count,
  cp.rejected_count,
  cp.needs_changes_count,
  cp.blocks_campaign_launch,
  cp.depends_on_package_id,
  dep.package_name as depends_on_package_name,
  dep.status as dependent_package_status,
  cp.created_at,
  cp.all_approved_at,
  CASE
    WHEN cp.depends_on_package_id IS NOT NULL AND dep.status != 'approved'
      THEN 'blocked'
    WHEN cp.status = 'pending' AND cp.blocks_campaign_launch
      THEN 'critical'
    WHEN cp.status = 'needs_changes'
      THEN 'action_required'
    ELSE 'normal'
  END as priority_level
FROM creative_packages cp
JOIN campaigns c ON c.id = cp.campaign_id
LEFT JOIN creative_packages dep ON dep.id = cp.depends_on_package_id;

-- View: Campaign Package Progress
CREATE OR REPLACE VIEW campaign_package_progress AS
SELECT
  campaign_id,
  COUNT(*) as total_packages,
  COUNT(*) FILTER (WHERE status = 'approved') as approved_packages,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_packages,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_packages,
  COUNT(*) FILTER (WHERE status = 'needs_changes') as needs_changes_packages,
  COUNT(*) FILTER (WHERE blocks_campaign_launch AND status != 'approved') as blocking_packages,
  SUM(total_creatives) as total_creatives_across_packages,
  SUM(approved_count) as total_approved_creatives
FROM creative_packages
GROUP BY campaign_id;

-- Comments for documentation
COMMENT ON TABLE creative_packages IS 'Tracks packages of related creatives (e.g., R1 Static Mocks, R2 Animated)';
COMMENT ON COLUMN creative_packages.depends_on_package_id IS 'Enforces workflow: R2 cannot be uploaded until R1 approved';
COMMENT ON COLUMN creative_packages.blocks_campaign_launch IS 'If true, campaign cannot launch until this package approved';
COMMENT ON COLUMN creative_packages.presentation_file_url IS 'Link to Google Slides deck or PDF presentation';
COMMENT ON COLUMN creative_packages.all_approved_at IS 'Timestamp when all creatives in package were approved';

-- Sample data for testing (commented out for production)
-- INSERT INTO creative_packages (
--   campaign_id,
--   package_name,
--   version,
--   package_type,
--   uploaded_by,
--   blocks_campaign_launch
-- ) VALUES (
--   '00000000-0000-0000-0000-000000000001',
--   'R1 Static Mocks - 10.24.25',
--   'R1',
--   'static_mocks',
--   'client@example.com',
--   true
-- );
