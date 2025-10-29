/**
 * Revision Changelog Service - Auto-Generated "What Changed" Documentation
 *
 * Automatically detects and documents changes between deliverable revisions:
 * - Font changes (typeface, size, weight)
 * - Color changes (brand colors, backgrounds, text)
 * - Layout changes (positioning, sizing, spacing)
 * - Copy changes (text content updates)
 * - Video changes (duration, codec, assets)
 */

import { Pool } from 'pg';
import { Logger } from '../utils/logger';

const logger = new Logger('RevisionChangelogService');

export interface RevisionChangelog {
  id: string;
  deliverable_id: string;
  revision_number: number;
  previous_version_id: string | null;
  changes_detected: {
    font: string[];
    color: string[];
    layout: string[];
    copy: string[];
    video: string[];
  };
  total_changes: number;
  changelog_text: string;
  changelog_html: string | null;
  generated_by: string;
  generated_at: Date;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface DetectedChanges {
  font: string[];
  color: string[];
  layout: string[];
  copy: string[];
  video: string[];
}

export interface GenerateChangelogInput {
  deliverable_id: string;
  revision_number: number;
  previous_version_id?: string;
  metadata_current: any; // Current deliverable metadata
  metadata_previous?: any; // Previous deliverable metadata
}

export class RevisionChangelogService {
  constructor(private db: Pool) {}

  /**
   * Generate changelog for a deliverable revision
   */
  async generateChangelog(input: GenerateChangelogInput): Promise<RevisionChangelog> {
    try {
      // Detect changes between versions
      const changes = this.detectChanges(
        input.metadata_current,
        input.metadata_previous || {}
      );

      const total_changes = Object.values(changes).reduce(
        (sum, arr) => sum + arr.length,
        0
      );

      // Generate changelog text
      const changelog_text = this.formatChangelogText(changes);
      const changelog_html = this.formatChangelogHTML(changes);

      // Insert changelog record
      const result = await this.db.query<RevisionChangelog>(
        `INSERT INTO revision_changelogs (
          deliverable_id, revision_number, previous_version_id,
          changes_detected, total_changes, changelog_text, changelog_html
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          input.deliverable_id,
          input.revision_number,
          input.previous_version_id || null,
          JSON.stringify(changes),
          total_changes,
          changelog_text,
          changelog_html
        ]
      );

      const changelog = result.rows[0];
      logger.info('Changelog generated', {
        deliverableId: input.deliverable_id,
        revisionNumber: input.revision_number,
        totalChanges: total_changes
      });

      return changelog;
    } catch (error) {
      logger.error('Failed to generate changelog', { input, error });
      throw error;
    }
  }

  /**
   * Detect changes between current and previous metadata
   */
  private detectChanges(
    current: any,
    previous: any
  ): DetectedChanges {
    const changes: DetectedChanges = {
      font: [],
      color: [],
      layout: [],
      copy: [],
      video: []
    };

    // Font changes
    if (current.fonts && previous.fonts) {
      if (current.fonts.heading !== previous.fonts.heading) {
        changes.font.push(
          `Heading font changed from ${previous.fonts.heading || 'default'} to ${current.fonts.heading}`
        );
      }
      if (current.fonts.body !== previous.fonts.body) {
        changes.font.push(
          `Body font changed from ${previous.fonts.body || 'default'} to ${current.fonts.body}`
        );
      }
      if (current.fonts.size !== previous.fonts.size) {
        changes.font.push(
          `Font size changed from ${previous.fonts.size || 'default'}px to ${current.fonts.size}px`
        );
      }
    }

    // Color changes
    if (current.colors && previous.colors) {
      if (current.colors.primary !== previous.colors.primary) {
        changes.color.push(
          `Primary color changed from ${previous.colors.primary} to ${current.colors.primary}`
        );
      }
      if (current.colors.secondary !== previous.colors.secondary) {
        changes.color.push(
          `Secondary color changed from ${previous.colors.secondary} to ${current.colors.secondary}`
        );
      }
      if (current.colors.background !== previous.colors.background) {
        changes.color.push(
          `Background color changed from ${previous.colors.background} to ${current.colors.background}`
        );
      }
    }

    // Layout changes
    if (current.layout && previous.layout) {
      if (JSON.stringify(current.layout.logo_position) !== JSON.stringify(previous.layout.logo_position)) {
        changes.layout.push(
          `Logo repositioned from (${previous.layout.logo_position?.x},${previous.layout.logo_position?.y}) to (${current.layout.logo_position?.x},${current.layout.logo_position?.y})`
        );
      }
      if (current.layout.logo_size !== previous.layout.logo_size) {
        changes.layout.push(
          `Logo size changed from ${previous.layout.logo_size}px to ${current.layout.logo_size}px`
        );
      }
      if (current.layout.cta_size !== previous.layout.cta_size) {
        changes.layout.push(
          `CTA button size changed from ${previous.layout.cta_size} to ${current.layout.cta_size}`
        );
      }
    }

    // Copy changes
    if (current.copy && previous.copy) {
      if (current.copy.headline !== previous.copy.headline) {
        changes.copy.push(
          `Headline updated from "${previous.copy.headline}" to "${current.copy.headline}"`
        );
      }
      if (current.copy.body !== previous.copy.body) {
        changes.copy.push(
          `Body text updated`
        );
      }
      if (current.copy.cta !== previous.copy.cta) {
        changes.copy.push(
          `CTA text changed from "${previous.copy.cta}" to "${current.copy.cta}"`
        );
      }
      if (current.copy.disclaimer !== previous.copy.disclaimer) {
        changes.copy.push(
          `Disclaimer text updated`
        );
      }
    }

    // Video changes
    if (current.video && previous.video) {
      if (current.video.duration !== previous.video.duration) {
        changes.video.push(
          `Video duration changed from ${previous.video.duration}s to ${current.video.duration}s`
        );
      }
      if (current.video.codec !== previous.video.codec) {
        changes.video.push(
          `Video codec changed from ${previous.video.codec} to ${current.video.codec}`
        );
      }
      if (current.video.asset_url !== previous.video.asset_url) {
        changes.video.push(
          `Video asset replaced`
        );
      }
    }

    return changes;
  }

  /**
   * Format changelog as plain text for email
   */
  private formatChangelogText(changes: DetectedChanges): string {
    const sections: string[] = [];

    if (changes.font.length > 0) {
      sections.push(`Font (${changes.font.length} ${changes.font.length === 1 ? 'change' : 'changes'}):\n  - ${changes.font.join('\n  - ')}`);
    }

    if (changes.color.length > 0) {
      sections.push(`Color (${changes.color.length} ${changes.color.length === 1 ? 'change' : 'changes'}):\n  - ${changes.color.join('\n  - ')}`);
    }

    if (changes.layout.length > 0) {
      sections.push(`Layout (${changes.layout.length} ${changes.layout.length === 1 ? 'change' : 'changes'}):\n  - ${changes.layout.join('\n  - ')}`);
    }

    if (changes.copy.length > 0) {
      sections.push(`Copy (${changes.copy.length} ${changes.copy.length === 1 ? 'change' : 'changes'}):\n  - ${changes.copy.join('\n  - ')}`);
    }

    if (changes.video.length > 0) {
      sections.push(`Video (${changes.video.length} ${changes.video.length === 1 ? 'change' : 'changes'}):\n  - ${changes.video.join('\n  - ')}`);
    }

    return sections.length > 0
      ? sections.join('\n\n')
      : 'No changes detected';
  }

  /**
   * Format changelog as HTML for email
   */
  private formatChangelogHTML(changes: DetectedChanges): string {
    const sections: string[] = [];

    if (changes.font.length > 0) {
      sections.push(`
        <h4 style="color: #0066CC; margin-top: 15px;">Font (${changes.font.length} ${changes.font.length === 1 ? 'change' : 'changes'})</h4>
        <ul>
          ${changes.font.map(c => `<li>${c}</li>`).join('')}
        </ul>
      `);
    }

    if (changes.color.length > 0) {
      sections.push(`
        <h4 style="color: #0066CC; margin-top: 15px;">Color (${changes.color.length} ${changes.color.length === 1 ? 'change' : 'changes'})</h4>
        <ul>
          ${changes.color.map(c => `<li>${c}</li>`).join('')}
        </ul>
      `);
    }

    if (changes.layout.length > 0) {
      sections.push(`
        <h4 style="color: #0066CC; margin-top: 15px;">Layout (${changes.layout.length} ${changes.layout.length === 1 ? 'change' : 'changes'})</h4>
        <ul>
          ${changes.layout.map(c => `<li>${c}</li>`).join('')}
        </ul>
      `);
    }

    if (changes.copy.length > 0) {
      sections.push(`
        <h4 style="color: #0066CC; margin-top: 15px;">Copy (${changes.copy.length} ${changes.copy.length === 1 ? 'change' : 'changes'})</h4>
        <ul>
          ${changes.copy.map(c => `<li>${c}</li>`).join('')}
        </ul>
      `);
    }

    if (changes.video.length > 0) {
      sections.push(`
        <h4 style="color: #0066CC; margin-top: 15px;">Video (${changes.video.length} ${changes.video.length === 1 ? 'change' : 'changes'})</h4>
        <ul>
          ${changes.video.map(c => `<li>${c}</li>`).join('')}
        </ul>
      `);
    }

    return sections.length > 0
      ? sections.join('')
      : '<p><em>No changes detected</em></p>';
  }

  /**
   * Get changelog by ID
   */
  async getChangelog(changelog_id: string): Promise<RevisionChangelog | null> {
    try {
      const result = await this.db.query<RevisionChangelog>(
        `SELECT * FROM revision_changelogs WHERE id = $1`,
        [changelog_id]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get changelog', { changelog_id, error });
      throw error;
    }
  }

  /**
   * Get changelogs for a deliverable
   */
  async getDeliverablelogs(deliverable_id: string): Promise<RevisionChangelog[]> {
    try {
      const result = await this.db.query<RevisionChangelog>(
        `SELECT * FROM revision_changelogs
         WHERE deliverable_id = $1
         ORDER BY revision_number ASC`,
        [deliverable_id]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get deliverable changelogs', { deliverable_id, error });
      throw error;
    }
  }

  /**
   * Mark changelog as reviewed
   */
  async markReviewed(
    changelog_id: string,
    reviewed_by: string
  ): Promise<RevisionChangelog> {
    try {
      const result = await this.db.query<RevisionChangelog>(
        `UPDATE revision_changelogs
         SET reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [reviewed_by, changelog_id]
      );

      if (result.rows.length === 0) {
        throw new Error('Changelog not found');
      }

      logger.info('Changelog marked as reviewed', {
        changelogId: changelog_id,
        reviewedBy: reviewed_by
      });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to mark changelog as reviewed', {
        changelog_id,
        reviewed_by,
        error
      });
      throw error;
    }
  }
}

export default RevisionChangelogService;
