# **Quick Start Guide: Multi-Database System**

## **Installation & Setup (First Time)**

### **Step 1: Login to Admin Account**
```
Email: admin@hetdubai.com
Password: Admin@123
```
⚠️ **IMPORTANT:** Change this password immediately after first login!

---

### **Step 2: Add Your First Database**

1. Click on **Admin Panel** (gear icon in sidebar)
2. Click on **Databases** tab
3. Click **"+ Add Database"** button
4. Fill in the form:

| Field | Example | Notes |
|-------|---------|-------|
| **Database Name** | `Production Data` | Give it a memorable name |
| **Bridge URL** | `https://script.google.com/macros/s/...` | Your Google Apps Script URL |
| **API Token** | `lgp_live_prod_xxx...` | Authentication token from Google |
| **Sheet ID** | `1a2b3c4d...` | (Optional) Google Sheet ID |
| **Tab Name** | `Database` | Sheet tab name to sync from |

5. Click **"Add Database"** ✓
6. New database appears in list
7. Click **"Switch"** to make it active

**Status Indicators:**
- 🟡 `pending` — Initial state
- 🟢 `connected` — Ready to use
- 🔴 `error` — Check logs

---

### **Step 3: Create Views for Different Teams**

1. Go to **Access Control** page
2. Click **"Create View"** button
3. Enter view name: e.g., `Operations Team`
4. Select fields that team should see:
   - For Operations: `sr`, `brand`, `quantity`, `shipment_status`, `priority`
   - For Finance: `sr`, `brand`, `amount`, `pending_amount`, `status`
   - For Management: `sr`, `brand`, `quantity`, `amount`, `status`
5. Click **"Create View"** ✓

---

### **Step 4: Assign Views to Users**

1. Still in **Access Control** page
2. Click **"Assign to User"** button
3. Select a view from dropdown
4. Enter user ID or email
5. Click **"Assign View"** ✓

**Example Assignments:**
```
View: "Operations Team" → user: operations@hetdubai.com
View: "Finance Report" → user: finance@hetdubai.com
View: "Full Access"    → user: admin@hetdubai.com
```

---

## **Daily Operations**

### **Syncing Data**

1. Go to **Sync Center**
2. Click **"Sync Now"** on active database
3. Watch the logs:
   - 🔄 `running` — Syncing in progress
   - ✅ `success` — Data synced
   - ❌ `error` — Check error message

**Sync Options:**
- Manual sync (click "Sync Now")
- Auto-sync via API (if configured)

---

### **Switching Databases**

1. Go to **Databases** page
2. Click **"Switch"** on desired database
3. Entire system updates to new database:
   - Dashboard shows new data
   - Reports update
   - Syncs target new database

**All data from previously active database remains unaffected!**

---

### **Viewing Data**

**For Admin (Full Access):**
- Go to **Data Views** → See all columns and data

**For Regular Users:**
- Go to **Data Views** → See only assigned view fields
- Dashboard shows filtered data
- Reports respect view permissions

---

## **Common Scenarios**

### **Scenario 1: Multiple Clients**

```
Database 1: Client A Orders
Database 2: Client B Orders
Database 3: Client C Orders

→ Switch between to see each client's data
→ View shows relevant fields for each client
```

**How to:**
1. Add 3 databases with different URLs
2. Create view: "Client A Fields"
3. Create view: "Client B Fields"
4. Switch database to see client A data
5. Switch database to see client B data

---

### **Scenario 2: Different Departments**

```
Teams:
- Operations Team (see: SR, Brand, Quantity, Shipment Status)
- Finance Team (see: SR, Brand, Amount, Status)
- Management (see: SR, Brand, Amount, Quantity, Status)

→ All see the same database
→ But different columns based on their view
```

**How to:**
1. Add 1 database (shared)
2. Create 3 views (Operations, Finance, Management)
3. Assign view to each team member
4. Each team sees only their columns

---

### **Scenario 3: Test & Production**

```
Database 1: Testing (staging.sheets.google.com/...)
Database 2: Production (prod.sheets.google.com/...)

→ Test new features on staging
→ Switch to production when ready
```

**How to:**
1. Add staging database
2. Add production database
3. Work on staging
4. Switch to production when ready

---

## **Admin Dashboard**

### **Databases Page**
- View all configured databases
- See active database (highlighted)
- See status, last sync time, record count
- Add new database
- Switch between databases
- Delete unused databases

### **Access Control Page**
- Create custom views
- Assign views to users
- See all user-view assignments
- Delete custom views
- Modify system views (read-only)

### **Sync Center Page**
- Trigger manual sync for active database
- View sync history
- See error logs
- Monitor record count

---

## **Keyboard Shortcuts**

| Action | Shortcut |
|--------|----------|
| Open Dashboard | `Ctrl + Home` |
| Search Data | `Ctrl + K` |
| Settings | `Ctrl + ,` |

---

## **Troubleshooting**

### ❌ **Database won't sync**
1. Check Bridge URL is correct
2. Verify API Token is valid
3. Check Sheet tab name matches
4. View Sync Center logs for error

### ❌ **User can't see view**
1. Verify view was created ✓
2. Verify view was assigned to user ✓
3. User needs to login again
4. Check browser localStorage

### ❌ **Data looks wrong after database switch**
1. Normal! You're looking at different database data
2. Check which database is active (header shows name)
3. Sync the new database if needed

### ❌ **Forgot admin password**
1. ⚠️ Reset via local storage:
   ```javascript
   // In browser console:
   localStorage.removeItem('progdb_auth');
   // Then login with: admin@hetdubai.com / Admin@123
   ```

---

## **Security Reminders**

✅ **Do:**
- Change default admin password immediately
- Store API tokens securely
- Use strong passwords (8+ chars, mixed case, numbers)
- Assign views appropriately (don't expose sensitive data)
- Backup your databases regularly

❌ **Don't:**
- Share admin credentials
- Commit `.env` files with tokens
- Leave API tokens visible in URLs
- Assign full access to all users
- Modify system views without understanding

---

## **Performance Tips**

- 📊 **Large Datasets?** Set view limit to ~500 records
- ⚡ **Slow Sync?** Check database size; consider filtering
- 🔄 **Auto-Sync?** Don't sync more than once per hour
- 💾 **Storage?** Monitor localStorage usage

---

## **Support Contacts**

| Issue | Contact |
|-------|---------|
| System Admin | admin@hetdubai.com |
| Technical Support | [Your Support Email] |
| Database Credentials | [Your Credentials Storage] |

---

## **Quick Reference**

**Pages:**
- 📊 Dashboard → `/`
- 📋 Data Views → `/views`
- 📈 Reports → `/brand-report`, `/management-report`
- 🔄 Sync → `/sync` (admin only)
- 🗄️ Databases → `/databases` (admin only)
- 👁️ Access Control → `/access-control` (admin only)

**Keyboard:**
- `Esc` → Close modals
- `Tab` → Navigate forms
- `Enter` → Submit forms

---

**Ready to go! 🚀**

For detailed architecture, see `ARCHITECTURE.md`
