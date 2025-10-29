# KUDA Phase 1 - Quick Start Guide

**Status**: ✅ Ready for deployment
**Estimated Setup Time**: 5 minutes
**Estimated Testing Time**: 15 minutes

---

## 🚀 Quick Start (5 Minutes)

```bash
# 1. Navigate to backend
cd projects/kargo/creative-approval-system/backend

# 2. Run automated setup
./setup-dev.sh

# This will:
# ✅ Create .env from template
# ✅ Install dependencies (sharp, pdf-parse)
# ✅ Check migration status
# ✅ Optionally run migration 102

# 3. Configure environment (if needed)
nano .env  # Update DATABASE_URL, AWS credentials, etc.

# 4. Start development server
npm run dev
```

**That's it!** Server running on http://localhost:4000

---

## 🧪 Validation Testing (15 Minutes)

```bash
# 1. Add test files to test-assets/ directory
# - Logo files (< 500x500px PNG/SVG)
# - Brand guidelines PDF
# - Campaign brief PDF
# See test-assets/README.md for details

# 2. Run automated tests
./test-phase1.sh

# Expected output:
# ✅ Upload successful
# ✅ Processing time < 2 minutes
# ✅ Logo detection working
# ✅ Color extraction working
# ✅ Document scanning working
# ✅ Brief generation working
# ✅ All API endpoints responding
```

---

## 📚 Documentation Index

### Start Here
1. **[README_PHASE1_QUICK_START.md](README_PHASE1_QUICK_START.md)** ← You are here
2. **[KUDA_PHASE1_IMPLEMENTATION_READINESS.md](KUDA_PHASE1_IMPLEMENTATION_READINESS.md)** ← Comprehensive deployment guide

### Implementation Details
3. [KUDA_PHASE1_BACKEND_VERIFICATION_COMPLETE.md](KUDA_PHASE1_BACKEND_VERIFICATION_COMPLETE.md) - Complete verification report
4. [KUDA_PHASE1_STATUS_AND_NEXT_STEPS.md](KUDA_PHASE1_STATUS_AND_NEXT_STEPS.md) - Status and next steps
5. [PHASE1_API_DOCUMENTATION.md](PHASE1_API_DOCUMENTATION.md) - API specification
6. [PHASE1_TESTING_GUIDE.md](PHASE1_TESTING_GUIDE.md) - Comprehensive testing guide

### Session History
7. [KUDA_DEVELOPMENT_SESSION_SUMMARY_2025-10-28.md](KUDA_DEVELOPMENT_SESSION_SUMMARY_2025-10-28.md) - Session summary

### Phase 2 Planning
8. [KUDA_ULTIMATE_WORKFLOW_OPTIMIZATION.md](KUDA_ULTIMATE_WORKFLOW_OPTIMIZATION.md) - Complete Phase 2 roadmap

---

## 🔧 Common Commands

### Development
```bash
npm run dev              # Start development server
npm run migrate:status   # Check migration status
npm run migrate          # Run pending migrations
npm run build            # Build for production
```

### Testing
```bash
./test-phase1.sh         # Run automated Phase 1 tests
./setup-dev.sh           # Re-run setup if needed
```

### Database
```bash
# Connect to database
psql $DATABASE_URL

# Check migrations
SELECT * FROM migrations ORDER BY id;

# View performance analytics
SELECT * FROM phase1_performance_analytics ORDER BY processing_date DESC LIMIT 10;
```

---

## ❓ Troubleshooting

### Setup fails with "DATABASE_URL not configured"
```bash
# Edit .env file
nano .env
# Update DATABASE_URL=postgresql://user:password@localhost:5432/kuda_dev
```

### Test fails with "Server not running"
```bash
# Start server in separate terminal
npm run dev
```

### "No test assets found"
```bash
# Add test files to test-assets/ directory
# See test-assets/README.md for requirements
```

### Processing time > 2 minutes
- Check S3 upload speed (network latency)
- Reduce file count for testing
- Review server logs for slow operations

---

## 📊 Success Criteria

Phase 1 is ready when:
- ✅ `./setup-dev.sh` completes successfully
- ✅ `npm run dev` starts without errors
- ✅ `./test-phase1.sh` shows all tests passing
- ✅ Processing time < 2 minutes
- ✅ Logo detection working
- ✅ Color extraction working
- ✅ Document scanning working
- ✅ Brief generation working

---

## 🎯 Next Steps

### After Validation
1. Deploy to staging environment
2. Run validation tests in staging
3. Monitor performance metrics
4. Begin Phase 2 planning

### Phase 2 Preview
- Three-tier access control (Kuda Ocean/River/Minnow)
- Smart notification timing (Tue-Thu 10AM-4PM)
- Email threading & automation
- Auto-generated revision changelogs

See [KUDA_ULTIMATE_WORKFLOW_OPTIMIZATION.md](KUDA_ULTIMATE_WORKFLOW_OPTIMIZATION.md) for details.

---

## 📞 Support

**Developer**: Brandon Nye (brandon.nye@kargo.com)
**Platform**: KUDA (Kargo Unified Design Approval)
**Documentation**: `projects/kargo/creative-approval-system/`

For detailed help, see:
- [KUDA_PHASE1_IMPLEMENTATION_READINESS.md](KUDA_PHASE1_IMPLEMENTATION_READINESS.md) - Deployment checklist
- [PHASE1_TESTING_GUIDE.md](PHASE1_TESTING_GUIDE.md) - Testing procedures
- [test-assets/README.md](backend/test-assets/README.md) - Test file requirements

---

**Last Updated**: 2025-10-28
**Status**: ✅ Ready for deployment
**Estimated Total Time**: 20 minutes (5 setup + 15 testing)
