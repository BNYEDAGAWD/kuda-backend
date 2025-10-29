/**
 * Swagger/OpenAPI Configuration for KUDA Backend
 *
 * Generates interactive API documentation for all 23 Phase 2 endpoints.
 * Access at: http://localhost:4000/api-docs
 */

import swaggerJsdoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'KUDA API - Kargo Unified Design Approval',
    version: '2.0.0',
    description: `
# KUDA Backend API Documentation

The KUDA (Kargo Unified Design Approval) API provides comprehensive workflow automation for creative approval campaigns.

## Features

### Phase 1: Enhanced Asset Processing
- **Logo Detection**: Automatic brand logo identification
- **Color Extraction**: Dominant color palette extraction
- **Document Scanning**: PDF brief parsing and analysis
- **Minimal Brief**: Smart brief requirement detection

### Phase 2: Ultimate Workflow
- **Three-Tier Access Control**: Kuda Ocean, Kuda River, Kuda Minnow
- **Smart Notification Timing**: Tue-Thu 10AM-4PM algorithm
- **Email Threading**: Gmail API integration for single-thread continuity
- **Auto-Generated Changelogs**: Revision change documentation

## Authentication

All API endpoints require JWT authentication. Include the JWT token in the Authorization header:

\`\`\`
Authorization: Bearer <jwt_token>
\`\`\`

## Rate Limiting

- **General API**: 100 requests per minute
- **Gmail API**: 250 quota units per second
- **Notification Processing**: 50 notifications per 5-minute batch

## Base URL

- **Development**: http://localhost:4000
- **Staging**: https://kuda-staging.kargo.com
- **Production**: https://kuda.kargo.com
    `,
    contact: {
      name: 'Kargo Engineering Team',
      email: 'engineering@kargo.com',
      url: 'https://kargo.com'
    },
    license: {
      name: 'Proprietary',
      url: 'https://kargo.com/legal'
    }
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Development server'
    },
    {
      url: 'https://kuda-staging.kargo.com',
      description: 'Staging server'
    },
    {
      url: 'https://kuda.kargo.com',
      description: 'Production server'
    }
  ],
  tags: [
    {
      name: 'Health',
      description: 'Service health and monitoring endpoints'
    },
    {
      name: 'Access Control',
      description: 'Campaign access management (Phase 2) - 7 endpoints'
    },
    {
      name: 'Notifications',
      description: 'Smart notification scheduling and delivery (Phase 2) - 7 endpoints'
    },
    {
      name: 'Email Threads',
      description: 'Email thread management via Gmail API (Phase 2) - 5 endpoints'
    },
    {
      name: 'Changelogs',
      description: 'Revision changelog generation (Phase 2) - 4 endpoints'
    },
    {
      name: 'Campaigns',
      description: 'Campaign management endpoints (Phase 1)'
    },
    {
      name: 'Asset Packs',
      description: 'Asset pack upload and validation (Phase 1)'
    },
    {
      name: 'Deliverables',
      description: 'Creative deliverable management (Phase 1)'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token'
      }
    },
    schemas: {
      // Phase 2 Schemas
      AccessTier: {
        type: 'string',
        enum: ['kuda_ocean', 'kuda_river', 'kuda_minnow'],
        description: `
Access tier levels:
- **kuda_ocean**: Full control (AMs, designers, engineers)
- **kuda_river**: Client approval (client stakeholders)
- **kuda_minnow**: View-only (observers)
        `
      },
      CampaignAccess: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          campaign_id: { type: 'string', format: 'uuid' },
          user_email: { type: 'string', format: 'email' },
          access_tier: { $ref: '#/components/schemas/AccessTier' },
          granted_by: { type: 'string', format: 'email' },
          granted_at: { type: 'string', format: 'date-time' },
          revoked_at: { type: 'string', format: 'date-time', nullable: true },
          is_active: { type: 'boolean' },
          notes: { type: 'string', nullable: true }
        }
      },
      AccessPermissions: {
        type: 'object',
        properties: {
          can_view_campaign: { type: 'boolean' },
          can_upload_assets: { type: 'boolean' },
          can_approve_assets: { type: 'boolean' },
          can_reject_assets: { type: 'boolean' },
          can_upload_deliverables: { type: 'boolean' },
          can_approve_deliverables: { type: 'boolean' },
          can_reject_deliverables: { type: 'boolean' },
          can_grant_access: { type: 'boolean' },
          can_revoke_access: { type: 'boolean' },
          can_override_smart_timing: { type: 'boolean' },
          can_send_manual_email: { type: 'boolean' },
          can_view_email_threads: { type: 'boolean' },
          can_reply_to_threads: { type: 'boolean' },
          can_edit_changelogs: { type: 'boolean' }
        }
      },
      ScheduledNotification: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          notification_type: { type: 'string' },
          reference_type: { type: 'string', enum: ['campaign', 'asset_pack', 'deliverable', 'revision'] },
          reference_id: { type: 'string', format: 'uuid' },
          sender_tier: { type: 'string', enum: ['kuda_ocean', 'system'] },
          recipients: {
            type: 'object',
            properties: {
              to: { type: 'array', items: { type: 'string', format: 'email' } },
              cc: { type: 'array', items: { type: 'string', format: 'email' } },
              bcc: { type: 'array', items: { type: 'string', format: 'email' } }
            }
          },
          requested_send_time: { type: 'string', format: 'date-time' },
          calculated_send_time: { type: 'string', format: 'date-time' },
          actual_send_time: { type: 'string', format: 'date-time', nullable: true },
          timing_rule_applied: { type: 'string', nullable: true },
          was_delayed: { type: 'boolean' },
          delay_reason: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['pending', 'sent', 'failed', 'cancelled'] },
          failure_reason: { type: 'string', nullable: true }
        }
      },
      EmailThread: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          campaign_id: { type: 'string', format: 'uuid' },
          thread_id: { type: 'string', description: 'Gmail thread ID' },
          subject: { type: 'string' },
          thread_type: { type: 'string' },
          gmail_message_ids: { type: 'array', items: { type: 'string' } },
          participants: {
            type: 'object',
            properties: {
              to: { type: 'array', items: { type: 'string', format: 'email' } },
              cc: { type: 'array', items: { type: 'string', format: 'email' } },
              bcc: { type: 'array', items: { type: 'string', format: 'email' } }
            }
          },
          total_messages: { type: 'integer' },
          last_message_at: { type: 'string', format: 'date-time', nullable: true },
          thread_status: { type: 'string', enum: ['active', 'resolved', 'archived'] }
        }
      },
      RevisionChangelog: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          deliverable_id: { type: 'string', format: 'uuid' },
          revision_number: { type: 'integer' },
          previous_version_id: { type: 'string', format: 'uuid', nullable: true },
          changes_detected: {
            type: 'object',
            properties: {
              font: { type: 'array', items: { type: 'string' } },
              color: { type: 'array', items: { type: 'string' } },
              layout: { type: 'array', items: { type: 'string' } },
              copy: { type: 'array', items: { type: 'string' } },
              video: { type: 'array', items: { type: 'string' } }
            }
          },
          total_changes: { type: 'integer' },
          changelog_text: { type: 'string' },
          changelog_html: { type: 'string', nullable: true },
          generated_at: { type: 'string', format: 'date-time' }
        }
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' }
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ]
};

const options: swaggerJsdoc.Options = {
  swaggerDefinition,
  apis: [
    './src/routes/*.ts',
    './src/routes/**/*.ts'
  ]
};

export const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
