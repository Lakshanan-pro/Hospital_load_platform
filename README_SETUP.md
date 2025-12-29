# Hospital Load Visibility Platform - Setup Guide

## Overview
A full-stack web application for real-time hospital crowd visibility. Public users can view nearby hospitals with crowd levels, while hospital staff can update their hospital's status.

## System Architecture
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js + Express
- **Database**: MySQL
- **Map**: Leaflet.js with OpenStreetMap

## Database Setup

### 1. Create Database
```sql
CREATE DATABASE hospital_db;
USE hospital_db;
```

### 2. Run Migration Scripts
```bash
# Add hospital_id column to users table
mysql -u root -p hospital_db < backend/migrations/add_hospital_id_to_users.sql

# Insert sample data (hospitals and load data)
mysql -u root -p hospital_db < backend/migrations/sample_data.sql
```

### 3. Create Staff User Accounts
Use the provided script to create staff accounts with proper password hashing:

```bash
# Create a staff account linked to a hospital
node backend/scripts/create_user.js <username> <password> <hospital_id>

# Example:
node backend/scripts/create_user.js staff_hospital1 password123 1
```

**Test Accounts** (if you used sample_data.sql):
- Username: `staff_citygeneral`, Password: Use create_user.js to set password
- Username: `staff_metro`, Password: Use create_user.js to set password
- Username: `staff_community`, Password: Use create_user.js to set password

## Backend Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Database
Edit `backend/config/db.js` with your MySQL credentials:
```javascript
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "your_password",  // Update this
  database: "hospital_db",
  // ...
});
```

### 3. Start Backend Server
```bash
node server.js
# Server runs on http://localhost:5000
```

## Frontend Setup

### 1. Serve Frontend Files
You can use any static file server:

**Option 1: Python**
```bash
cd frontend
python -m http.server 8000
```

**Option 2: Node.js (http-server)**
```bash
npm install -g http-server
cd frontend
http-server -p 8000
```

**Option 3: VS Code Live Server**
- Install "Live Server" extension
- Right-click on `index.html` → "Open with Live Server"

### 2. Access Application
Open browser to: `http://localhost:8000`

## Key Features

### Public Access (No Login Required)
- **Landing Page** (`index.html`): Default entry point
- **Map Page** (`map.html`): View nearby hospitals with crowd levels
- **Hospital Details** (`hospital.html`): Detailed view of a hospital

### Staff Portal (Login Required)
- **Login** (`login.html`): Staff authentication
- **Dashboard** (`dashboard.html`): Update hospital crowd status

## Authentication Flow

### Staff Account Creation
1. **No Public Signup**: Public registration is disabled for security
2. **Admin Creates Accounts**: Use `create_user.js` script or manual SQL
3. **Hospital Linking**: 
   - Option A: Pre-link during account creation (recommended)
   - Option B: Staff selects hospital on first dashboard login (one-time)

### Login Process
1. Staff visits `login.html`
2. Enters credentials provided by admin
3. Redirected to dashboard
4. If no hospital assigned, selects hospital (one-time)
5. Can update crowd levels and wait times

## Database Schema

### Tables
- **hospitals**: Hospital information (name, location)
- **hospital_load**: Real-time crowd data (department, crowd_level, estimated_wait)
- **users**: Staff accounts (username, password, role, hospital_id)

### Important Notes
- `hospital_id` in `users` table is nullable
- Staff can be pre-linked or select hospital once
- Only hospitals with load data appear on map (no dummy/random data)

## API Endpoints

### Public Endpoints
- `GET /api/hospitals/nearby?lat={lat}&lng={lng}` - Get nearby hospitals with crowd data
- `GET /api/hospitals/:id` - Get hospital details
- `GET /api/hospitals/` - List all hospitals

### Staff Endpoints (Authentication recommended)
- `POST /api/hospitals/:id/load` - Update hospital load data
- `POST /api/hospitals/link-user` - Link hospital to user (one-time)
- `POST /api/auth/login` - Staff login
- `POST /api/auth/signup` - **DISABLED** (returns 403)

## Testing

### Sample Data
The `sample_data.sql` script creates:
- 5 sample hospitals in Chennai area
- Load data for each hospital (LOW, MEDIUM, HIGH crowd levels)
- 3 sample staff accounts (use create_user.js to set passwords)

### Test the System
1. Start backend: `node backend/server.js`
2. Serve frontend: `python -m http.server 8000` (in frontend folder)
3. Open `http://localhost:8000`
4. View map (public access)
5. Login as staff (use created accounts)
6. Update hospital status from dashboard
7. Refresh map to see updated crowd levels

## Troubleshooting

### Backend Not Connecting
- Check MySQL is running
- Verify database credentials in `backend/config/db.js`
- Ensure `hospital_db` database exists

### Map Not Showing Hospitals
- Verify backend is running on port 5000
- Check browser console for errors
- Ensure sample data is inserted (hospitals with load data)
- Only hospitals with `hospital_load` records appear on map

### Login Not Working
- Verify user exists in database
- Use `create_user.js` to create accounts with proper password hashes
- Check backend logs for errors

### Dashboard Shows "No Hospital"
- If user has `hospital_id = NULL`, they need to select hospital once
- After selection, hospital is linked permanently
- To change assignment, update database directly or contact admin

## Security Notes

- Passwords are hashed using bcrypt
- Public signup is disabled (admin-only account creation)
- Staff accounts are verified before access
- Hospital assignments prevent unauthorized updates

## Production Considerations

For production deployment:
1. Use environment variables for database credentials
2. Implement JWT tokens for authentication
3. Add rate limiting to API endpoints
4. Use HTTPS
5. Implement proper session management
6. Add input validation and sanitization
7. Set up proper error logging
8. Use a production-grade web server (nginx, Apache)

## License
This is a portfolio/resume project. Modify as needed for your use case.



