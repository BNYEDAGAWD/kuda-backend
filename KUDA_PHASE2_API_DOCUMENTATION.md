# KUDA Phase 2 - API Documentation

**Last Updated**: 2025-10-28
**Version**: Phase 2 Integration Complete
**Status**: ✅ Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Access Control API](#access-control-api)
4. [Notification API](#notification-api)
5. [Email Thread API](#email-thread-api)
6. [Changelog API](#changelog-api)
7. [Error Handling](#error-handling)
8. [Rate Limiting](#rate-limiting)
9. [Examples](#examples)

---

## Overview

The KUDA Phase 2 API provides comprehensive workflow automation for creative approval campaigns, including:

- **Three-tier access control** (Kuda Ocean, Kuda River, Kuda Minnow)
- **Smart notification timing** (Tue-Thu 10AM-4PM algorithm)
- **Email threading** (Gmail API integration)
- **Revision changelogs** (auto-generated change documentation)

### Base URL

```
Production:  https://kuda.kargo.com/api
Staging:     https://kuda-staging.kargo.com/api
Development: http://localhost:4000/api
```

### API Versioning

All Phase 2 endpoints are under `/api/v1` (versioning prefix).

---

## Authentication

All API requests require authentication via JWT token in the `Authorization` header.

### Headers

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### User Context

Authenticated requests automatically attach user context:

```typescript
req.user = {
  email: "user@example.com",
  name: "John Doe",
  role: "account_manager"
}
```

---

## Access Control API

Manage campaign access and permissions.

### Base Path

```
/api/campaigns/:campaign_id/access
```

---

### Grant Access

**Endpoint**: `POST /api/campaigns/:campaign_id/access/grant`
**Permission**: `can_grant_access` (Kuda Ocean only)

Grant access to a user for a campaign.

**Request Body**:
```json
{
  "user_email": "client@example.com",
  "access_tier": "kuda_river",
  "notes": "Primary client stakeholder"
}
```

**Access Tiers**:
- `kuda_ocean` - Full control (AMs, designers, engineers)
- `kuda_river` - Client approval (client stakeholders)
- `kuda_minnow` - View-only (observers)

**Response** (201 Created):
```json
{
  "success": true,
  "access": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "campaign_id": "123e4567-e89b-12d3-a456-426614174000",
    "user_email": "client@example.com",
    "access_tier": "kuda_river",
    "granted_by": "am@kargo.com",
    "granted_at": "2025-10-28T10:00:00Z",
    "is_active": true,
    "notes": "Primary client stakeholder"
  }
}
```

---

### Batch Grant Access

**Endpoint**: `POST /api/campaigns/:campaign_id/access/batch-grant`
**Permission**: `can_grant_access` (Kuda Ocean only)

Grant access to multiple users simultaneously.

**Request Body**:
```json
{
  "users": [
    {
      "user_email": "client1@example.com",
      "access_tier": "kuda_river",
      "notes": "Primary contact"
    },
    {
      "user_email": "client2@example.com",
      "access_tier": "kuda_minnow",
      "notes": "Observer"
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "access_list": [...],
  "count": 2
}
```

---

### Revoke Access

**Endpoint**: `DELETE /api/campaigns/:campaign_id/access/:user_email`
**Permission**: `can_revoke_access` (Kuda Ocean only)

Revoke a user's access to a campaign.

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Access revoked successfully"
}
```

---

### Update Access Tier

**Endpoint**: `PATCH /api/campaigns/:campaign_id/access/:access_id`
**Permission**: `can_grant_access` (Kuda Ocean only)

Update a user's access tier.

**Request Body**:
```json
{
  "new_tier": "kuda_ocean"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "access": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "access_tier": "kuda_ocean",
    "updated_at": "2025-10-28T11:00:00Z"
  }
}
```

---

### Get Campaign Access

**Endpoint**: `GET /api/campaigns/:campaign_id/access`
**Permission**: `can_view_campaign`

Get all access records for a campaign.

**Response** (200 OK):
```json
{
  "success": true,
  "access_list": [
    {
      "id": "...",
      "user_email": "am@kargo.com",
      "access_tier": "kuda_ocean",
      "granted_by": "system",
      "granted_at": "2025-10-28T09:00:00Z"
    },
    {
      "id": "...",
      "user_email": "client@example.com",
      "access_tier": "kuda_river",
      "granted_by": "am@kargo.com",
      "granted_at": "2025-10-28T10:00:00Z"
    }
  ],
  "count": 2
}
```

---

### Get My Access

**Endpoint**: `GET /api/campaigns/:campaign_id/access/me`
**Permission**: `can_view_campaign`

Get current user's access and permissions for a campaign.

**Response** (200 OK):
```json
{
  "success": true,
  "access": {
    "id": "...",
    "access_tier": "kuda_ocean",
    "granted_at": "2025-10-28T09:00:00Z"
  },
  "permissions": {
    "can_view_campaign": true,
    "can_upload_assets": true,
    "can_approve_assets": true,
    "can_reject_assets": true,
    "can_upload_deliverables": true,
    "can_approve_deliverables": true,
    "can_reject_deliverables": true,
    "can_grant_access": true,
    "can_revoke_access": true,
    "can_override_smart_timing": true,
    "can_send_manual_email": true,
    "can_view_email_threads": true,
    "can_reply_to_threads": true,
    "can_edit_changelogs": true
  }
}
```

---

### Get Access Statistics

**Endpoint**: `GET /api/campaigns/:campaign_id/access/stats`
**Permission**: `can_view_campaign`

Get access statistics for a campaign.

**Response** (200 OK):
```json
{
  "success": true,
  "stats": {
    "total_users": 5,
    "kuda_ocean_count": 2,
    "kuda_river_count": 2,
    "kuda_minnow_count": 1,
    "active_users": 5,
    "revoked_users": 0
  }
}
```

---

## Notification API

Manage notification scheduling and delivery.

### Base Path

```
/api/campaigns/:campaign_id/notifications
/api/notifications
```

---

### Schedule Notification

**Endpoint**: `POST /api/campaigns/:campaign_id/notifications/schedule`
**Permission**: `can_send_manual_email` (Kuda Ocean only)

Schedule a notification with smart timing.

**Request Body**:
```json
{
  "notification_type": "static_mocks_ready",
  "reference_type": "deliverable",
  "reference_id": "abc123",
  "recipients": {
    "to": ["client@example.com"],
    "cc": ["am@kargo.com"],
    "bcc": []
  },
  "template_name": "staticMocksReady",
  "template_data": {
    "campaign_name": "Amazon Q4 Campaign",
    "campaign_id": "123e4567",
    "approved_formats": ["970x250", "728x90"],
    "demo_url": "https://kuda.kargo.com/demo/abc123"
  },
  "requested_send_time": "2025-10-28T15:30:00Z"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "notification": {
    "id": "notification-123",
    "notification_type": "static_mocks_ready",
    "sender_tier": "kuda_ocean",
    "requested_send_time": "2025-10-28T15:30:00Z",
    "calculated_send_time": "2025-10-29T10:00:00Z",
    "timing_rule_applied": "next_optimal_window",
    "was_delayed": true,
    "delay_reason": "Outside optimal window - scheduled for next Tue-Thu 10AM",
    "status": "pending",
    "created_at": "2025-10-28T15:00:00Z"
  }
}
```

**Timing Rules** (Smart Timing Algorithm):
1. **Immediate** - Kuda Ocean sender or rejection emails
2. **Friday PM → Tuesday 10AM** - Avoid 96-hour weekend delay
3. **Weekend → Tuesday 10AM** - Avoid weekend sends
4. **Monday → Tuesday 10AM** - Avoid inbox overload
5. **Tue-Thu before 4PM → Send within 1 hour** - Optimal window
6. **Otherwise → Next Tue-Thu 10-11AM** - Next optimal window

---

### Process Notifications

**Endpoint**: `POST /api/notifications/process`
**Permission**: System/Admin only

Manually trigger notification processing (typically called by cron job).

**Response** (200 OK):
```json
{
  "success": true,
  "results": [
    {
      "notification": {...},
      "gmail_message_id": "msg-123"
    },
    {
      "notification": {...},
      "error": "Gmail API rate limit exceeded"
    }
  ],
  "stats": {
    "total": 10,
    "sent": 9,
    "failed": 1
  }
}
```

---

### Get Campaign Notifications

**Endpoint**: `GET /api/campaigns/:campaign_id/notifications`
**Permission**: `can_view_campaign`

Get all notifications for a campaign.

**Response** (200 OK):
```json
{
  "success": true,
  "notifications": [...],
  "count": 15
}
```

---

### Get Notification

**Endpoint**: `GET /api/notifications/:notification_id`

Get notification by ID.

**Response** (200 OK):
```json
{
  "success": true,
  "notification": {
    "id": "notification-123",
    "notification_type": "static_mocks_ready",
    "status": "sent",
    "actual_send_time": "2025-10-29T10:05:00Z",
    "gmail_message_id": "msg-123",
    "gmail_thread_id": "thread-456"
  }
}
```

---

### Cancel Notification

**Endpoint**: `DELETE /api/notifications/:notification_id`
**Permission**: Kuda Ocean only

Cancel a pending notification.

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Notification cancelled successfully"
}
```

---

### Reschedule Notification

**Endpoint**: `POST /api/notifications/:notification_id/reschedule`
**Permission**: Kuda Ocean only

Reschedule a failed notification.

**Request Body**:
```json
{
  "new_send_time": "2025-10-30T10:00:00Z"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "notification": {
    "id": "notification-123",
    "status": "pending",
    "calculated_send_time": "2025-10-30T10:00:00Z"
  }
}
```

---

### Get Notification Stats

**Endpoint**: `GET /api/notifications/stats?days=30`

Get notification statistics.

**Query Parameters**:
- `days` (optional, default: 30) - Number of days to analyze

**Response** (200 OK):
```json
{
  "success": true,
  "stats": {
    "total_scheduled": 150,
    "total_sent": 145,
    "total_failed": 3,
    "total_pending": 2,
    "avg_delay_minutes": 480.5,
    "delayed_percentage": 65.3,
    "immediate_sends": 52,
    "optimal_window_sends": 93
  },
  "period_days": 30
}
```

---

## Email Thread API

Manage email threads for campaigns.

### Base Path

```
/api/campaigns/:campaign_id/threads
/api/threads
```

---

### Get Campaign Threads

**Endpoint**: `GET /api/campaigns/:campaign_id/threads`
**Permission**: `can_view_email_threads`

Get all email threads for a campaign.

**Response** (200 OK):
```json
{
  "success": true,
  "threads": [
    {
      "id": "thread-db-123",
      "campaign_id": "campaign-123",
      "thread_id": "gmail-thread-456",
      "subject": "[KUDA] Amazon Q4 - Static Mocks Ready",
      "thread_type": "deliverable_submission",
      "gmail_message_ids": ["msg-1", "msg-2", "msg-3"],
      "participants": {
        "to": ["client@example.com"],
        "cc": ["am@kargo.com"],
        "bcc": []
      },
      "total_messages": 3,
      "last_message_at": "2025-10-28T14:30:00Z",
      "thread_status": "active",
      "created_at": "2025-10-28T10:00:00Z"
    }
  ],
  "count": 5
}
```

**Thread Types**:
- `campaign_kickoff`
- `asset_pack_submission`
- `asset_pack_feedback`
- `deliverable_submission`
- `deliverable_feedback`
- `revision_submission`
- `final_approval`

---

### Get Thread

**Endpoint**: `GET /api/threads/:thread_id`

Get email thread by ID.

**Response** (200 OK):
```json
{
  "success": true,
  "thread": {...}
}
```

---

### Archive Thread

**Endpoint**: `POST /api/threads/:thread_id/archive`
**Permission**: Kuda Ocean only

Archive a thread (change status to 'archived').

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Thread archived successfully"
}
```

---

### Resolve Thread

**Endpoint**: `POST /api/threads/:thread_id/resolve`

Resolve a thread (mark as complete).

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Thread resolved successfully"
}
```

---

### Get Thread Stats

**Endpoint**: `GET /api/campaigns/:campaign_id/threads/stats`
**Permission**: `can_view_campaign`

Get thread statistics for a campaign.

**Response** (200 OK):
```json
{
  "success": true,
  "stats": {
    "total_threads": 5,
    "active_threads": 2,
    "resolved_threads": 2,
    "archived_threads": 1,
    "total_messages": 25,
    "avg_messages_per_thread": 5.0
  }
}
```

---

## Changelog API

Manage revision changelogs.

### Base Path

```
/api/deliverables/:deliverable_id/changelogs
/api/changelogs
```

---

### Generate Changelog

**Endpoint**: `POST /api/deliverables/:deliverable_id/changelogs/generate`
**Permission**: `can_edit_changelogs` (Kuda Ocean only)

Generate changelog for a deliverable revision.

**Request Body**:
```json
{
  "revision_number": 2,
  "previous_version_id": "deliverable-v1",
  "metadata_current": {
    "fonts": {
      "heading": "Helvetica",
      "body": "Arial",
      "size": 16
    },
    "colors": {
      "primary": "#0066CC",
      "secondary": "#28A745"
    },
    "layout": {
      "logo_position": { "x": 100, "y": 50 },
      "logo_size": 120
    },
    "copy": {
      "headline": "Shop Now",
      "cta": "Learn More"
    }
  },
  "metadata_previous": {
    "fonts": {
      "heading": "Arial",
      "body": "Arial",
      "size": 14
    },
    "colors": {
      "primary": "#0055BB",
      "secondary": "#28A745"
    },
    "layout": {
      "logo_position": { "x": 100, "y": 70 },
      "logo_size": 100
    },
    "copy": {
      "headline": "Buy Now",
      "cta": "Learn More"
    }
  }
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "changelog": {
    "id": "changelog-123",
    "deliverable_id": "deliverable-456",
    "revision_number": 2,
    "changes_detected": {
      "font": [
        "Heading font changed from Arial to Helvetica",
        "Font size changed from 14px to 16px"
      ],
      "color": [
        "Primary color changed from #0055BB to #0066CC"
      ],
      "layout": [
        "Logo repositioned from (100,70) to (100,50)",
        "Logo size changed from 100px to 120px"
      ],
      "copy": [
        "Headline updated from \"Buy Now\" to \"Shop Now\""
      ],
      "video": []
    },
    "total_changes": 5,
    "changelog_text": "Font (2 changes):\n  - Heading font changed from Arial to Helvetica\n  - Font size changed from 14px to 16px\n\nColor (1 change):\n  - Primary color changed from #0055BB to #0066CC\n\nLayout (2 changes):\n  - Logo repositioned from (100,70) to (100,50)\n  - Logo size changed from 100px to 120px\n\nCopy (1 change):\n  - Headline updated from \"Buy Now\" to \"Shop Now\"",
    "changelog_html": "<h4>Font (2 changes)</h4><ul><li>Heading font changed from Arial to Helvetica</li>...</ul>",
    "generated_at": "2025-10-28T15:00:00Z"
  }
}
```

**Change Detection Categories**:
- `font` - Typeface, size, weight
- `color` - Primary, secondary, background, text
- `layout` - Positioning, sizing, spacing
- `copy` - Headlines, body, CTA, disclaimers
- `video` - Duration, codec, asset replacements

---

### Get Deliverable Changelogs

**Endpoint**: `GET /api/deliverables/:deliverable_id/changelogs`
**Permission**: `can_view_campaign`

Get all changelogs for a deliverable.

**Response** (200 OK):
```json
{
  "success": true,
  "changelogs": [
    {
      "id": "changelog-1",
      "revision_number": 2,
      "total_changes": 5,
      "generated_at": "2025-10-28T15:00:00Z"
    },
    {
      "id": "changelog-2",
      "revision_number": 3,
      "total_changes": 2,
      "generated_at": "2025-10-29T10:00:00Z"
    }
  ],
  "count": 2
}
```

---

### Get Changelog

**Endpoint**: `GET /api/changelogs/:changelog_id`

Get changelog by ID.

**Response** (200 OK):
```json
{
  "success": true,
  "changelog": {...}
}
```

---

### Mark Changelog Reviewed

**Endpoint**: `POST /api/changelogs/:changelog_id/review`

Mark changelog as reviewed by current user.

**Response** (200 OK):
```json
{
  "success": true,
  "changelog": {
    "id": "changelog-123",
    "reviewed_by": "am@kargo.com",
    "reviewed_at": "2025-10-28T16:00:00Z"
  }
}
```

---

## Error Handling

All API errors follow a consistent format.

### Error Response Structure

```json
{
  "error": "Error Type",
  "message": "Human-readable error description"
}
```

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| `200` | OK | Successful GET/POST/PATCH |
| `201` | Created | Successful resource creation |
| `400` | Bad Request | Missing required fields |
| `401` | Unauthorized | Invalid/missing JWT token |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource does not exist |
| `500` | Internal Server Error | Server error |

### Common Error Scenarios

**Missing JWT Token**:
```json
{
  "error": "Unauthorized",
  "message": "User not authenticated"
}
```

**Insufficient Permissions**:
```json
{
  "error": "Forbidden",
  "message": "You do not have permission to perform this action (can_grant_access)"
}
```

**Resource Not Found**:
```json
{
  "error": "Not Found",
  "message": "Campaign not found"
}
```

**Validation Error**:
```json
{
  "error": "Bad Request",
  "message": "user_email and access_tier are required"
}
```

---

## Rate Limiting

Gmail API has rate limits that affect notification sending.

### Gmail API Limits

- **250 quota units/second** (per project)
- **1 billion quota units/day** (per project)
- **Send.messages**: 100 quota units per request

### Notification Processing

The notification cron job processes **50 notifications per batch** to stay within Gmail rate limits.

**Cron Schedule** (configurable via `.env`):
```
NOTIFICATION_CRON_SCHEDULE='*/5 * * * *'  # Every 5 minutes
```

**Processing Rate**:
- 50 notifications per batch
- Every 5 minutes
- = 600 notifications/hour max
- = 14,400 notifications/day max

---

## Examples

### Example 1: Grant Campaign Access

```bash
curl -X POST https://kuda.kargo.com/api/campaigns/campaign-123/access/grant \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_email": "client@amazon.com",
    "access_tier": "kuda_river",
    "notes": "Amazon primary contact"
  }'
```

---

### Example 2: Schedule Notification

```bash
curl -X POST https://kuda.kargo.com/api/campaigns/campaign-123/notifications/schedule \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "notification_type": "static_mocks_ready",
    "reference_type": "deliverable",
    "reference_id": "deliverable-456",
    "recipients": {
      "to": ["client@amazon.com"],
      "cc": ["am@kargo.com"]
    },
    "template_name": "staticMocksReady",
    "template_data": {
      "campaign_name": "Amazon Q4",
      "approved_formats": ["970x250", "728x90"],
      "demo_url": "https://kuda.kargo.com/demo/deliverable-456"
    }
  }'
```

---

### Example 3: Generate Changelog

```bash
curl -X POST https://kuda.kargo.com/api/deliverables/deliverable-456/changelogs/generate \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "revision_number": 2,
    "metadata_current": {
      "fonts": {
        "heading": "Helvetica",
        "size": 16
      },
      "colors": {
        "primary": "#0066CC"
      }
    },
    "metadata_previous": {
      "fonts": {
        "heading": "Arial",
        "size": 14
      },
      "colors": {
        "primary": "#0055BB"
      }
    }
  }'
```

---

### Example 4: Get My Permissions

```bash
curl -X GET https://kuda.kargo.com/api/campaigns/campaign-123/access/me \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

## Summary

Phase 2 API provides **4 core endpoints**:

1. **Access Control** (7 endpoints) - Manage three-tier access
2. **Notifications** (7 endpoints) - Schedule/send with smart timing
3. **Email Threads** (5 endpoints) - View/manage email threads
4. **Changelogs** (4 endpoints) - Generate/view revision changelogs

**Total**: 23 endpoints covering all Phase 2 workflow automation.

---

**Status**: ✅ **PHASE 2 INTEGRATION COMPLETE**

All API endpoints are implemented, tested, and ready for production deployment.
