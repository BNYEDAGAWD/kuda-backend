/**
 * Minimal One-Page Brief Generator
 *
 * Research-backed: Designers achieve <5 minute time-to-start with minimal briefs
 * vs 20+ minutes with comprehensive 3-5 page briefs
 *
 * Contains ONLY essential elements:
 * 1. Project summary (2-3 sentences max)
 * 2. Asset inventory (simple count)
 * 3. Brand basics (if found)
 * 4. Suggested starting point
 * 5. Critical blockers only
 */

import { DominantColor } from './color-extractor';
import { DocumentScanResult } from './document-scanner';

export interface AssetInventory {
  source_files: number;
  images: number;
  video: number;
  reference: number;
  misc: number;
  total: number;
}

export interface BrandBasics {
  brandColors?: DominantColor[];
  brandGuidelinesDoc?: string;
  logoFiles?: string[];
}

export interface MinimalBrief {
  projectName: string;
  summary: string;
  assetInventory: AssetInventory;
  brandBasics?: BrandBasics;
  suggestedStartingFile?: string;
  criticalBlockers: string[];
  generatedAt: Date;
  processingTimeMs: number;
}

/**
 * Generate minimal one-page brief
 *
 * @param campaignName - Campaign name
 * @param categoryStats - File counts per category
 * @param brandColors - Extracted brand colors (if any)
 * @param documentScans - Document scan results
 * @param sourceFiles - List of source files for starting point suggestion
 * @returns Minimal brief object
 */
export function generateMinimalBrief(
  campaignName: string,
  categoryStats: Record<string, number>,
  brandColors?: DominantColor[],
  documentScans?: DocumentScanResult[],
  sourceFiles?: string[]
): MinimalBrief {
  const startTime = Date.now();

  // 1. Build asset inventory
  const assetInventory: AssetInventory = {
    source_files: categoryStats.source_files || 0,
    images: categoryStats.images || 0,
    video: categoryStats.video || 0,
    reference: categoryStats.reference || 0,
    misc: categoryStats.misc || 0,
    total: Object.values(categoryStats).reduce((sum, count) => sum + count, 0)
  };

  // 2. Generate summary (2-3 sentences max)
  const summary = generateSummary(campaignName, assetInventory);

  // 3. Extract brand basics
  let brandBasics: BrandBasics | undefined;
  if (brandColors || documentScans) {
    brandBasics = {
      brandColors,
      brandGuidelinesDoc: documentScans?.find(s => s.flaggedAs.includes('brand_guidelines'))?.filename,
      logoFiles: [] // Populated externally if logo detection was performed
    };
  }

  // 4. Suggest starting file
  const suggestedStartingFile = suggestStartingFile(sourceFiles, documentScans);

  // 5. Identify critical blockers
  const criticalBlockers = identifyBlockers(assetInventory, documentScans);

  const processingTimeMs = Date.now() - startTime;

  return {
    projectName: campaignName,
    summary,
    assetInventory,
    brandBasics,
    suggestedStartingFile,
    criticalBlockers,
    generatedAt: new Date(),
    processingTimeMs
  };
}

/**
 * Generate 2-3 sentence summary
 */
function generateSummary(campaignName: string, inventory: AssetInventory): string {
  const sentences: string[] = [];

  // Sentence 1: Basic intro
  sentences.push('Campaign assets for ' + campaignName + '.');

  // Sentence 2: Asset count summary
  const assetTypes: string[] = [];
  if (inventory.source_files > 0) {
    const plural = inventory.source_files > 1 ? 's' : '';
    assetTypes.push(inventory.source_files + ' source file' + plural);
  }
  if (inventory.images > 0) {
    const plural = inventory.images > 1 ? 's' : '';
    assetTypes.push(inventory.images + ' image' + plural);
  }
  if (inventory.video > 0) {
    const plural = inventory.video > 1 ? 's' : '';
    assetTypes.push(inventory.video + ' video' + plural);
  }
  if (inventory.reference > 0) {
    const plural = inventory.reference > 1 ? 's' : '';
    assetTypes.push(inventory.reference + ' reference doc' + plural);
  }

  if (assetTypes.length > 0) {
    sentences.push('Includes ' + assetTypes.join(', ') + '.');
  }

  // Sentence 3: Ready status
  sentences.push('Assets organized and ready for designer review.');

  return sentences.join(' ');
}

/**
 * Suggest which file to open first
 */
function suggestStartingFile(
  sourceFiles?: string[],
  documentScans?: DocumentScanResult[]
): string | undefined {
  // Priority 1: Campaign brief document
  const briefDoc = documentScans?.find(s => s.flaggedAs.includes('campaign_brief'));
  if (briefDoc) return briefDoc.filename;

  // Priority 2: Brand guidelines
  const brandDoc = documentScans?.find(s => s.flaggedAs.includes('brand_guidelines'));
  if (brandDoc) return brandDoc.filename;

  // Priority 3: First source file (PSD, AI, etc.)
  if (sourceFiles && sourceFiles.length > 0) {
    // Look for files with "master" or "main" in name
    const masterFile = sourceFiles.find(f => /\b(master|main|template)\b/i.test(f));
    if (masterFile) return masterFile;

    // Otherwise, return first source file
    return sourceFiles[0];
  }

  return undefined;
}

/**
 * Identify critical blockers that would prevent starting work
 */
function identifyBlockers(
  inventory: AssetInventory,
  documentScans?: DocumentScanResult[]
): string[] {
  const blockers: string[] = [];

  // Blocker: No source files
  if (inventory.source_files === 0 && inventory.images === 0 && inventory.video === 0) {
    blockers.push('No creative source files found. Client may need to upload design assets.');
  }

  // Blocker: No brand guidelines found
  const hasBrandGuidelines = documentScans?.some(s => s.flaggedAs.includes('brand_guidelines'));
  if (!hasBrandGuidelines && inventory.reference > 0) {
    blockers.push('No brand guidelines detected. May need to request from client if not in reference docs.');
  }

  // Blocker: Large video files without source
  if (inventory.video > 3 && inventory.source_files === 0) {
    blockers.push('Multiple video files without editable source files. Confirm if videos need editing or are final.');
  }

  return blockers;
}

/**
 * Format brief as plain text (for email or portal display)
 */
export function formatBriefAsText(brief: MinimalBrief): string {
  const lines: string[] = [];

  // Header
  lines.push('='.repeat(60));
  lines.push('CREATIVE BRIEF: ' + brief.projectName);
  lines.push('='.repeat(60));
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push('-'.repeat(60));
  lines.push(brief.summary);
  lines.push('');

  // Asset Inventory
  lines.push('ASSET INVENTORY');
  lines.push('-'.repeat(60));
  lines.push('Total Files: ' + brief.assetInventory.total);
  if (brief.assetInventory.source_files > 0) {
    lines.push('  • Source Files: ' + brief.assetInventory.source_files);
  }
  if (brief.assetInventory.images > 0) {
    lines.push('  • Images: ' + brief.assetInventory.images);
  }
  if (brief.assetInventory.video > 0) {
    lines.push('  • Videos: ' + brief.assetInventory.video);
  }
  if (brief.assetInventory.reference > 0) {
    lines.push('  • Reference Docs: ' + brief.assetInventory.reference);
  }
  if (brief.assetInventory.misc > 0) {
    lines.push('  • Other: ' + brief.assetInventory.misc);
  }
  lines.push('');

  // Brand Basics
  if (brief.brandBasics) {
    lines.push('BRAND BASICS');
    lines.push('-'.repeat(60));

    if (brief.brandBasics.brandColors && brief.brandBasics.brandColors.length > 0) {
      lines.push('Brand Colors:');
      brief.brandBasics.brandColors.slice(0, 6).forEach(color => {
        lines.push('  • ' + color.hex + ' (' + Math.round(color.percentage) + '%)');
      });
    }

    if (brief.brandBasics.brandGuidelinesDoc) {
      lines.push('Brand Guidelines: ' + brief.brandBasics.brandGuidelinesDoc);
    }

    if (brief.brandBasics.logoFiles && brief.brandBasics.logoFiles.length > 0) {
      lines.push('Logo Files: ' + brief.brandBasics.logoFiles.join(', '));
    }

    lines.push('');
  }

  // Suggested Starting Point
  if (brief.suggestedStartingFile) {
    lines.push('SUGGESTED STARTING POINT');
    lines.push('-'.repeat(60));
    lines.push('Open: ' + brief.suggestedStartingFile);
    lines.push('');
  }

  // Critical Blockers
  if (brief.criticalBlockers.length > 0) {
    lines.push('CRITICAL BLOCKERS');
    lines.push('-'.repeat(60));
    brief.criticalBlockers.forEach((blocker, i) => {
      lines.push((i + 1) + '. ' + blocker);
    });
    lines.push('');
  }

  // Footer
  lines.push('='.repeat(60));
  lines.push('Generated: ' + brief.generatedAt.toISOString());
  lines.push('Processing Time: ' + brief.processingTimeMs + 'ms');
  lines.push('='.repeat(60));

  return lines.join('\n');
}

/**
 * Format brief as JSON (for API responses)
 */
export function formatBriefAsJSON(brief: MinimalBrief): string {
  return JSON.stringify(brief, null, 2);
}
