# Quick Start Testing Guide

Get started testing Het Database in 5 minutes.

---

## 1️⃣ Start Development Server

```bash
cd "Programming Database"
npm run dev
```

**Expected Output:**
```
VITE v6.4.2 ready in 123 ms

➜ Local:   http://localhost:5174/
```

Access: **http://localhost:5174/**

---

## 2️⃣ Login

Click one of the demo credential buttons or manually enter:

| Username | Password | Type |
|----------|----------|------|
| `dua` | `dua123` | Regular User |
| `admin` | `admin123` | Administrator |

**Expected:** Redirects to dashboard (user) or admin panel (admin)

---

## 3️⃣ Test User Dashboard

### View Data
1. Open "View" dropdown
2. Select "Dua View"
3. See 12 rows of textile orders displayed

**Check:**
- ✅ Table appears with data
- ✅ Correct columns showing (A, B, D, E, J, etc.)
- ✅ "12 records" shown at top
- ✅ No console errors (F12 to check)

### Search Feature
1. Type in search box: "2024"
2. Table filters to matching rows only

**Check:**
- ✅ Results update instantly
- ✅ Search is case-insensitive

### Pagination
1. Table shows "Showing 1-12 of 12"
2. Click "Next" button (if more than 20 rows)
3. Rows advance 20 at a time

### Export to CSV
1. Click "Export as CSV" button
2. File downloads: `DuaView-export.csv`
3. Open in Excel/Google Sheets

**Check:**
- ✅ CSV file has correct columns
- ✅ Data matches table

---

## 4️⃣ Test Admin Panel

1. Login as `admin / admin123`
2. Click "Admin Panel" in sidebar

### Users Tab
- See 5 users listed (dua, fazal, sattar, noor, admin)
- Each has assigned views
- Buttons to delete users

**Check:**
- ✅ All 5 users visible
- ✅ Roles correct (user/admin)
- ✅ View counts match config

### Add New User
1. Fill form:
   - Username: `testuser`
   - Password: `test123`
   - Check "Dua View" checkbox
2. Click "Add User"

**Check:**
- ✅ New user appears in list
- ✅ Can login with new credentials

### Available Views Reference
- Scroll down to see all 36 views
- Each shows database type and columns

**Check:**
- ✅ Men Material: 12 views
- ✅ Lace & Gayle: 24 views
- ✅ Column counts reasonable

---

## 5️⃣ Test Multiple Views

### Switch Between Views
1. Dashboard → View dropdown
2. Try different views:
   - "Dua View"
   - "Dua Trading...Gayle" 
   - "Dua Trading...Lace"
3. Each should show different data (filtered)

**Check:**
- ✅ Different columns display per view
- ✅ Different row counts per view
- ✅ No errors when switching

### Column Verification
- Each view shows specific columns
- Column letters match Excel format (A, B, C, AA, AD)
- Data aligns with columns

---

## 🧪 Test Cases Checklist

### Authentication
- [ ] Login with dua credentials → Dashboard
- [ ] Login with admin credentials → Admin Panel
- [ ] Wrong password → Error shown
- [ ] Logout works
- [ ] New user can login after creation

### Data Display
- [ ] Dashboard shows 12 rows (mock data)
- [ ] Column selection works
- [ ] Search filters data
- [ ] Pagination works (if >20 rows)
- [ ] Export creates CSV file

### Admin Functions
- [ ] User list displays 5 users
- [ ] Can add new user
- [ ] Can delete user
- [ ] Can view all 36 available views
- [ ] View assignments correct

### UI/UX
- [ ] Page responsive (test mobile size)
- [ ] Buttons clickable
- [ ] Forms validate
- [ ] Error messages clear
- [ ] Navigation intuitive

### Performance
- [ ] Page loads < 3 seconds
- [ ] Data displays instantly
- [ ] Search < 100ms
- [ ] No console errors

---

## 📊 Real Data Testing

Once you have actual Google Sheets:

### Update Configuration
Edit `src/config/viewConfig.json`:
```json
{
  "viewName": "Dua View",
  "targetUrl": "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/export?format=csv&gid=0",
  "columnsList": ["A", "B", "C", ...]
}
```

### Test Real Data
1. Edit viewConfig with real Google Sheet URLs
2. Restart dev server: `npm run dev`
3. Dashboard should now show real data (not mock)

**Check:**
- ✅ Data loads from real Google Sheets
- ✅ Columns match sheet structure
- ✅ Search works on real data
- ✅ Export has real data

---

## 🐛 Troubleshooting

### "No data appears"
```
Solution:
1. Open Console (F12)
2. Look for error messages
3. Check viewConfig.json URLs are correct
4. Verify Google Sheets are public/shared
5. Try reloading page
```

### "CORS error"
```
Current Setup: Using CORS proxy (cors.sh)
If error persists:
1. Alternative proxy: https://api.allorigins.win/raw?url=
2. Or use backend API (see PRODUCTION_SETUP.md)
```

### "Login fails"
```
1. Verify username/password exactly (case-sensitive)
2. Check userConfig.js has correct users
3. Clear browser cache (Ctrl+Shift+Del)
4. Try incognito mode
```

### "Search not working"
```
1. Check table has data first
2. Try searching for visible text
3. Refresh page (F5)
4. Check browser console for errors
```

---

## 📱 Mobile Testing

Test on mobile device or browser devtools (F12 → Toggle Device):

- [ ] Page loads on mobile
- [ ] Buttons are clickable (not too small)
- [ ] Table is readable (maybe horizontal scroll)
- [ ] Dropdown menus work
- [ ] Form inputs work
- [ ] No layout issues

---

## Performance Baseline

Record these times for comparison:

| Operation | Time | Device |
|-----------|------|--------|
| Page load | ___ ms | _____ |
| Data load (first) | ___ ms | _____ |
| Data load (cached) | ___ ms | _____ |
| Search | ___ ms | _____ |
| Switch view | ___ ms | _____ |
| Export CSV | ___ ms | _____ |

---

## Success Criteria

✅ Ready for deployment when:
- All test cases pass
- No console errors
- Real Google Sheets data displays correctly
- Performance is acceptable
- Admin panel fully functional

---

## Next: Deploy to Production

When testing complete, run:
```bash
npm run build
```

Then follow **DEPLOYMENT_CHECKLIST.md** for production deployment.

---

**Enjoying Het Database?** Report issues or feedback to your team! 🚀
