-- Creative Approval Workflow Automation System
-- Initial Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'account_manager', 'client')),
  google_oauth_sub VARCHAR(255) UNIQUE,
  client_company VARCHAR(255),
  active BOOLEAN DEFAULT true,
  notification_preferences JSONB DEFAULT '{"email": true, "digest": false}',
  created_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(active);

-- Campaigns table
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  kargo_account_manager_email VARCHAR(255) NOT NULL,
  start_date DATE,
  end_date DATE,
  budget DECIMAL(12, 2),
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  celtra_integration_enabled BOOLEAN DEFAULT true,
  default_landing_url VARCHAR(1000),
  tracking_pixels JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_campaigns_client ON campaigns(client_name);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_manager ON campaigns(kargo_account_manager_email);

-- Creatives table
CREATE TABLE creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  creative_type VARCHAR(50) NOT NULL CHECK (creative_type IN ('display', 'video', 'native', 'ctv', 'audio')),
  dimensions VARCHAR(50),
  s3_file_key VARCHAR(500) NOT NULL,
  s3_file_url VARCHAR(1000) NOT NULL,
  file_size_bytes BIGINT,
  mime_type VARCHAR(100),
  landing_url VARCHAR(1000),
  demo_link VARCHAR(1000),
  celtra_creative_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_changes')),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  submitted_by VARCHAR(255) NOT NULL,
  submitted_at TIMESTAMP DEFAULT NOW(),
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  client_notes TEXT,
  internal_notes TEXT,
  tags_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_creatives_campaign ON creatives(campaign_id);
CREATE INDEX idx_creatives_status ON creatives(status);
CREATE INDEX idx_creatives_submitted_at ON creatives(submitted_at DESC);
CREATE INDEX idx_creatives_priority ON creatives(priority);
CREATE INDEX idx_creatives_submitted_by ON creatives(submitted_by);

-- Approval history table
CREATE TABLE approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id UUID NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'changes_requested', 'revised')),
  actor_email VARCHAR(255) NOT NULL,
  actor_role VARCHAR(50) CHECK (actor_role IN ('account_manager', 'client', 'admin')),
  feedback TEXT,
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_approval_history_creative ON approval_history(creative_id);
CREATE INDEX idx_approval_history_created ON approval_history(created_at DESC);
CREATE INDEX idx_approval_history_actor ON approval_history(actor_email);

-- Generated tags table
CREATE TABLE generated_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creative_id UUID NOT NULL REFERENCES creatives(id) ON DELETE CASCADE,
  tag_type VARCHAR(50) NOT NULL CHECK (tag_type IN ('celtra', 'custom', 'tracking', 'display', 'video')),
  tag_code TEXT NOT NULL,
  celtra_pixel_included BOOLEAN DEFAULT false,
  generated_by VARCHAR(255) NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW(),
  version INT DEFAULT 1,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_tags_creative ON generated_tags(creative_id);
CREATE INDEX idx_tags_version ON generated_tags(creative_id, version DESC);

-- Client portal tokens table
CREATE TABLE client_portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  client_email VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  last_accessed_at TIMESTAMP,
  access_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_portal_tokens_token ON client_portal_tokens(token);
CREATE INDEX idx_portal_tokens_expires ON client_portal_tokens(expires_at);
CREATE INDEX idx_portal_tokens_campaign ON client_portal_tokens(campaign_id);

-- System settings table
CREATE TABLE system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Email logs table
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  template_name VARCHAR(100),
  status VARCHAR(50) CHECK (status IN ('sent', 'failed', 'bounced', 'queued')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_email_logs_recipient ON email_logs(recipient);
CREATE INDEX idx_email_logs_sent_at ON email_logs(sent_at DESC);
CREATE INDEX idx_email_logs_status ON email_logs(status);

-- Functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_creatives_updated_at BEFORE UPDATE ON creatives
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for dashboard metrics
CREATE OR REPLACE VIEW dashboard_metrics AS
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
  COUNT(*) FILTER (WHERE status = 'needs_changes') as needs_changes_count,
  AVG(EXTRACT(EPOCH FROM (approved_at - submitted_at)) / 3600) FILTER (WHERE approved_at IS NOT NULL) as avg_approval_time_hours,
  COUNT(DISTINCT campaign_id) as active_campaigns
FROM creatives
WHERE submitted_at >= NOW() - INTERVAL '30 days';

-- View for approval analytics
CREATE OR REPLACE VIEW approval_analytics AS
SELECT
  c.campaign_id,
  cmp.name as campaign_name,
  cmp.client_name,
  COUNT(*) as total_creatives,
  COUNT(*) FILTER (WHERE c.status = 'approved') as approved_count,
  COUNT(*) FILTER (WHERE c.status = 'rejected') as rejected_count,
  COUNT(*) FILTER (WHERE c.status = 'pending') as pending_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE c.status = 'approved') / NULLIF(COUNT(*), 0), 2) as approval_rate,
  AVG(EXTRACT(EPOCH FROM (c.approved_at - c.submitted_at)) / 3600) FILTER (WHERE c.approved_at IS NOT NULL) as avg_approval_hours
FROM creatives c
JOIN campaigns cmp ON c.campaign_id = cmp.id
GROUP BY c.campaign_id, cmp.name, cmp.client_name;

-- Insert default admin user (password: admin123 - CHANGE IN PRODUCTION!)
INSERT INTO users (email, full_name, role, active)
VALUES ('admin@kargo.com', 'System Admin', 'admin', true);

-- Insert default system settings
INSERT INTO system_settings (key, value, description) VALUES
('max_file_size_mb', '50', 'Maximum file upload size in MB'),
('client_portal_token_expiry_days', '30', 'Number of days before client portal tokens expire'),
('email_rate_limit_per_hour', '100', 'Maximum emails sent per hour'),
('auto_tag_generation', 'true', 'Automatically generate tags on approval'),
('celtra_integration_enabled', 'true', 'Enable Celtra API integration for tag generation');

COMMIT;
