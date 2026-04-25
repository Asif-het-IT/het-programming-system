# **Multi-Database & View-Based Access Control System**
## Enterprise Architecture Guide

---

## **System Overview**

Your het Database now supports:
- ✅ **Multiple Google Sheets** - Manage multiple databases
- ✅ **Single Active Database** - Only one database used at a time
- ✅ **Database Switching** - Seamlessly switch between databases
- ✅ **View-Based Access Control** - Admin defines what data users see
- ✅ **Field-Level Permissions** - Show/hide specific columns per view
- ✅ **Role-Based Views** - Different views for different teams

---

## **Architecture Components**

### **1. DatabaseManager Context** (`src/lib/DatabaseManager.jsx`)

Manages all database configurations and active selection.

**Key Features:**
- Add new Google Sheets database (with bridge URL, API token)
- Switch active database (automatically updates all queries)
- Delete database (with safeguards)
- Update database metadata (status, record count, last_synced)

**Storage:**
- `progdb_databases` (localStorage) — List of all databases
- `progdb_active_database` (localStorage) — Currently selected database ID

**Example Usage:**
```javascript
const { activeDatabase, switchDatabase, addDatabase } = useDatabaseManager();

// Switch to different database
switchDatabase('db_id_12345');

// Add new database
addDatabase({
  name: 'Production Database',
  bridge_url: 'https://script.google.com/...',
  api_token: 'token_xxx',
  sheet_id: 'sheet_id_xxx',
  tab_name: 'Production'
});
```

---

### **2. ViewManager Context** (`src/lib/ViewManager.jsx`)

Manages data views with field-level access control.

**System Views (Pre-configured, Read-Only):**
- `full_access` — All fields, all data (Admin view)
- `summary_view` — Key fields only (Default team view)
- `operations_view` — For operations team (no financial data)
- `finance_view` — For finance team (only financial/order data)

**Custom Views:**
- Create unlimited custom views
- Select which fields appear in each view
- Apply filters per view
- Set sort order and limits

**Field Categories Available:**
```
- Identification: SR #, Order ID
- Product: Brand, Marka, Category
- Status: Status, Shipment Status, Overdue Days
- Quantity: Quantity, Qty Received, Qty Pending
- Dates: Order Date, Due Date, Shipment Date
- Financial: Amount, Pending Amount
- Additional: Notes, Assigned To, Priority
```

**Storage:**
- `progdb_views` (localStorage) — Custom views only
- `progdb_user_views_mapping` (localStorage) — User ID → View IDs mapping

**Example Usage:**
```javascript
const { views, createView, assignViewToUser, getUserViews } = useViewManager();

// Create custom view for sales team
createView({
  name: 'Sales Overview',
  description: 'For sales team',
  fields: ['sr', 'brand', 'marka', 'quantity', 'order_date', 'amount'],
  filters: {},
  sort_field: '-amount',
  limit: 1000
});

// Assign view to user
assignViewToUser('user_123', 'view_custom_xxx');

// Get user's available views
const userViews = getUserViews('user_123');

// Apply view to data (filters fields)
const filteredData = applyView(orders, viewId);
```

---

## **User Workflows**

### **1. Admin: Add New Database**

**Path:** Admin Panel → Databases

1. Click "+ Add Database"
2. Fill in:
   - **Database Name** — Descriptive name
   - **Bridge URL** — Google Apps Script deployment URL
   - **API Token** — Bridge authentication token
   - **Sheet ID** (optional) — Google Sheet ID
   - **Tab Name** — Sheet tab name (default: "Database")
3. Click "Add Database"
4. Database is now available in dropdown
5. Click "Switch" button to make it active

**Data Persisted:**
```javascript
{
  id: 'db_xxx',
  name: 'Production Database',
  bridge_url: '...',
  api_token: '...',
  sheet_id: '...',
  tab_name: 'Production',
  created_date: '2026-04-25T...',
  last_synced: '2026-04-25T...',
  record_count: 1250,
  status: 'connected'
}
```

### **2. Admin: Switch Active Database**

**Path:** Admin Panel → Databases

1. View all databases
2. Click "Switch" on desired database
3. System automatically:
   - Updates active database ID
   - All queries now use this database
   - Dashboard refreshes with new data
   - Sync Center targets this database

**Important:** Only ONE database active at a time!

### **3. Admin: Create Custom View**

**Path:** Admin Panel → Access Control → Create View

1. Click "+ Create View"
2. Enter view name & description
3. Select fields to include:
   - Check/uncheck columns
   - Scrollable list of all available fields
4. Click "Create View"
5. View now available for assignment

**Example Scenarios:**

**Finance View:**
- Fields: sr, brand, order_date, amount, amount_pending, status
- For: Finance team
- Hide: Quantity, shipment details

**Operations View:**
- Fields: sr, brand, quantity, shipment_status, shipment_date, assigned_to, priority
- For: Warehouse team
- Hide: Amount, dates

**Executive View:**
- Fields: sr, brand, status, amount, overdue_days
- For: Management
- High-level summary only

### **4. Admin: Assign View to User**

**Path:** Admin Panel → Access Control → Assign to User

1. Click "Assign to User" button
2. Select view from dropdown
3. Enter user ID or email
4. Click "Assign View"
5. User can now access this view

**Note:** User must log in to see assigned views

---

## **Data Flow Architecture**

```
┌─────────────────────────┐
│   User Logs In          │
│  (AuthContext)          │
└────────────┬────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Get Active Database         │
│ (DatabaseManager)           │
│ progdb_active_database ◄────┼─ User's selected DB
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Get User's Views            │
│ (ViewManager)               │
│ progdb_user_views_mapping   │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Query Data                  │
│ localDB.Order.list()        │
│ (From Active DB)            │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Apply View Filters          │
│ applyView(data, viewId)     │
│ Show only allowed fields    │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Display in Component        │
│ (Dashboard, DataViews, etc) │
└─────────────────────────────┘
```

---

## **Integration with Existing Pages**

### **Dashboard.jsx**
- Automatically uses `activeDatabase`
- Can apply view filters: `applyView(orders, userView.id)`

### **DataViews.jsx**
- Shows only fields from user's assigned view
- Filters applied automatically

### **SyncCenter.jsx**
- Syncs from `activeDatabase.bridge_url`
- Updates `activeDatabase.record_count` after sync

### **All Pages**
- Import `useDatabaseManager()` to get active database
- Import `useViewManager()` to get user views
- Views enforce automatically via field filtering

---

## **Security Best Practices**

✅ **Admin-Only Features:**
- Database Manager page restricted to `role === 'admin'`
- Access Control page restricted to `role === 'admin'`
- Only admins can create/delete databases
- Only admins can create/assign views

✅ **Data Protection:**
- API tokens stored encrypted (not in plain text)
- User view assignments stored per-user ID
- View filters applied client-side before display
- No data is lost when switching databases

✅ **Audit Trail:**
- All actions logged via Logger system
- Database switches logged
- View assignments logged
- Sync operations logged

---

## **Configuration Examples**

### **Configuration 1: Multi-Tenant (Different Clients)**

```javascript
// Database 1: Client A Production
{
  name: 'Client A - Production',
  bridge_url: 'https://script.google.com/...',
  api_token: 'client_a_token'
}

// Database 2: Client B Production
{
  name: 'Client B - Production',
  bridge_url: 'https://script.google.com/...',
  api_token: 'client_b_token'
}

// Switch between clients as needed
switchDatabase('db_client_a');
```

### **Configuration 2: Environments (Dev/Staging/Prod)**

```javascript
// Development
{ name: 'Development', bridge_url: '...', api_token: 'dev_token' }

// Staging
{ name: 'Staging', bridge_url: '...', api_token: 'staging_token' }

// Production
{ name: 'Production', bridge_url: '...', api_token: 'prod_token' }
```

### **Configuration 3: Multiple Data Sources**

```javascript
// Textile Orders
{ name: 'Textile Orders', bridge_url: '...', tab_name: 'Orders' }

// Inventory
{ name: 'Inventory', bridge_url: '...', tab_name: 'Stock' }

// Shipments
{ name: 'Shipments', bridge_url: '...', tab_name: 'Tracking' }
```

---

## **Common Tasks**

### **Task: Add a new database and make it active**
```javascript
const { addDatabase, switchDatabase } = useDatabaseManager();

const newDb = addDatabase({
  name: 'New Database',
  bridge_url: 'https://...',
  api_token: 'token_xxx',
  sheet_id: 'sheet_xxx'
});

switchDatabase(newDb.id);
```

### **Task: Create a view for specific team**
```javascript
const { createView, assignViewToUser } = useViewManager();

const view = createView({
  name: 'Operations Team',
  description: 'For warehouse operations',
  fields: ['sr', 'brand', 'quantity', 'shipment_status', 'priority']
});

assignViewToUser('operations_user_001', view.id);
```

### **Task: Get data with applied view**
```javascript
const { activeDatabase } = useDatabaseManager();
const { applyView, getUserViews } = useViewManager();
const { user } = useAuth();

const userViews = getUserViews(user.id);
const view = userViews[0] || defaultView;

const allData = await localDB.Order.list('-sr', 500);
const filteredData = applyView(allData, view.id);
```

---

## **Troubleshooting**

### **Problem: Database doesn't appear in list**
- ✓ Check localStorage `progdb_databases`
- ✓ Verify database ID format (`db_xxx`)
- ✓ Browser console for errors

### **Problem: User can't see assigned view**
- ✓ Verify view exists in `progdb_views`
- ✓ Check user → view mapping in `progdb_user_views_mapping`
- ✓ Ensure view has fields selected

### **Problem: Active database reverts after refresh**
- ✓ Check `progdb_active_database` localStorage key
- ✓ Database ID must match one in `progdb_databases`

### **Problem: Data not syncing to new database**
- ✓ Verify active database before sync
- ✓ Check bridge URL and API token are correct
- ✓ Check Sync Center logs for error messages

---

## **Performance Considerations**

- **Large Datasets:** Views limit records (default 1000 per view)
- **Field Filtering:** Applied client-side (minimal overhead)
- **Database Switching:** Instant (just changes localStorage key)
- **Custom Views:** Create as needed (no limit)

---

## **Future Enhancements**

- [ ] Server-side view enforcement (for API)
- [ ] Row-level security (filter records per user)
- [ ] View templates/presets
- [ ] Automated view suggestions based on user role
- [ ] Data export per view
- [ ] View usage analytics
- [ ] Real-time collaboration (multiple active users)

---

## **Pages & Routes**

| Route | Page | Admin Only | Purpose |
|-------|------|-----------|---------|
| `/` | Dashboard | No | Main overview |
| `/views` | Data Views | No | Browse all data |
| `/brand-report` | Brand Report | No | Brand analysis |
| `/management-report` | Management Report | No | Active orders |
| `/sync` | Sync Center | Yes | Manage syncs |
| `/databases` | Database Manager | Yes | Add/switch databases |
| `/access-control` | Access Control | Yes | Manage views & access |
| `/user-access` | User Access | Yes | Manage users |
| `/settings` | App Settings | No | User settings |

---

## **Environment Variables**

```bash
# .env.local
VITE_API_TIMEOUT=30000
VITE_LOG_LEVEL=INFO
VITE_ENABLE_BACKUP_RESTORE=true
```

---

## **Support**

For questions or issues:
1. Check logs via Logger system
2. Review browser localStorage
3. Check console errors
4. Review this documentation

---

**System Ready for Deployment! ✅**
