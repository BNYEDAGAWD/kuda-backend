/**
 * KUDA Email Templates - Phase 2
 *
 * 7 complete email templates with [KUDA] branding for workflow automation
 */

export interface EmailTemplateData {
  campaign_name: string;
  campaign_id: string;
  [key: string]: any;
}

export interface EmailTemplate {
  subject: string;
  body_text: string;
  body_html: string;
}

/**
 * Template 1: Campaign Asset Requirements (Educational)
 */
export function campaignAssetRequirements(data: {
  campaign_name: string;
  campaign_id: string;
  approved_formats: string[];
  kuda_url: string;
}): EmailTemplate {
  const subject = `[KUDA] ${data.campaign_name} - Asset Requirements`;

  const body_text = `Hi Team,

Your campaign has been created in the Kargo Unified Design Approval (KUDA) platform.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ASSET PACK REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Approved formats:
${data.approved_formats.map(f => `✓ ${f}`).join('\n')}

Please provide:

BRAND ASSETS (REQUIRED)
  □ High-resolution logo files (.PNG or .SVG, transparent background)
  □ Brand color codes (HEX values)
  □ Brand fonts (web-safe or licensed font files)

REFERENCE DOCUMENTS (REQUIRED)
  □ Brand guidelines PDF (logo usage, spacing, do's/don'ts)
  □ Campaign messaging document

QUICK TIPS TO AVOID DELAYS
✅ Include brand guidelines - Prevents 80% of revision rounds
✅ Provide high-res logos - Small logos cause production delays
✅ Specify brand fonts - Font mismatches = #1 rejection trigger

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Upload your assets here: ${data.kuda_url}/campaigns/${data.campaign_id}/upload

Questions? Reply to this email - we're here to help!

Best regards,
Kargo Unified Design Approval (KUDA)`;

  const body_html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.6;">
  <p>Hi Team,</p>
  <p>Your campaign has been created in the <strong>Kargo Unified Design Approval (KUDA)</strong> platform.</p>

  <div style="background: #f5f5f5; padding: 20px; border-left: 4px solid #0066CC; margin: 20px 0;">
    <h2 style="margin-top: 0; color: #0066CC;">📦 ASSET PACK REQUIREMENTS</h2>

    <p><strong>Approved formats:</strong></p>
    <ul>
      ${data.approved_formats.map(f => `<li>✓ ${f}</li>`).join('')}
    </ul>

    <p><strong>Please provide:</strong></p>

    <h3 style="color: #0066CC; font-size: 16px;">🎨 BRAND ASSETS (REQUIRED)</h3>
    <ul>
      <li>High-resolution logo files (.PNG or .SVG, transparent background)</li>
      <li>Brand color codes (HEX values)</li>
      <li>Brand fonts (web-safe or licensed font files)</li>
    </ul>

    <h3 style="color: #0066CC; font-size: 16px;">📄 REFERENCE DOCUMENTS (REQUIRED)</h3>
    <ul>
      <li>Brand guidelines PDF (logo usage, spacing, do's/don'ts)</li>
      <li>Campaign messaging document</li>
    </ul>

    <h3 style="color: #0066CC; font-size: 16px;">⚡ QUICK TIPS TO AVOID DELAYS</h3>
    <ul>
      <li>✅ <strong>Include brand guidelines</strong> - Prevents 80% of revision rounds</li>
      <li>✅ <strong>Provide high-res logos</strong> - Small logos cause production delays</li>
      <li>✅ <strong>Specify brand fonts</strong> - Font mismatches = #1 rejection trigger</li>
    </ul>
  </div>

  <p style="text-align: center; margin: 30px 0;">
    <a href="${data.kuda_url}/campaigns/${data.campaign_id}/upload"
       style="background: #0066CC; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
      Upload Assets
    </a>
  </p>

  <p>Questions? Reply to this email - we're here to help!</p>

  <p>Best regards,<br>
  <strong>Kargo Unified Design Approval (KUDA)</strong></p>
</div>`;

  return { subject, body_text, body_html };
}

/**
 * Template 2: Asset Pack Validation Failed
 */
export function assetPackValidationFailed(data: {
  campaign_name: string;
  campaign_id: string;
  reviewer_name: string;
  rejection_note: string;
  missing_items: string[];
  kuda_url: string;
}): EmailTemplate {
  const subject = `[KUDA] ${data.campaign_name} - Asset Pack Needs Attention`;

  const body_text = `Hi Team,

Your asset pack for ${data.campaign_name} has been reviewed and needs some updates before we can proceed.

REVIEWER FEEDBACK
${data.reviewer_name} noted:
"${data.rejection_note}"

MISSING OR INCOMPLETE ITEMS
${data.missing_items.map(item => `• ${item}`).join('\n')}

NEXT STEPS
Please upload the missing items and resubmit your asset pack.

Upload here: ${data.kuda_url}/campaigns/${data.campaign_id}/upload

Questions? Reply to this email and we'll help you get everything sorted.

Best regards,
Kargo Unified Design Approval (KUDA)`;

  const body_html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.6;">
  <p>Hi Team,</p>
  <p>Your asset pack for <strong>${data.campaign_name}</strong> has been reviewed and needs some updates before we can proceed.</p>

  <div style="background: #FFF3CD; padding: 20px; border-left: 4px solid #FF6600; margin: 20px 0;">
    <h2 style="margin-top: 0; color: #FF6600;">⚠️ REVIEWER FEEDBACK</h2>
    <p><strong>${data.reviewer_name}</strong> noted:</p>
    <p style="background: white; padding: 15px; border-left: 3px solid #FF6600; font-style: italic;">"${data.rejection_note}"</p>

    <h3 style="color: #FF6600;">Missing or Incomplete Items:</h3>
    <ul>
      ${data.missing_items.map(item => `<li>${item}</li>`).join('')}
    </ul>
  </div>

  <h3>Next Steps</h3>
  <p>Please upload the missing items and resubmit your asset pack.</p>

  <p style="text-align: center; margin: 30px 0;">
    <a href="${data.kuda_url}/campaigns/${data.campaign_id}/upload"
       style="background: #FF6600; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
      Upload Missing Items
    </a>
  </p>

  <p>Questions? Reply to this email and we'll help you get everything sorted.</p>

  <p>Best regards,<br>
  <strong>Kargo Unified Design Approval (KUDA)</strong></p>
</div>`;

  return { subject, body_text, body_html };
}

/**
 * Template 3: Asset Pack Approved
 */
export function assetPackApproved(data: {
  campaign_name: string;
  campaign_id: string;
  reviewer_name: string;
  sla_deadline: string;
  kuda_url: string;
}): EmailTemplate {
  const subject = `[KUDA] ${data.campaign_name} - Asset Pack Approved ✓`;

  const body_text = `Hi Team,

Great news! Your asset pack for ${data.campaign_name} has been approved.

APPROVED BY
${data.reviewer_name}

NEXT STEPS
Our design team is now creating your static mock-ups. You'll receive them for review by ${data.sla_deadline}.

PRODUCTION SLA
We're tracking a 48-hour SLA for static mock delivery. You can monitor progress here:
${data.kuda_url}/campaigns/${data.campaign_id}/status

Questions? Reply to this email anytime.

Best regards,
Kargo Unified Design Approval (KUDA)`;

  const body_html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.6;">
  <p>Hi Team,</p>
  <p>Great news! Your asset pack for <strong>${data.campaign_name}</strong> has been approved.</p>

  <div style="background: #D4EDDA; padding: 20px; border-left: 4px solid #28A745; margin: 20px 0;">
    <h2 style="margin-top: 0; color: #28A745;">✓ APPROVED BY</h2>
    <p><strong>${data.reviewer_name}</strong></p>

    <h3 style="color: #28A745;">Next Steps</h3>
    <p>Our design team is now creating your static mock-ups. You'll receive them for review by <strong>${data.sla_deadline}</strong>.</p>

    <h3 style="color: #28A745;">Production SLA</h3>
    <p>We're tracking a 48-hour SLA for static mock delivery.</p>
  </div>

  <p style="text-align: center; margin: 30px 0;">
    <a href="${data.kuda_url}/campaigns/${data.campaign_id}/status"
       style="background: #28A745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
      Monitor Progress
    </a>
  </p>

  <p>Questions? Reply to this email anytime.</p>

  <p>Best regards,<br>
  <strong>Kargo Unified Design Approval (KUDA)</strong></p>
</div>`;

  return { subject, body_text, body_html };
}

/**
 * Template 4: Static Mocks Ready
 */
export function staticMocksReady(data: {
  campaign_name: string;
  campaign_id: string;
  formats: string[];
  demo_url: string;
  kuda_url: string;
}): EmailTemplate {
  const subject = `[KUDA] ${data.campaign_name} - Static Mocks Ready for Review`;

  const body_text = `Hi Team,

Your static mock-ups for ${data.campaign_name} are ready for review!

FORMATS INCLUDED
${data.formats.map(f => `• ${f}`).join('\n')}

VIEW & TEST
Demo URL: ${data.demo_url}

Device testing: Add ?device=mobile or ?device=tablet to the URL above.

APPROVE OR REQUEST CHANGES
Review here: ${data.kuda_url}/campaigns/${data.campaign_id}/review

Please review and approve so we can move forward with animated production.

Questions? Reply to this email.

Best regards,
Kargo Unified Design Approval (KUDA)`;

  const body_html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.6;">
  <p>Hi Team,</p>
  <p>Your static mock-ups for <strong>${data.campaign_name}</strong> are ready for review!</p>

  <div style="background: #E7F3FF; padding: 20px; border-left: 4px solid #0066CC; margin: 20px 0;">
    <h2 style="margin-top: 0; color: #0066CC;">📐 FORMATS INCLUDED</h2>
    <ul>
      ${data.formats.map(f => `<li>${f}</li>`).join('')}
    </ul>

    <h3 style="color: #0066CC;">View & Test</h3>
    <p><strong>Demo URL:</strong> <a href="${data.demo_url}" style="color: #0066CC;">${data.demo_url}</a></p>
    <p><em>Device testing:</em> Add <code>?device=mobile</code> or <code>?device=tablet</code> to the URL above.</p>
  </div>

  <p style="text-align: center; margin: 30px 0;">
    <a href="${data.kuda_url}/campaigns/${data.campaign_id}/review"
       style="background: #28A745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
      Approve
    </a>
    <a href="${data.kuda_url}/campaigns/${data.campaign_id}/review"
       style="background: #DC3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
      Request Changes
    </a>
  </p>

  <p>Please review and approve so we can move forward with animated production.</p>

  <p>Questions? Reply to this email.</p>

  <p>Best regards,<br>
  <strong>Kargo Unified Design Approval (KUDA)</strong></p>
</div>`;

  return { subject, body_text, body_html };
}

/**
 * Template 5: Revision Changelog (Auto-generated)
 */
export function revisionChangelog(data: {
  campaign_name: string;
  campaign_id: string;
  revision_number: number;
  changelog_text: string;
  total_changes: number;
  demo_url: string;
  kuda_url: string;
}): EmailTemplate {
  const subject = `[KUDA] ${data.campaign_name} - Revision ${data.revision_number} Ready`;

  const body_text = `Hi Team,

Revision ${data.revision_number} for ${data.campaign_name} is ready for review.

WHAT CHANGED (${data.total_changes} changes)
${data.changelog_text}

VIEW REVISION
Demo URL: ${data.demo_url}

APPROVE OR REQUEST FURTHER CHANGES
Review here: ${data.kuda_url}/campaigns/${data.campaign_id}/review

Best regards,
Kargo Unified Design Approval (KUDA)`;

  const body_html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.6;">
  <p>Hi Team,</p>
  <p>Revision <strong>${data.revision_number}</strong> for <strong>${data.campaign_name}</strong> is ready for review.</p>

  <div style="background: #FFF3CD; padding: 20px; border-left: 4px solid #FFC107; margin: 20px 0;">
    <h2 style="margin-top: 0; color: #FFC107;">📝 WHAT CHANGED (${data.total_changes} changes)</h2>
    <div style="background: white; padding: 15px; border-left: 3px solid #FFC107; white-space: pre-wrap;">${data.changelog_text}</div>
  </div>

  <p><strong>View Revision:</strong> <a href="${data.demo_url}" style="color: #0066CC;">${data.demo_url}</a></p>

  <p style="text-align: center; margin: 30px 0;">
    <a href="${data.kuda_url}/campaigns/${data.campaign_id}/review"
       style="background: #28A745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
      Approve
    </a>
    <a href="${data.kuda_url}/campaigns/${data.campaign_id}/review"
       style="background: #DC3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
      Request Further Changes
    </a>
  </p>

  <p>Best regards,<br>
  <strong>Kargo Unified Design Approval (KUDA)</strong></p>
</div>`;

  return { subject, body_text, body_html };
}

/**
 * Template 6: Animated Creatives Ready
 */
export function animatedCreativesReady(data: {
  campaign_name: string;
  campaign_id: string;
  formats: string[];
  demo_url: string;
  kuda_url: string;
}): EmailTemplate {
  const subject = `[KUDA] ${data.campaign_name} - Animated Creatives Ready for Final Review`;

  const body_text = `Hi Team,

Your animated creatives for ${data.campaign_name} are ready for final review!

FORMATS INCLUDED
${data.formats.map(f => `• ${f}`).join('\n')}

VIEW & TEST
Demo URL: ${data.demo_url}

Device testing: Add ?device=mobile or ?device=tablet to the URL above.

FINAL APPROVAL
This is the last review before we deliver final files. Please approve or request any final changes:
${data.kuda_url}/campaigns/${data.campaign_id}/final-review

Best regards,
Kargo Unified Design Approval (KUDA)`;

  const body_html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.6;">
  <p>Hi Team,</p>
  <p>Your animated creatives for <strong>${data.campaign_name}</strong> are ready for final review!</p>

  <div style="background: #E7F3FF; padding: 20px; border-left: 4px solid #0066CC; margin: 20px 0;">
    <h2 style="margin-top: 0; color: #0066CC;">🎬 FORMATS INCLUDED</h2>
    <ul>
      ${data.formats.map(f => `<li>${f}</li>`).join('')}
    </ul>

    <h3 style="color: #0066CC;">View & Test</h3>
    <p><strong>Demo URL:</strong> <a href="${data.demo_url}" style="color: #0066CC;">${data.demo_url}</a></p>
    <p><em>Device testing:</em> Add <code>?device=mobile</code> or <code>?device=tablet</code> to the URL above.</p>
  </div>

  <div style="background: #FFF3CD; padding: 15px; border-left: 3px solid #FFC107; margin: 20px 0;">
    <p style="margin: 0;"><strong>⚠️ Final Approval:</strong> This is the last review before we deliver final files.</p>
  </div>

  <p style="text-align: center; margin: 30px 0;">
    <a href="${data.kuda_url}/campaigns/${data.campaign_id}/final-review"
       style="background: #28A745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block; margin-right: 10px;">
      Give Final Approval
    </a>
    <a href="${data.kuda_url}/campaigns/${data.campaign_id}/final-review"
       style="background: #DC3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
      Request Final Changes
    </a>
  </p>

  <p>Best regards,<br>
  <strong>Kargo Unified Design Approval (KUDA)</strong></p>
</div>`;

  return { subject, body_text, body_html };
}

/**
 * Template 7: All Creatives Approved
 */
export function allCreativesApproved(data: {
  campaign_name: string;
  campaign_id: string;
  approved_by: string;
  delivery_timeline: string;
  kuda_url: string;
}): EmailTemplate {
  const subject = `[KUDA] ${data.campaign_name} - All Creatives Approved ✓`;

  const body_text = `Hi Team,

Congratulations! All creatives for ${data.campaign_name} have been approved.

APPROVED BY
${data.approved_by}

NEXT STEPS
Final production files will be delivered by ${data.delivery_timeline}.

You can track delivery here: ${data.kuda_url}/campaigns/${data.campaign_id}/delivery

Thank you for using KUDA!

Best regards,
Kargo Unified Design Approval (KUDA)`;

  const body_html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; line-height: 1.6;">
  <p>Hi Team,</p>
  <p><strong>Congratulations!</strong> All creatives for <strong>${data.campaign_name}</strong> have been approved.</p>

  <div style="background: #D4EDDA; padding: 20px; border-left: 4px solid #28A745; margin: 20px 0;">
    <h2 style="margin-top: 0; color: #28A745;">🎉 ALL APPROVED</h2>
    <p><strong>Approved by:</strong> ${data.approved_by}</p>

    <h3 style="color: #28A745;">Next Steps</h3>
    <p>Final production files will be delivered by <strong>${data.delivery_timeline}</strong>.</p>
  </div>

  <p style="text-align: center; margin: 30px 0;">
    <a href="${data.kuda_url}/campaigns/${data.campaign_id}/delivery"
       style="background: #28A745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
      Track Delivery
    </a>
  </p>

  <p>Thank you for using KUDA!</p>

  <p>Best regards,<br>
  <strong>Kargo Unified Design Approval (KUDA)</strong></p>
</div>`;

  return { subject, body_text, body_html };
}

// Export all templates
export const EmailTemplates = {
  campaignAssetRequirements,
  assetPackValidationFailed,
  assetPackApproved,
  staticMocksReady,
  revisionChangelog,
  animatedCreativesReady,
  allCreativesApproved
};
