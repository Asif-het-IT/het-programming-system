# 🚀 Deployment Checklist

Complete these steps to deploy Het Database to production.

---

## Phase 1: Pre-Deployment Verification

### Data & Configuration
- [ ] **Verify Google Sheets URLs**
  - [ ] All 36 views have valid Google Sheet IDs in `src/config/viewConfig.json`
  - [ ] Each sheet is shared appropriately (public or with service account)
  - [ ] `gid` parameters are correct for target tabs
  
- [ ] **Verify User Configuration**
  - [ ] All 5 users exist in `src/lib/userConfig.js`
  - [ ] Each user has correct view assignments
  - [ ] Admin user has access to all 36 views
  - [ ] Passwords are final (users will need to change on first login)

- [ ] **Test Data Access**
  ```bash
  npm run dev
  # Test login with each user type
  # Verify correct data appears
  # Check column filtering works
  # Test search and export
  ```

### Code Review
- [ ] **Security Check**
  - [ ] No hardcoded secrets in code
  - [ ] API endpoints have authentication
  - [ ] CORS is properly configured
  - [ ] Error messages don't leak sensitive info

- [ ] **Performance Check**
  - [ ] Bundle size reasonable (< 300KB gzipped)
  - [ ] Cache TTL configured (5 minutes)
  - [ ] No console errors or warnings
  - [ ] Page loads in < 3 seconds

- [ ] **Browser Compatibility**
  - [ ] Test on Chrome, Firefox, Safari
  - [ ] Test on mobile (iOS Safari, Chrome Android)
  - [ ] Responsive design works at all breakpoints

### Build Verification
- [ ] **Production Build**
  ```bash
  npm run build
  npm run preview
  # Verify all features work
  # Check no errors in console
  ```

---

## Phase 2: Backend Setup (Optional but Recommended)

### Backend API Development
- [ ] **Create Backend Project**
  ```bash
  mkdir het-database-api
  cd het-database-api
  npm init -y
  npm install express cors dotenv node-cache
  ```

- [ ] **Setup Backend**
  - [ ] Copy `backend-template.js` to `server.js`
  - [ ] Create `.env` file with configuration
  - [ ] Update `VIEW_CONFIG` with actual sheet IDs
  - [ ] Test endpoints locally: `node server.js`

- [ ] **Test Backend Endpoints**
  ```bash
  # Health check
  curl http://localhost:3001/health
  
  # Fetch view data
  curl http://localhost:3001/api/sheets/data/DuaView
  
  # List views
  curl http://localhost:3001/api/sheets/views
  ```

- [ ] **Update Frontend**
  - [ ] Update `src/lib/sheetService.js`:
    ```javascript
    const USE_CORS_PROXY = false;  // Disable CORS proxy
    const API_URL = 'http://localhost:3001';
    ```
  - [ ] Modify `fetchSheetData()` to use backend API
  - [ ] Test that data still loads

- [ ] **Deploy Backend**
  - [ ] Choose hosting (Vercel, Heroku, AWS Lambda, etc.)
  - [ ] Set environment variables
  - [ ] Deploy and test

---

## Phase 3: Frontend Deployment

### Choose Hosting Platform

#### Option A: Vercel (Easiest)
```bash
npm install -g vercel
vercel --prod
# Follow prompts
```

#### Option B: Netlify
```bash
npm run build
# Drag dist/ folder to Netlify
# Or: npm install netlify-cli && netlify deploy --prod
```

#### Option C: Traditional Server (Apache/Nginx)
```bash
npm run build
# Upload dist/ contents to server
# Configure SPA routing (see below)
```

### SPA Routing Configuration

**For Nginx:**
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

**For Apache:**
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

**For Node.js (Express):**
```javascript
app.use(express.static('dist'));
app.get('*', (req, res) => res.sendFile('dist/index.html'));
```

### Environment Configuration
- [ ] **Create Production Environment**
  - [ ] Update `.env.production` with production API URL
  - [ ] Set production Google Sheets URLs if different
  - [ ] Configure CORS allowed origins

- [ ] **Build for Production**
  ```bash
  npm run build
  # Verify dist/ folder created
  # Check build size is acceptable
  ```

### Deployment Steps

- [ ] **Deploy Frontend**
  1. Build: `npm run build`
  2. Upload `dist/` folder to hosting
  3. Configure routing for SPA
  4. Verify HTTPS is enabled

- [ ] **Test Production**
  - [ ] Access production URL
  - [ ] Login with test user
  - [ ] Verify data loads
  - [ ] Test all major features
  - [ ] Check console for errors

---

## Phase 4: Post-Deployment

### Monitoring & Health Checks
- [ ] **Set Up Monitoring**
  - [ ] Response time monitoring
  - [ ] Error tracking (Sentry, Rollbar, etc.)
  - [ ] Uptime monitoring (UptimeRobot, etc.)
  - [ ] User analytics (optional)

- [ ] **Performance Baseline**
  - [ ] Record initial page load times
  - [ ] Record API response times
  - [ ] Set up alerts for anomalies

- [ ] **Error Logging**
  - [ ] Ensure error messages are logged
  - [ ] Set up email/Slack alerts
  - [ ] Create error dashboard

### Security Verification
- [ ] **Security Checks**
  - [ ] SSL/TLS certificate installed (HTTPS only)
  - [ ] Security headers configured
  - [ ] CORS policy validated
  - [ ] Rate limiting enabled (if applicable)

- [ ] **Backup & Recovery**
  - [ ] Automated backups configured (user data)
  - [ ] Disaster recovery plan documented
  - [ ] Test recovery procedure

---

## Phase 5: User Training & Rollout

### Documentation
- [ ] **Create User Guide**
  - [ ] Step-by-step login instructions
  - [ ] How to navigate views
  - [ ] How to search and filter
  - [ ] How to export data
  - [ ] Troubleshooting section

- [ ] **Admin Documentation**
  - [ ] How to add users
  - [ ] How to assign views
  - [ ] How to manage permissions
  - [ ] Support contact info

### User Rollout
- [ ] **Alpha Testing** (Internal Team)
  - [ ] 2-3 power users test system
  - [ ] Gather feedback
  - [ ] Fix critical issues

- [ ] **Beta Testing** (Larger Group)
  - [ ] 20-30% of users test
  - [ ] Run for 1-2 weeks
  - [ ] Monitor performance
  - [ ] Gather feedback

- [ ] **General Release**
  - [ ] Full user rollout
  - [ ] Monitor closely first week
  - [ ] Have support staff ready
  - [ ] Daily check-ins

---

## Phase 6: Ongoing Maintenance

### Weekly
- [ ] Check error logs
- [ ] Verify performance metrics
- [ ] Respond to user feedback

### Monthly
- [ ] Update dependencies
- [ ] Review security patches
- [ ] Optimize performance if needed
- [ ] Backup verification

### Quarterly
- [ ] Full security audit
- [ ] Database size review
- [ ] Capacity planning
- [ ] Feature planning

---

## Rollback Plan

If critical issues occur in production:

### Immediate Actions
```bash
# 1. Revert to previous version
git revert HEAD

# 2. Build and deploy previous version
npm run build
vercel --prod  # Or your deployment method

# 3. Notify users of the issue
# 4. Gather error details from logs
```

### Investigation & Fix
1. Isolate the issue
2. Apply fix to development
3. Test thoroughly
4. Re-deploy
5. Monitor closely

---

## Troubleshooting During Deployment

### Build Fails
```bash
# Clear cache and try again
rm -rf node_modules package-lock.json
npm install
npm run build
```

### CORS Errors After Deployment
- Check frontend URL is whitelisted in backend CORS config
- Verify backend is running and reachable
- Check browser console for specific error

### No Data Appearing
- Verify Google Sheets URLs in viewConfig.json
- Check Sheet sharing settings
- Verify backend can access Google Sheets
- Check browser console for specific error

### Users Can't Login
- Verify userConfig.js has correct users
- Check password spelling (case-sensitive)
- Clear browser localStorage and try again
- Check console for auth errors

### Slow Performance
- Check Google Sheets size (very large sheets slow)
- Enable server-side caching
- Consider pagination or virtual scrolling
- Check network tab for slow requests

---

## Success Criteria

✅ System is considered successfully deployed when:

1. **Functionality**
   - All 36 views accessible
   - Data displays correctly
   - Search and export work
   - Admin panel functional

2. **Performance**
   - Page load < 3 seconds
   - Data fetch < 5 seconds (first load)
   - Search < 100ms
   - No errors in console

3. **Security**
   - HTTPS enabled
   - Authentication working
   - CORS properly configured
   - No security warnings

4. **Reliability**
   - 99%+ uptime
   - Error rate < 0.1%
   - Graceful error handling
   - Automatic recovery

---

## Post-Deployment Success Metrics

Track these KPIs:

| Metric | Target | Current |
|--------|--------|---------|
| Page Load Time | < 3s | - |
| API Response Time | < 2s | - |
| Error Rate | < 0.1% | - |
| Uptime | > 99.5% | - |
| User Satisfaction | > 4/5 | - |
| Cache Hit Rate | > 80% | - |

---

## Contacts & Escalation

| Issue | Contact | Phone | Email |
|-------|---------|-------|-------|
| General Support | [Name] | [Phone] | [Email] |
| Technical | [DevOps] | [Phone] | [Email] |
| Business | [Manager] | [Phone] | [Email] |
| Emergency | [CTO] | [Phone] | [Email] |

---

**Ready to Deploy?** Review all checkmarks above before proceeding. 🚀
