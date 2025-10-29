-- ============================================================================
-- KCAP Format Library - Seed Data
-- ============================================================================
--
-- 21 Kargo High-Impact Ad Formats
--
-- Device Support Categories:
-- - cross-platform: Desktop, Mobile, Tablet
-- - mobile-only: Mobile only (Lighthouse formats)
-- - ctv-only: Connected TV only (Enhanced CTV formats)
--
-- ============================================================================

-- Clear existing data (for re-running migration)
TRUNCATE TABLE format_library CASCADE;

-- ============================================================================
-- Cross-Platform Formats (Desktop, Mobile, Tablet)
-- ============================================================================

INSERT INTO format_library (format_name, format_type, device_support, devices, description) VALUES

-- Venti Formats
('Venti Video', 'video', 'cross-platform', '["desktop", "mobile", "tablet"]',
 'High-impact video format with expandable creative area and rich interactivity'),

('Venti Display', 'display', 'cross-platform', '["desktop", "mobile", "tablet"]',
 'High-impact display format with expandable creative area'),

('Venti Video Shoppable Carousel', 'video', 'cross-platform', '["desktop", "mobile", "tablet"]',
 'Interactive video carousel with shoppable product features'),

-- Runway Formats
('Runway Video', 'video', 'cross-platform', '["desktop", "mobile", "tablet"]',
 'Premium video format with cinematic presentation'),

('Runway Display', 'display', 'cross-platform', '["desktop", "mobile", "tablet"]',
 'Premium display format with immersive creative experience'),

('Runway Core', 'display', 'cross-platform', '["desktop", "mobile", "tablet"]',
 'Core runway display unit optimized for brand storytelling'),

('Runway Wheel Core', 'display', 'cross-platform', '["desktop", "mobile", "tablet"]',
 'Interactive wheel-based navigation for product showcases'),

-- Spotlight Formats
('Spotlight Video', 'video', 'cross-platform', '["desktop", "mobile", "tablet"]',
 'Attention-grabbing video format with spotlight effect'),

('Spotlight Display', 'display', 'cross-platform', '["desktop", "mobile", "tablet"]',
 'Attention-grabbing display format with spotlight effect'),

-- Breakaway Format
('Breakaway Display', 'display', 'cross-platform', '["desktop", "mobile", "tablet"]',
 'Innovative breakaway animation that separates from page content'),

-- Pre-Roll Formats
('Enhance Pre-Roll OLV (in stream)', 'video', 'cross-platform', '["desktop", "mobile", "tablet"]',
 'Enhanced in-stream video pre-roll with interactive overlays'),

('Interactive Pre-Roll', 'video', 'cross-platform', '["desktop", "mobile", "tablet"]',
 'Interactive pre-roll video with clickable elements and engagement features'),

-- Banner Formats
('Top Banner', 'display', 'cross-platform', '["desktop", "mobile", "tablet"]',
 'Premium top-of-page banner placement'),

('Middle Banner', 'display', 'cross-platform', '["desktop", "mobile", "tablet"]',
 'Mid-page banner placement for sustained visibility'),

-- Uptick Format
('Uptick', 'display', 'cross-platform', '["desktop", "mobile", "tablet"]',
 'Innovative bottom-of-page format that rises on scroll');

-- ============================================================================
-- Mobile-Only Formats (Lighthouse)
-- ============================================================================

INSERT INTO format_library (format_name, format_type, device_support, devices, description) VALUES

('Lighthouse Display', 'display', 'mobile-only', '["mobile"]',
 'Mobile-exclusive high-impact display format optimized for mobile engagement'),

('Lighthouse Video', 'video', 'mobile-only', '["mobile"]',
 'Mobile-exclusive high-impact video format with full-screen mobile experience');

-- ============================================================================
-- Connected TV Formats (CTV-Only)
-- ============================================================================

INSERT INTO format_library (format_name, format_type, device_support, devices, description) VALUES

('Enhanced CTV with Branded Canvas', 'ctv', 'ctv-only', '["ctv"]',
 'Connected TV format with branded canvas for immersive living room experience'),

('Enhanced CTV Mirage', 'ctv', 'ctv-only', '["ctv"]',
 'Advanced CTV format with mirage visual effects and interactive elements'),

('Enhanced CTV Tiles', 'ctv', 'ctv-only', '["ctv"]',
 'Interactive tile-based CTV format for product showcases'),

('Enhanced CTV Flipbook', 'ctv', 'ctv-only', '["ctv"]',
 'Flipbook-style CTV format for sequential storytelling on connected TV');

-- ============================================================================
-- Verification Query (Run after seeding)
-- ============================================================================

-- Verify all 21 formats were inserted
SELECT
  device_support,
  COUNT(*) as format_count,
  STRING_AGG(format_name, ', ' ORDER BY format_name) as formats
FROM format_library
GROUP BY device_support
ORDER BY device_support;

-- Expected output:
-- cross-platform | 15 formats
-- ctv-only       | 4 formats
-- mobile-only    | 2 formats
-- TOTAL: 21 formats

-- ============================================================================
-- Query Examples for Frontend Format Selector
-- ============================================================================

-- Get all cross-platform video formats
-- SELECT format_name FROM format_library WHERE device_support = 'cross-platform' AND format_type = 'video';

-- Get all mobile-only formats
-- SELECT format_name FROM format_library WHERE device_support = 'mobile-only';

-- Get all CTV formats
-- SELECT format_name FROM format_library WHERE device_support = 'ctv-only';

-- Get formats grouped by type
-- SELECT format_type, COUNT(*), STRING_AGG(format_name, ', ') FROM format_library GROUP BY format_type;
