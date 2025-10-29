# KCAP System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         KCAP Platform                            │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │   Client   │  │     AM     │  │  Designer  │                │
│  │   Portal   │  │ Dashboard  │  │  Workflow  │                │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘                │
│        │               │               │                        │
│        └───────────────┴───────────────┘                        │
│                        │                                        │
│                   REST API                                      │
│                        │                                        │
│  ┌─────────────────────┴─────────────────────┐                 │
│  │          Express.js API Server            │                 │
│  │                                            │                 │
│  │  ┌──────────────────────────────────┐    │                 │
│  │  │         Route Layer              │    │                 │
│  │  │  • campaign.routes.ts            │    │                 │
│  │  │  • asset-pack.routes.ts          │    │                 │
│  │  │  • deliverable.routes.ts         │    │                 │
│  │  │  • approval.routes.ts            │    │                 │
│  │  │  • sla.routes.ts                 │    │                 │
│  │  └──────────────┬───────────────────┘    │                 │
│  │                 │                         │                 │
│  │  ┌──────────────▼───────────────────┐    │                 │
│  │  │       Service Layer              │    │                 │
│  │  │  • format.service.ts             │    │                 │
│  │  │  • campaign.service.ts           │    │                 │
│  │  │  • asset-pack.service.ts         │    │                 │
│  │  │  • deliverable.service.ts        │    │                 │
│  │  │  • approval.service.ts           │    │                 │
│  │  │  • sla-timer.service.ts          │    │                 │
│  │  │  • notification.service.ts       │    │                 │
│  │  └──────────────┬───────────────────┘    │                 │
│  │                 │                         │                 │
│  └─────────────────┼─────────────────────────┘                 │
│                    │                                            │
│  ┌─────────────────▼─────────────────────┐                     │
│  │        PostgreSQL Database            │                     │
│  │                                        │                     │
│  │  • format_library (21 formats)        │                     │
│  │  • campaigns                           │                     │
│  │  • campaign_formats                    │                     │
│  │  • asset_packs                         │                     │
│  │  • asset_pack_files                    │                     │
│  │  • deliverables                        │                     │
│  │  • deliverable_demo_urls               │                     │
│  │  • deliverable_revisions               │                     │
│  │  • format_approvals                    │                     │
│  │  • sla_timers                          │                     │
│  │  • portal_notifications                │                     │
│  └────────────────────────────────────────┘                     │
│                                                                  │
│  ┌────────────────────────────────────────┐                     │
│  │      External Services                 │                     │
│  │  • AWS S3 (file storage)               │                     │
│  │  • Gmail API (notifications)           │                     │
│  │  • Celtra (demo URL hosting)           │                     │
│  └────────────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### Phase 1: Asset Pack Submission

```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ 1. Upload assets (files/ZIP)
     │
     ▼
┌─────────────────┐
│ asset-pack.     │  2. Extract ZIP
│ service         ├──────────────┐
└────┬────────────┘              │
     │                           ▼
     │ 3. Save files        ┌─────────┐
     │                      │  AWS S3 │
     ▼                      └─────────┘
┌─────────────────┐
│ PostgreSQL      │
│ • asset_packs   │
│ • asset_pack_   │
│   files         │
└─────────────────┘

     │
     │ 4. AM reviews
     │
     ▼
┌─────────────────┐
│ AM Dashboard    │
└────┬────────────┘
     │
     │ 5a. Approve OR 5b. Reject
     │
     ▼
┌─────────────────┐
│ sla-timer.      │  Approve: Start 48h timer
│ service         │  Reject: Send email notification
└─────────────────┘
```

### Phase 2: Static Mock Production & Approval

```
┌─────────┐
│Designer │
└────┬────┘
     │
     │ 1. Build static mocks (48h SLA)
     │
     ▼
┌─────────────────┐
│ AM Dashboard    │
└────┬────────────┘
     │
     │ 2. Upload Google Slides/Dropbox URL
     │
     ▼
┌─────────────────┐
│ deliverable.    │
│ service         │
└────┬────────────┘
     │
     │ 3. Mark ready for review
     │
     ▼
┌─────────────────┐
│ Client Portal   │
└────┬────────────┘
     │
     │ 4. Review deliverable
     │
     ▼
┌─────────────────┐
│ approval.       │
│ service         │
└────┬────────────┘
     │
     │ 5a. Approve (format OR device)
     │ 5b. Reject with feedback
     │
     ▼
┌─────────────────┐
│ format_         │
│ approvals       │
└─────────────────┘
```

### Phase 3: Animated Production & Approval

```
┌─────────┐
│Designer │
└────┬────┘
     │
     │ 1. Build animated (48h SLA)
     │
     ▼
┌─────────────────┐
│ AM Dashboard    │
└────┬────────────┘
     │
     │ 2. Upload to Celtra
     │
     ▼
┌─────────────────┐
│ Celtra Platform │
└────┬────────────┘
     │
     │ 3. Get demo URLs
     │    (per format, per device)
     │
     ▼
┌─────────────────┐
│ deliverable.    │
│ service         │
│ • Add demo URLs │
└────┬────────────┘
     │
     ▼
┌─────────────────┐
│ deliverable_    │
│ demo_urls       │
│                 │
│ Format: Venti   │
│ • desktop URL   │
│ • mobile URL    │
│ • tablet URL    │
└─────────────────┘
     │
     │ 4. Client reviews
     │
     ▼
┌─────────────────┐
│ Client Portal   │
│ • View per      │
│   device        │
│ • Approve/      │
│   Reject        │
└─────────────────┘
```

## Service Layer Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     Service Layer                           │
│                                                             │
│  ┌──────────────────────────────────────────────────┐      │
│  │ format.service.ts                                │      │
│  │ • getAllFormats()                                │      │
│  │ • getFormatsByType(video|display|ctv)            │      │
│  │ • getDevicesForFormat(formatId)                  │      │
│  │ • validateFormatDevice(formatId, device)         │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
│  ┌──────────────────────────────────────────────────┐      │
│  │ campaign.service.ts                              │      │
│  │ • createCampaign(data)                           │      │
│  │ • addFormatToCampaign(campaignId, formatId)      │      │
│  │ • generatePortalLink(campaignId)                 │      │
│  │ • updateCampaignStatus(campaignId, status)       │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
│  ┌──────────────────────────────────────────────────┐      │
│  │ asset-pack.service.ts                            │      │
│  │ • uploadAssetPack(files, campaignId)             │      │
│  │   ├─ Extract ZIP if present                      │      │
│  │   ├─ Auto-categorize files                       │      │
│  │   └─ Upload to S3                                │      │
│  │ • approveAssetPack(id, reviewedBy)               │      │
│  │   └─ Start 48h SLA timer                         │      │
│  │ • rejectAssetPack(id, reviewedBy, note)          │      │
│  │   ├─ VALIDATE note not empty                     │      │
│  │   └─ Send rejection email                        │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
│  ┌──────────────────────────────────────────────────┐      │
│  │ deliverable.service.ts                           │      │
│  │ • createDeliverable(type, url, round, revision)  │      │
│  │ • addDemoUrl(deliverableId, formatId, device)    │      │
│  │   └─ VALIDATE device supported for format        │      │
│  │ • markDeliverableReady(deliverableId)            │      │
│  │ • createRevision(originalId, changesSummary)     │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
│  ┌──────────────────────────────────────────────────┐      │
│  │ approval.service.ts                              │      │
│  │ • approveFormat(deliverableId, formatId)         │      │
│  │   └─ Approves ALL devices for format             │      │
│  │ • rejectFormat(deliverableId, formatId, feedback)│      │
│  │   └─ VALIDATE feedback not empty                 │      │
│  │ • approveDevice(deliverableId, formatId, device) │      │
│  │   └─ Approves single device view                 │      │
│  │ • rejectDevice(deliverableId, formatId, device)  │      │
│  │   └─ VALIDATE feedback not empty                 │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
│  ┌──────────────────────────────────────────────────┐      │
│  │ sla-timer.service.ts                             │      │
│  │ • startTimer(type, refId, durationHours)         │      │
│  │   └─ Auto-calculate deadline via DB trigger      │      │
│  │ • getActiveTimers()                              │      │
│  │   └─ Returns with hours_remaining calculated     │      │
│  │ • adjustTimer(timerId, newDuration, reason)      │      │
│  │   ├─ Preserve original_duration_hours            │      │
│  │   └─ Recalculate deadline                        │      │
│  │ • completeTimer(timerId)                         │      │
│  └──────────────────────────────────────────────────┘      │
│                                                             │
│  ┌──────────────────────────────────────────────────┐      │
│  │ notification.service.ts                          │      │
│  │ • notifyAssetPackRejected(id, email, note)       │      │
│  │ • notifyDeliverableReady(id, email, type)        │      │
│  └──────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────┘
```

## Database Schema Relationships

```
┌──────────────────┐
│ format_library   │
│ (21 formats)     │
└────────┬─────────┘
         │
         │ Many-to-Many
         │
         ▼
┌──────────────────┐         ┌──────────────────┐
│ campaign_formats │◄────────│ campaigns        │
│                  │         │                  │
└────────┬─────────┘         └────────┬─────────┘
         │                            │
         │                            │ One-to-Many
         │                            │
         │                            ▼
         │                   ┌──────────────────┐
         │                   │ asset_packs      │
         │                   │                  │
         │                   └────────┬─────────┘
         │                            │
         │                            │ One-to-Many
         │                            │
         │                            ▼
         │                   ┌──────────────────┐
         │                   │ asset_pack_files │
         │                   │ • Auto-categorize│
         │                   │ • ZIP extraction │
         │                   └──────────────────┘
         │
         │
         │                   ┌──────────────────┐
         │                   │ deliverables     │
         │                   │ • static_mock    │
         │                   │ • animated       │
         │                   └────────┬─────────┘
         │                            │
         ├────────────────────────────┤
         │                            │
         │                            │ One-to-Many
         │                            │
         ▼                            ▼
┌──────────────────┐         ┌──────────────────┐
│ deliverable_     │         │ deliverable_     │
│ demo_urls        │         │ revisions        │
│ • Per device     │         │ • R1, R1.1, R1.2 │
└──────────────────┘         └──────────────────┘
         │
         │
         ▼
┌──────────────────┐
│ format_approvals │
│ • Hybrid approval│
│ • Format-level   │
│ • Device-level   │
│ • MANDATORY      │
│   feedback       │
└──────────────────┘

┌──────────────────┐
│ sla_timers       │
│ • 48h/24h        │
│ • Auto-calculate │
│ • AM adjustable  │
└──────────────────┘

┌──────────────────┐
│ portal_          │
│ notifications    │
└──────────────────┘
```

## Critical Features Implementation

### 1. Mandatory Rejection Feedback

```
┌─────────────────────────────────────────────────────────┐
│              Enforcement Layers                          │
│                                                          │
│  Layer 1: API Validation                                │
│  ┌────────────────────────────────────────────┐         │
│  │ if (!feedback?.trim()) {                   │         │
│  │   throw new Error('Feedback MANDATORY');   │         │
│  │ }                                           │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  Layer 2: Database CHECK Constraint                     │
│  ┌────────────────────────────────────────────┐         │
│  │ CHECK (                                     │         │
│  │   (status != 'rejected') OR                │         │
│  │   (status = 'rejected' AND                 │         │
│  │    rejection_note IS NOT NULL)             │         │
│  │ )                                           │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  Result: IMPOSSIBLE to reject without feedback          │
└─────────────────────────────────────────────────────────┘
```

### 2. Hybrid Approval Pattern

```
┌─────────────────────────────────────────────────────────┐
│           Approval Flexibility                           │
│                                                          │
│  Option A: Format-Level Approval                        │
│  ┌────────────────────────────────────────────┐         │
│  │ POST /api/approvals/format/approve         │         │
│  │ {                                           │         │
│  │   "deliverable_id": "123",                 │         │
│  │   "format_id": "venti-video"               │         │
│  │ }                                           │         │
│  │                                             │         │
│  │ Approves: Desktop + Mobile + Tablet         │         │
│  │ All at once                                 │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  Option B: Device-Level Approval                        │
│  ┌────────────────────────────────────────────┐         │
│  │ POST /api/approvals/device/approve         │         │
│  │ { "device": "desktop" } ✅                 │         │
│  │                                             │         │
│  │ POST /api/approvals/device/reject          │         │
│  │ { "device": "mobile",                      │         │
│  │   "feedback": "Logo cut off" } ❌          │         │
│  │                                             │         │
│  │ POST /api/approvals/device/approve         │         │
│  │ { "device": "tablet" } ✅                  │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  Result: Maximum client flexibility                     │
└─────────────────────────────────────────────────────────┘
```

### 3. SLA Timer Auto-Calculation

```
┌─────────────────────────────────────────────────────────┐
│         Automatic Deadline Calculation                   │
│                                                          │
│  Database Trigger:                                       │
│  ┌────────────────────────────────────────────┐         │
│  │ CREATE FUNCTION calculate_sla_deadline()   │         │
│  │ RETURNS TRIGGER AS $$                      │         │
│  │ BEGIN                                       │         │
│  │   NEW.deadline = NEW.started_at +          │         │
│  │     (NEW.duration_hours || ' hours');      │         │
│  │   RETURN NEW;                               │         │
│  │ END;                                        │         │
│  └────────────────────────────────────────────┘         │
│                                                          │
│  Example:                                                │
│  started_at: 2025-10-28 10:00:00                        │
│  duration_hours: 48                                      │
│  deadline: 2025-10-30 10:00:00 (auto-calculated)        │
│                                                          │
│  AM Adjustment:                                          │
│  duration_hours: 48 → 72                                │
│  deadline: 2025-10-31 10:00:00 (recalculated)           │
│  original_duration_hours: 48 (preserved)                │
└─────────────────────────────────────────────────────────┘
```

## 21 Kargo Format Device Support

```
┌──────────────────────────────────────────────────────────────┐
│                    Format Device Matrix                       │
│                                                               │
│  Cross-Platform (15 formats)                                 │
│  ┌─────────────────────────────┬──────────────────────┐      │
│  │ Format                      │ Devices              │      │
│  ├─────────────────────────────┼──────────────────────┤      │
│  │ Venti Video                 │ Desktop, Mobile, Tab │      │
│  │ Venti Display               │ Desktop, Mobile, Tab │      │
│  │ Venti Video Shoppable       │ Desktop, Mobile, Tab │      │
│  │ Runway Video                │ Desktop, Mobile, Tab │      │
│  │ Runway Display              │ Desktop, Mobile, Tab │      │
│  │ Runway Core                 │ Desktop, Mobile, Tab │      │
│  │ Runway Wheel Core           │ Desktop, Mobile, Tab │      │
│  │ Spotlight Video             │ Desktop, Mobile, Tab │      │
│  │ Spotlight Display           │ Desktop, Mobile, Tab │      │
│  │ Breakaway Display           │ Desktop, Mobile, Tab │      │
│  │ Enhance Pre-Roll OLV        │ Desktop, Mobile, Tab │      │
│  │ Interactive Pre-Roll        │ Desktop, Mobile, Tab │      │
│  │ Top Banner                  │ Desktop, Mobile, Tab │      │
│  │ Middle Banner               │ Desktop, Mobile, Tab │      │
│  │ Uptick                      │ Desktop, Mobile, Tab │      │
│  └─────────────────────────────┴──────────────────────┘      │
│                                                               │
│  Mobile-Only (2 formats)                                     │
│  ┌─────────────────────────────┬──────────────────────┐      │
│  │ Lighthouse Display          │ Mobile ONLY          │      │
│  │ Lighthouse Video            │ Mobile ONLY          │      │
│  └─────────────────────────────┴──────────────────────┘      │
│                                                               │
│  CTV-Only (4 formats)                                        │
│  ┌─────────────────────────────┬──────────────────────┐      │
│  │ Enhanced CTV Branded Canvas │ CTV ONLY             │      │
│  │ Enhanced CTV Mirage         │ CTV ONLY             │      │
│  │ Enhanced CTV Tiles          │ CTV ONLY             │      │
│  │ Enhanced CTV Flipbook       │ CTV ONLY             │      │
│  └─────────────────────────────┴──────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

---

**Backend Foundation: COMPLETE ✅**

All architecture components implemented and documented.
