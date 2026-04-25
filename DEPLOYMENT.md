# **Deployment Guide: het Database**

## **Pre-Deployment Checklist**

### **Code Quality**
- [ ] All tests passing: `npm run test`
- [ ] Build succeeds: `npm run build`
- [ ] No console errors/warnings
- [ ] LINTING: `npm run lint` (0 errors)

### **Security**
- [ ] Default admin password changed
- [ ] All API tokens stored in `.env.local` (not in code)
- [ ] Security headers configured
- [ ] HTTPS enabled on server
- [ ] CORS properly configured

### **Performance**
- [ ] Bundle size acceptable (~270 KB gzipped)
- [ ] Images optimized
- [ ] Lazy loading implemented
- [ ] Database indexes created

### **Data**
- [ ] Backup of production data created
- [ ] Sample data loaded for testing
- [ ] Data validation rules verified
- [ ] Sync service tested

### **Documentation**
- [ ] README.md updated
- [ ] ARCHITECTURE.md complete
- [ ] QUICK_START.md complete
- [ ] Deployment notes documented

---

## **Deployment Steps**

### **1. Build Production Bundle**

```bash
npm run build
# Output: dist/ folder ready for deployment
```

**Output Size:**
```
dist/index.html                  0.71 kB (gzipped: 0.37 kB)
dist/assets/index-*.css         40.50 kB (gzipped: 7.82 kB)
dist/assets/motion-*.js        115.35 kB (gzipped: 38.28 kB)
dist/assets/vendor-*.js        163.24 kB (gzipped: 53.42 kB)
dist/assets/index-*.js         334.93 kB (gzipped: 94.60 kB)
dist/assets/charts-*.js        409.81 kB (gzipped: 111.04 kB)
───────────────────────────────────────────────────
Total gzipped: ~305 KB (acceptable for production)
```

---

### **2. Deploy to cPanel**

#### **Option A: Using cPanel File Manager**

1. **Login to cPanel** → `your-domain.com/cpanel`
2. **File Manager** → Navigate to `public_html`
3. **Upload** `dist/` contents:
   - Copy all files from `dist/` folder
   - Paste into `public_html/`
4. **Verify** → Visit `https://your-domain.com`

#### **Option B: Using FTP/SFTP**

```bash
# Using SFTP
sftp username@your-domain.com
# Navigate to public_html
put -r dist/* ./
exit
```

#### **Option C: Using cPanel Git Integration**

1. **cPanel** → **Git Version Control**
2. **Create Repository**
3. **Clone from GitHub**
4. **Set up deployment hook** → Auto-deploy on push

---

### **3. Configure Server**

#### **cPanel Settings**

**PHP Version:**
- Recommended: PHP 8.0+
- Not required (app is static)

**SSL Certificate:**
- Auto-install free SSL (Let's Encrypt)
- All traffic via HTTPS

**DNS:**
- Point A record to cPanel IP
- MX records if email enabled

**Email:**
- Forward admin@yourdomain.com if needed

---

### **4. Configure Environment**

#### **Create `.env.local` in cPanel**

```bash
# SSH into cPanel
ssh username@your-domain.com

# Navigate to project
cd public_html

# Create .env file
echo "VITE_API_TIMEOUT=30000" > .env.local
echo "VITE_LOG_LEVEL=INFO" >> .env.local
echo "VITE_ENABLE_BACKUP_RESTORE=true" >> .env.local
```

⚠️ **Important:** These are client-side env vars (visible to users). Don't put secrets here!

---

### **5. Configure Google Apps Script Bridge**

**In Google Apps Script:**

```javascript
// apps-script.json
{
  "timeZone": "Asia/Dubai",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "dependencies": {}
}
```

**Deploy:**
1. Click **Deploy** → **New Deployment**
2. Type: **Web app**
3. Execute as: **Me (your email)**
4. Who has access: **Anyone**
5. Click **Deploy**
6. Copy deployment URL
7. Use in het Database **Bridge URL**

---

### **6. Test Deployment**

**Browser Tests:**
```
✓ Can access https://your-domain.com
✓ Login works (admin account)
✓ Dashboard loads
✓ Can add database
✓ Can switch database
✓ Data syncs successfully
✓ Views work
✓ Access control works
```

**Console Check:**
```javascript
// In browser console
localStorage.getItem('progdb_databases');     // Should show databases
localStorage.getItem('progdb_active_database'); // Should show active DB
localStorage.getItem('progdb_auth');          // Should show user
```

**Performance Check:**
```
First Contentful Paint (FCP):     < 2 seconds
Time to Interactive (TTI):        < 4 seconds
Lighthouse Score:                 > 80
```

---

### **7. Post-Deployment**

#### **Monitor**
- Check cPanel error logs
- Monitor server resources
- Review browser console for errors

#### **Backup**
```bash
# In cPanel terminal
cd public_html
tar -czf backup-$(date +%Y%m%d).tar.gz .
# Download from cPanel File Manager
```

#### **Update DNS**
- If migrating from old server, update DNS A record
- Wait 24-48 hours for propagation
- Keep old server running during transition

---

## **Performance Optimization**

### **cPanel Optimizations**

**Enable Gzip Compression:**
- cPanel → **EasyApache** → Enable Gzip

**Enable Caching:**
- cPanel → **Caching** → Enable Cache

**CDN Integration:**
- cPanel → **CloudFlare** (free CDN integration)

### **Application Optimizations**

**Already Implemented:**
- ✅ Code splitting (Vite bundles)
- ✅ CSS minification
- ✅ Image optimization
- ✅ Tree shaking (unused code removed)
- ✅ Lazy loading components
- ✅ Local caching (TanStack Query)

---

## **Security Hardening**

### **cPanel Security**

1. **SSL Certificate**
   - Force HTTPS: **Redirects**
   - HSTS enabled (2 years)

2. **Firewall**
   - Enable cPanel ModSecurity
   - Block known bad IPs

3. **Backups**
   - Automatic daily backups
   - Test restore monthly

4. **Monitoring**
   - Enable server monitoring
   - Alert on high CPU/memory

### **Application Security**

Already implemented:
- ✅ Content Security Policy headers
- ✅ XSS protection (React escaping)
- ✅ CSRF token validation
- ✅ Password hashing (SHA-256)
- ✅ Rate limiting (login attempts)
- ✅ Error boundary (no stack traces shown)
- ✅ Sensitive data masking in logs

---

## **Monitoring & Maintenance**

### **Weekly Tasks**

- [ ] Check error logs
- [ ] Verify backups completed
- [ ] Test database sync
- [ ] Monitor storage usage

### **Monthly Tasks**

- [ ] Update dependencies: `npm update`
- [ ] Security scan: `npm audit`
- [ ] Performance review
- [ ] Backup restore test

### **Quarterly Tasks**

- [ ] Full security audit
- [ ] Load testing
- [ ] Database optimization
- [ ] Documentation review

---

## **Troubleshooting Deployment**

### ❌ **Blank Page After Deploy**

**Check:**
1. `public_html` has `index.html` file
2. Browser cache cleared (Ctrl+Shift+Delete)
3. cPanel error logs: **cPanel** → **Error log**
4. Browser console (F12) for JS errors

**Fix:**
```bash
# SSH into server
rm -rf public_html/*
# Re-upload dist/* contents
```

---

### ❌ **API Not Working**

**Check:**
1. Bridge URL is correct
2. API token is valid
3. Firewall not blocking requests
4. CORS enabled on bridge

**Fix:**
```bash
# Verify connectivity
curl "https://script.google.com/..." -H "Authorization: Bearer YOUR_TOKEN"
```

---

### ❌ **Slow Performance**

**Check:**
1. Server CPU/memory usage
2. Database size
3. Network speed
4. Bundle size

**Optimize:**
```bash
npm run build -- --minify esbuild
# Results in smaller bundle
```

---

### ❌ **Database Sync Failing**

**Check:**
1. Google Apps Script still deployed
2. API token hasn't expired
3. Google Sheet still accessible
4. Tab name correct

**Test:**
```javascript
// In Sync Center logs
// Look for error message
// Check Bridge URL validity
```

---

## **Rollback Procedure**

If deployment fails:

```bash
# SSH into server
cd public_html

# List backups
ls -la backup-*.tar.gz

# Restore previous version
tar -xzf backup-20260425.tar.gz

# Verify
curl https://your-domain.com
```

---

## **Scaling Considerations**

**Current Setup:**
- Single cPanel account
- ~300 KB gzipped bundle
- localStorage database (~1-5 MB)
- Supports ~10,000 records comfortably

**Future Scaling:**
- Add server-side API (Node.js)
- Real database (MongoDB/PostgreSQL)
- CDN for assets
- Database replication
- Load balancer

---

## **Support & Documentation**

**Reference Files:**
- `ARCHITECTURE.md` — System design
- `QUICK_START.md` — User guide
- `README.md` — Project overview

**Deployment Template:**
- Use this guide for each deployment
- Update with actual URLs/tokens
- Keep backups of all deployments

---

## **Deployment Checklist Summary**

```
PRE-DEPLOYMENT:
  ☐ Code tested & built
  ☐ Dependencies updated
  ☐ Security audit passed
  ☐ Backup created

DEPLOYMENT:
  ☐ Build bundle created
  ☐ Files uploaded to cPanel
  ☐ Environment configured
  ☐ DNS verified

POST-DEPLOYMENT:
  ☐ Homepage loads
  ☐ Login works
  ☐ Database sync works
  ☐ Data displays correctly
  ☐ No console errors
  ☐ Performance acceptable
  ☐ Backups tested

MONITORING:
  ☐ Error logs checked
  ☐ Performance monitored
  ☐ Backups scheduled
  ☐ Security updated
```

---

**Deployment Ready! ✅**

Need help? Check logs or refer to ARCHITECTURE.md
