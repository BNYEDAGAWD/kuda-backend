-- Enhanced Asset Management System
-- Migration 002: Transform simple creative approval into comprehensive digital asset management
-- This migration adds asset packages, intelligent categorization, and advanced organization

-- ==============================================================================
-- ASSET PACKAGES TABLE
-- ==============================================================================
-- Top-level container for bulk asset uploads (ZIP files, folders, complete packages)

CREATE TABLE asset_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  -- Package metadata
  package_name VARCHAR(500) NOT NULL,
  package_type VARCHAR(100), -- display, video, mixed, brand_guidelines, product_imagery, revision
  version VARCHAR(50), -- v1, v2, v3, etc.

  -- Package statistics
  total_files INT DEFAULT 0,
  total_size_bytes BIGINT DEFAULT 0,
  final_creative_count INT DEFAULT 0, -- How many are ready for approval
  source_file_count INT DEFAULT 0, -- How many are source/working files

  -- Storage organization
  s3_folder_path VARCHAR(500), -- Base folder in S3 for this package

  -- Processing status
  status VARCHAR(50) DEFAULT 'processing' CHECK (status IN ('uploading', 'processing', 'ready', 'approved', 'archived')),
  processing_started_at TIMESTAMP,
  processing_completed_at TIMESTAMP,
  processing_error TEXT,

  -- Upload metadata
  uploaded_by VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  notes TEXT, -- Client notes about this package

  -- External references (Figma, Google Drive links, etc.)
  external_links JSONB DEFAULT '[]', -- Array of {type, url, title, description}

  -- Full metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_asset_packages_campaign ON asset_packages(campaign_id);
CREATE INDEX idx_asset_packages_status ON asset_packages(status);
CREATE INDEX idx_asset_packages_uploaded_at ON asset_packages(uploaded_at DESC);
CREATE INDEX idx_asset_packages_type ON asset_packages(package_type);

-- ==============================================================================
-- ASSETS TABLE (Enhanced replacement for creatives table)
-- ==============================================================================
-- Individual files with intelligent categorization and organization

CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID REFERENCES asset_packages(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,

  -- File identification
  original_filename VARCHAR(500) NOT NULL, -- Exactly as uploaded
  organized_filename VARCHAR(500), -- Auto-generated clean name
  file_hash VARCHAR(64), -- SHA-256 for duplicate detection

  -- Intelligent categorization
  file_category VARCHAR(100), -- display_creative, video_creative, source_file, brand_guideline, font, product_image, etc.
  file_subcategory VARCHAR(100), -- banner, native, video_15s, logo, product_shot, photoshop, illustrator, etc.
  confidence_score DECIMAL(3,2), -- How confident the auto-categorization is (0.00-1.00)

  -- Storage
  s3_file_key VARCHAR(500) NOT NULL,
  s3_file_url VARCHAR(1000),
  file_size_bytes BIGINT,
  mime_type VARCHAR(100),
  file_extension VARCHAR(20),

  -- Extracted metadata (auto-populated by processing service)
  dimensions VARCHAR(50), -- For images/videos (e.g., "1920x1080")
  width INT, -- Numeric width for queries
  height INT, -- Numeric height for queries
  duration_seconds INT, -- For videos/audio
  color_space VARCHAR(50), -- RGB, CMYK, etc.
  has_transparency BOOLEAN DEFAULT false, -- For images
  has_layers BOOLEAN DEFAULT false, -- For PSD/AI/Sketch files
  layer_count INT, -- Number of layers if applicable
  dpi INT, -- For print assets
  codec VARCHAR(50), -- For video files
  bitrate BIGINT, -- For video/audio files
  frame_rate DECIMAL(5,2), -- For videos (e.g., 29.97, 60.00)

  -- Creative-specific fields (only applicable if is_final_creative = true)
  is_final_creative BOOLEAN DEFAULT false, -- True if this is ready for approval workflow
  creative_type VARCHAR(50), -- display, video, native, ctv, audio
  landing_url VARCHAR(1000),
  demo_link VARCHAR(1000),
  celtra_creative_id VARCHAR(255),

  -- Approval workflow (only for final creatives)
  approval_status VARCHAR(50) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_changes', 'not_applicable')),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  client_feedback TEXT,
  internal_notes TEXT,

  -- Organization & discovery
  folder_path VARCHAR(1000), -- Original folder structure from ZIP/upload
  organized_path VARCHAR(1000), -- Auto-organized path (e.g., "display/banners/300x250/")
  tags TEXT[], -- Auto-generated searchable tags

  -- Processing status
  processing_status VARCHAR(50) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'ready', 'failed', 'skipped')),
  processing_error TEXT,
  thumbnail_url VARCHAR(1000), -- Auto-generated preview thumbnail
  preview_url VARCHAR(1000), -- For videos, a preview clip

  -- Versioning
  version INT DEFAULT 1,
  parent_asset_id UUID REFERENCES assets(id), -- If this is a revision of another asset
  is_latest_version BOOLEAN DEFAULT true,

  -- Full metadata storage
  extracted_metadata JSONB DEFAULT '{}', -- All extracted metadata in structured format

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_assets_package ON assets(package_id);
CREATE INDEX idx_assets_campaign ON assets(campaign_id);
CREATE INDEX idx_assets_category ON assets(file_category);
CREATE INDEX idx_assets_subcategory ON assets(file_subcategory);
CREATE INDEX idx_assets_final_creative ON assets(is_final_creative);
CREATE INDEX idx_assets_approval_status ON assets(approval_status) WHERE is_final_creative = true;
CREATE INDEX idx_assets_tags ON assets USING GIN(tags);
CREATE INDEX idx_assets_dimensions ON assets(width, height) WHERE width IS NOT NULL;
CREATE INDEX idx_assets_hash ON assets(file_hash); -- Duplicate detection
CREATE INDEX idx_assets_organized_path ON assets(organized_path);

-- ==============================================================================
-- FILE TAXONOMY RULES
-- ==============================================================================
-- Intelligent rules for auto-categorizing and organizing files

CREATE TABLE file_taxonomy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Matching criteria
  pattern VARCHAR(500) NOT NULL, -- Regex pattern for filename matching
  mime_type_pattern VARCHAR(200), -- Optional MIME type filter

  -- Categorization
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  suggested_folder VARCHAR(200), -- Where to organize this type of file

  -- Tags to apply
  auto_tags TEXT[], -- Tags automatically added to matching files

  -- Rule behavior
  priority INT DEFAULT 0, -- Higher priority rules checked first
  is_final_creative BOOLEAN DEFAULT false, -- Mark matching files as final creatives
  confidence_boost DECIMAL(3,2) DEFAULT 0.00, -- Boost confidence score by this amount

  -- Rule metadata
  active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_taxonomy_rules_priority ON file_taxonomy_rules(priority DESC) WHERE active = true;
CREATE INDEX idx_taxonomy_rules_category ON file_taxonomy_rules(category);

-- ==============================================================================
-- SEED FILE TAXONOMY RULES
-- ==============================================================================

INSERT INTO file_taxonomy_rules (pattern, category, subcategory, suggested_folder, auto_tags, is_final_creative, priority, description) VALUES

-- Display Creatives (High Priority - Very Specific)
('.*[-_]300x250\.(jpg|jpeg|png|gif)$', 'display_creative', 'banner_300x250', 'display/banners/300x250', ARRAY['display', 'banner', '300x250', 'final'], true, 100, 'Display banner 300x250 final creative'),
('.*[-_]728x90\.(jpg|jpeg|png|gif)$', 'display_creative', 'banner_728x90', 'display/banners/728x90', ARRAY['display', 'banner', '728x90', 'leaderboard', 'final'], true, 100, 'Display leaderboard 728x90 final creative'),
('.*[-_]970x250\.(jpg|jpeg|png|gif)$', 'display_creative', 'billboard_970x250', 'display/billboards/970x250', ARRAY['display', 'billboard', '970x250', 'final'], true, 100, 'Display billboard 970x250 final creative'),
('.*[-_]160x600\.(jpg|jpeg|png|gif)$', 'display_creative', 'skyscraper_160x600', 'display/skyscrapers/160x600', ARRAY['display', 'skyscraper', '160x600', 'final'], true, 100, 'Display skyscraper 160x600 final creative'),
('.*[-_]320x50\.(jpg|jpeg|png|gif)$', 'display_creative', 'mobile_banner_320x50', 'display/mobile/320x50', ARRAY['display', 'mobile', 'banner', '320x50', 'final'], true, 100, 'Mobile banner 320x50 final creative'),
('.*[-_]1200x628\.(jpg|jpeg|png|gif)$', 'display_creative', 'native_1200x628', 'display/native/1200x628', ARRAY['display', 'native', 'social', '1200x628', 'final'], true, 100, 'Native ad 1200x628 final creative'),

-- Video Creatives
('.*[-_]15s?\.(mp4|mov)$', 'video_creative', 'video_15s', 'video/15s', ARRAY['video', '15sec', 'final'], true, 95, '15-second video creative'),
('.*[-_]30s?\.(mp4|mov)$', 'video_creative', 'video_30s', 'video/30s', ARRAY['video', '30sec', 'final'], true, 95, '30-second video creative'),
('.*[-_]60s?\.(mp4|mov)$', 'video_creative', 'video_60s', 'video/60s', ARRAY['video', '60sec', 'final'], true, 95, '60-second video creative'),
('.*[-_]6s?\.(mp4|mov)$', 'video_creative', 'video_6s', 'video/6s', ARRAY['video', '6sec', 'bumper', 'final'], true, 95, '6-second bumper video'),
('.*[-_]16x9\.(mp4|mov)$', 'video_creative', 'video_16x9', 'video/16x9', ARRAY['video', '16:9', 'landscape', 'final'], true, 93, '16:9 aspect ratio video'),
('.*[-_]9x16\.(mp4|mov)$', 'video_creative', 'video_9x16', 'video/9x16', ARRAY['video', '9:16', 'vertical', 'stories', 'final'], true, 93, '9:16 vertical video'),
('.*[-_]1x1\.(mp4|mov)$', 'video_creative', 'video_1x1', 'video/1x1', ARRAY['video', '1:1', 'square', 'final'], true, 93, '1:1 square video'),

-- Generic video (lower priority)
('.*\.(mp4|mov|avi|mkv|webm)$', 'video_creative', 'video', 'video/final', ARRAY['video', 'final'], true, 90, 'Video creative (generic)'),

-- Source Files - Photoshop
('.*\.psd$', 'source_file', 'photoshop', 'source/photoshop', ARRAY['source', 'psd', 'layered', 'editable'], false, 80, 'Photoshop source file'),

-- Source Files - Illustrator
('.*\.ai$', 'source_file', 'illustrator', 'source/illustrator', ARRAY['source', 'ai', 'vector', 'editable'], false, 80, 'Illustrator source file'),

-- Source Files - Sketch
('.*\.sketch$', 'source_file', 'sketch', 'source/sketch', ARRAY['source', 'sketch', 'ui', 'editable'], false, 80, 'Sketch source file'),

-- Source Files - XD
('.*\.xd$', 'source_file', 'adobe_xd', 'source/xd', ARRAY['source', 'xd', 'adobe', 'editable'], false, 80, 'Adobe XD source file'),

-- Source Files - Video Source
('.*[-_](source|raw|uncompressed)\.(mov|avi|mxf)$', 'source_file', 'video_source', 'source/video', ARRAY['source', 'video', 'raw', 'uncompressed'], false, 82, 'Video source file'),

-- Brand Guidelines
('.*brand[-_]?guide.*\.pdf$', 'brand_guideline', 'brand_guide', 'brand/guidelines', ARRAY['brand', 'guidelines', 'documentation'], false, 85, 'Brand guidelines PDF'),
('.*style[-_]?guide.*\.pdf$', 'brand_guideline', 'style_guide', 'brand/guidelines', ARRAY['brand', 'style', 'guidelines'], false, 85, 'Style guide PDF'),
('.*logo[-_]?guide.*\.pdf$', 'brand_guideline', 'logo_guide', 'brand/guidelines', ARRAY['brand', 'logo', 'guidelines'], false, 85, 'Logo usage guidelines'),
('.*color[-_]?palette.*\.(pdf|ai|psd)$', 'brand_guideline', 'color_palette', 'brand/colors', ARRAY['brand', 'colors', 'palette'], false, 83, 'Color palette reference'),

-- Fonts
('.*\.(ttf|otf|woff|woff2)$', 'font', 'font_file', 'brand/fonts', ARRAY['font', 'typography'], false, 80, 'Font file'),

-- Product Imagery
('.*product[-_]?shot.*\.(jpg|jpeg|png|tiff?)$', 'product_image', 'product_shot', 'product-imagery/shots', ARRAY['product', 'photography'], false, 75, 'Product shot photograph'),
('.*hero[-_]?(image|shot)?.*\.(jpg|jpeg|png|tiff?)$', 'product_image', 'hero_image', 'product-imagery/hero', ARRAY['product', 'hero', 'photography'], false, 75, 'Hero product image'),
('.*lifestyle.*\.(jpg|jpeg|png|tiff?)$', 'product_image', 'lifestyle', 'product-imagery/lifestyle', ARRAY['product', 'lifestyle', 'photography'], false, 73, 'Lifestyle product photography'),

-- Logos & Icons
('.*logo.*\.(svg|ai|eps|png)$', 'brand_asset', 'logo', 'brand/logos', ARRAY['logo', 'brand', 'identity'], false, 77, 'Logo file'),
('.*icon.*\.(svg|ai|png)$', 'brand_asset', 'icon', 'brand/icons', ARRAY['icon', 'ui', 'graphic'], false, 75, 'Icon file'),

-- Documentation
('.*readme.*\.(txt|md)$', 'documentation', 'readme', 'documentation', ARRAY['readme', 'documentation'], false, 70, 'README documentation'),
('.*spec.*\.pdf$', 'documentation', 'specification', 'documentation/specs', ARRAY['spec', 'documentation', 'requirements'], false, 72, 'Specification document'),

-- Archives (will be extracted and processed)
('.*\.(zip|rar|7z|tar\.gz)$', 'archive', 'compressed', 'archives', ARRAY['archive', 'compressed'], false, 60, 'Compressed archive'),

-- Generic catch-alls (lowest priority)
('.*\.(jpg|jpeg|png|gif|webp)$', 'image', 'generic_image', 'images', ARRAY['image'], false, 50, 'Generic image file'),
('.*\.pdf$', 'document', 'pdf', 'documents', ARRAY['document', 'pdf'], false, 50, 'PDF document'),
('.*\.(doc|docx)$', 'document', 'word', 'documents', ARRAY['document', 'word'], false, 50, 'Word document'),
('.*\.(txt|md)$', 'document', 'text', 'documents', ARRAY['document', 'text'], false, 50, 'Text document');

-- ==============================================================================
-- EXTERNAL ASSET LINKS
-- ==============================================================================
-- Track Figma, Google Drive, Dropbox links provided by clients

CREATE TABLE external_asset_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID REFERENCES asset_packages(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,

  link_type VARCHAR(50), -- figma, google_drive, dropbox, frame_io, etc.
  url VARCHAR(1000) NOT NULL,
  title VARCHAR(500),
  description TEXT,

  -- Access tracking
  last_accessed_at TIMESTAMP,
  access_count INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_external_links_package ON external_asset_links(package_id);
CREATE INDEX idx_external_links_campaign ON external_asset_links(campaign_id);
CREATE INDEX idx_external_links_type ON external_asset_links(link_type);

-- ==============================================================================
-- ASSET RELATIONSHIPS
-- ==============================================================================
-- Track relationships between assets (e.g., this PNG is from that PSD)

CREATE TABLE asset_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  related_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,

  relationship_type VARCHAR(50), -- derived_from, variation_of, part_of_set, etc.
  confidence DECIMAL(3,2) DEFAULT 1.00, -- Auto-detected relationships have lower confidence

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_asset_relationships_source ON asset_relationships(source_asset_id);
CREATE INDEX idx_asset_relationships_related ON asset_relationships(related_asset_id);

-- ==============================================================================
-- UPDATE EXISTING TABLES
-- ==============================================================================

-- Update approval_history to reference assets instead of creatives
ALTER TABLE approval_history
  ADD COLUMN asset_id UUID REFERENCES assets(id) ON DELETE CASCADE;

CREATE INDEX idx_approval_history_asset ON approval_history(asset_id);

-- Update generated_tags to reference assets instead of creatives
ALTER TABLE generated_tags
  ADD COLUMN asset_id UUID REFERENCES assets(id) ON DELETE CASCADE;

CREATE INDEX idx_tags_asset ON generated_tags(asset_id);

-- ==============================================================================
-- TRIGGERS
-- ==============================================================================

CREATE TRIGGER update_asset_packages_updated_at BEFORE UPDATE ON asset_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- VIEWS FOR ASSET MANAGEMENT
-- ==============================================================================

-- View: Asset Package Summary
CREATE OR REPLACE VIEW asset_package_summary AS
SELECT
  ap.id as package_id,
  ap.package_name,
  ap.campaign_id,
  c.name as campaign_name,
  c.client_name,
  ap.package_type,
  ap.version,
  ap.uploaded_by,
  ap.uploaded_at,
  ap.status,
  ap.total_files,
  ap.total_size_bytes,
  ROUND(ap.total_size_bytes / 1024.0 / 1024.0, 2) as size_mb,
  COUNT(a.id) FILTER (WHERE a.is_final_creative = true) as final_creative_count,
  COUNT(a.id) FILTER (WHERE a.is_final_creative = false) as source_file_count,
  COUNT(a.id) FILTER (WHERE a.is_final_creative = true AND a.approval_status = 'approved') as approved_count,
  COUNT(a.id) FILTER (WHERE a.is_final_creative = true AND a.approval_status = 'pending') as pending_approval_count
FROM asset_packages ap
JOIN campaigns c ON ap.campaign_id = c.id
LEFT JOIN assets a ON ap.id = a.package_id
GROUP BY ap.id, ap.package_name, ap.campaign_id, c.name, c.client_name,
         ap.package_type, ap.version, ap.uploaded_by, ap.uploaded_at,
         ap.status, ap.total_files, ap.total_size_bytes;

-- View: Final Creatives Pending Approval
CREATE OR REPLACE VIEW pending_final_creatives AS
SELECT
  a.id as asset_id,
  a.organized_filename,
  a.file_category,
  a.file_subcategory,
  a.dimensions,
  a.thumbnail_url,
  a.approval_status,
  a.priority,
  a.created_at as submitted_at,
  ap.package_name,
  c.name as campaign_name,
  c.client_name,
  ap.uploaded_by
FROM assets a
JOIN asset_packages ap ON a.package_id = ap.id
JOIN campaigns c ON a.campaign_id = c.id
WHERE a.is_final_creative = true
  AND a.approval_status = 'pending'
  AND a.processing_status = 'ready'
ORDER BY a.priority DESC, a.created_at ASC;

-- View: Asset Category Breakdown
CREATE OR REPLACE VIEW asset_category_breakdown AS
SELECT
  campaign_id,
  package_id,
  file_category,
  file_subcategory,
  COUNT(*) as file_count,
  SUM(file_size_bytes) as total_size_bytes,
  COUNT(*) FILTER (WHERE is_final_creative = true) as final_creative_count,
  COUNT(*) FILTER (WHERE is_final_creative = false) as source_file_count
FROM assets
WHERE processing_status = 'ready'
GROUP BY campaign_id, package_id, file_category, file_subcategory
ORDER BY file_count DESC;

-- ==============================================================================
-- UPDATE SYSTEM SETTINGS
-- ==============================================================================

INSERT INTO system_settings (key, value, description) VALUES
('max_package_size_gb', '5', 'Maximum asset package upload size in GB'),
('enable_auto_categorization', 'true', 'Automatically categorize uploaded files'),
('enable_thumbnail_generation', 'true', 'Generate thumbnails for images and videos'),
('enable_metadata_extraction', 'true', 'Extract metadata from uploaded files'),
('taxonomy_confidence_threshold', '0.70', 'Minimum confidence score for auto-categorization'),
('enable_duplicate_detection', 'true', 'Detect duplicate files by hash'),
('archive_auto_extract', 'true', 'Automatically extract ZIP/RAR archives')
ON CONFLICT (key) DO NOTHING;

COMMIT;
