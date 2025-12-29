# Setup Instructions - Hospital Registration System

## ⚠️ IMPORTANT: Run These Migrations First

Before using the hospital registration system, you **MUST** run the database migrations:

### 1. Create Pending Hospital Requests Table

```bash
mysql -u root -p hospital_db < backend/migrations/create_pending_hospital_requests.sql
```

Or manually in MySQL:

```sql
USE hospital_db;

CREATE TABLE IF NOT EXISTS pending_hospital_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hospital_name VARCHAR(255) NOT NULL,
  hospital_id_license VARCHAR(100),
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  contact_number VARCHAR(50),
  address VARCHAR(500),
  city VARCHAR(100),
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_username (username)
);
```

### 2. Add hospital_id to users table (if not already done)

```bash
mysql -u root -p hospital_db < backend/migrations/add_hospital_id_to_users.sql
```

## 🔧 Troubleshooting

### Error: "Table 'pending_hospital_requests' doesn't exist"
**Solution**: Run the migration above (Step 1)

### Error: "Unknown column 'department' in 'where clause'"
**Solution**: Your `hospital_load` table has different column names. The code now handles this automatically, but if issues persist:

1. Check your actual column names:
   ```sql
   DESCRIBE hospital_load;
   ```

2. The code will automatically try different column name variations:
   - `department`
   - `dept`
   - `dept_name`

### Login works after deleting users
**Solution**: Clear browser localStorage:
1. Open browser console (F12)
2. Run: `localStorage.clear()`
3. Refresh page

Or the code now automatically clears invalid user data on failed login.

## ✅ Verification

After running migrations, verify tables exist:

```sql
SHOW TABLES;
-- Should show: pending_hospital_requests

DESCRIBE pending_hospital_requests;
-- Should show all columns

DESCRIBE users;
-- Should show hospital_id column
```

## 🚀 Start the System

1. **Start Backend**:
   ```bash
   cd backend
   node server.js
   ```

2. **Start Frontend** (in another terminal):
   ```bash
   cd frontend
   python -m http.server 8000
   ```

3. **Access**:
   - Registration: http://localhost:8000/register-hospital.html
   - Admin Dashboard: http://localhost:8000/admin-dashboard.html
   - Staff Login: http://localhost:8000/login.html



