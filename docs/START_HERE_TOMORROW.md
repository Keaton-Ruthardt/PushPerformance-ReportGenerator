# 🚀 Push Performance - Quick Start Guide

## 📋 Project Status (As of October 21, 2025)

### ✅ Completed Features:
1. **PostgreSQL Database** - Fully configured and running
2. **Express Backend API** - All endpoints working
3. **JWT Authentication** - Login system operational
4. **Improved PDF Generation** - Beautiful reports with all 6 tests
5. **React Frontend** - Login, Dashboard, and Assessment form complete

---

## 🏁 How to Start Tomorrow

### Step 1: Start PostgreSQL Database
PostgreSQL should auto-start on Windows. If not:
- Open **pgAdmin4** from Start menu
- Or check Windows Services for "postgresql-x64-18"

### Step 2: Open Your Project Folder
```bash
cd "C:\Users\Jkeat\Push Performance\push-performance-app"
```

### Step 3: Start the Backend Server
**Option A - Using npm (recommended):**
```bash
npm run server
```

**Option B - Direct node command:**
```bash
node server/index.js
```

You should see:
```
🚀 Push Performance Server is running on port 5000
📊 Health check: http://localhost:5000/health
```

### Step 4: Start the React Frontend (in a NEW terminal)
```bash
cd "C:\Users\Jkeat\Push Performance\push-performance-app\client"
npm run dev
```

You should see:
```
VITE v7.1.11 ready in XXX ms
➜  Local:   http://localhost:3000/
```

### Step 5: Access the Application
Open your browser and go to:
**http://localhost:3000**

---

## 🔑 Login Credentials

**Username:** `pushtrainer`
**Password:** `PushPerformance2025!`

**Database:**
- Host: `localhost`
- Port: `5432`
- Database: `push_performance`
- User: `postgres`
- Password: `Keaton4177011!!!`

---

## 🎯 What You Can Do Right Now

1. **Login** to the web app
2. **Create New Assessment** with athlete data
3. **Fill in test results** (simplified form for now)
4. **Save & Generate PDF** - Downloads improved report with all 6 tests!

---

## 📁 Important Files

### Backend:
- `server/index.js` - Main server file
- `server/routes/pdf.js` - PDF generation endpoint
- `server/services/pdfServiceV2.js` - **NEW improved PDF service (746KB PDFs)**
- `.env` - Environment variables (credentials)

### Frontend:
- `client/src/App.jsx` - Main React app with routing
- `client/src/pages/Login.jsx` - Login page
- `client/src/pages/Dashboard.jsx` - Dashboard
- `client/src/pages/Assessment.jsx` - Assessment form

### Generated PDFs:
- `API-TEST.pdf` ✅ New improved version (746KB)
- `VERIFICATION-TEST.pdf` ✅ New improved version (746KB)
- Old PDFs (98KB) - ignore these

---

## 🐛 Troubleshooting

### If Backend Won't Start:
```bash
# Check if port 5000 is in use
netstat -ano | findstr :5000

# Or just restart:
taskkill /F /IM node.exe
cd "C:\Users\Jkeat\Push Performance\push-performance-app"
npm run server
```

### If Frontend Won't Start:
```bash
# Make sure you're in the client folder
cd "C:\Users\Jkeat\Push Performance\push-performance-app\client"
npm run dev
```

### If Database Won't Connect:
- Open pgAdmin4
- Verify `push_performance` database exists
- Check PostgreSQL service is running (Windows Services)

### If PDF Looks Old (98KB instead of 746KB):
```bash
# Kill ALL node processes
taskkill /F /IM node.exe

# Restart server fresh
cd "C:\Users\Jkeat\Push Performance\push-performance-app"
node server/index.js
```

---

## 🎨 PDF Features (v2.0)

Your improved PDFs now have:
- ✅ Solid purple header with "PUSH PERFORMANCE"
- ✅ "v2.0 - Enhanced Design" version marker
- ✅ All 6 force plate tests displayed:
  - CMJ (Countermovement Jump)
  - SJ (Squat Jump)
  - HT (Hop Test)
  - SL CMJ (Single Leg CMJ)
  - IMTP (Isometric Mid-Thigh Pull)
  - PPU (Plyometric Push-Up)
- ✅ Colored assessment boxes
- ✅ Professional borders and styling
- ✅ Key takeaways highlighted for each test

---

## 🚀 Next Steps (Future Enhancements)

### High Priority:
1. **Athlete Search/Selection** - Browse athletes from VALD API
2. **Detailed Test Input Fields** - Full metrics for each test type
3. **Data Visualization** - Charts using Recharts library

### Medium Priority:
4. **Edit Existing Reports** - Modify saved assessments
5. **View Assessment History** - List all past reports
6. **PDF Preview** - See PDF before downloading

### Low Priority:
7. **User Management** - Multiple trainer accounts
8. **Export to Excel** - Data export functionality
9. **Email Reports** - Send PDFs directly

---

## 📦 Package Installation (if needed)

If you get module errors, reinstall dependencies:

**Backend:**
```bash
cd "C:\Users\Jkeat\Push Performance\push-performance-app"
npm install
```

**Frontend:**
```bash
cd "C:\Users\Jkeat\Push Performance\push-performance-app\client"
npm install
```

---

## 🆘 Quick Command Reference

### Stop Everything:
```bash
# Kill all Node processes
taskkill /F /IM node.exe

# Or press Ctrl+C in each terminal
```

### Check What's Running:
```bash
# Check backend
curl http://localhost:5000/health

# Check frontend
curl http://localhost:3000
```

### View Logs:
Backend logs appear in the terminal where you ran `npm run server`
Frontend logs appear in the terminal where you ran `npm run dev`

---

## 📞 Need Help?

If something isn't working:
1. Check this guide's troubleshooting section
2. Make sure both servers are running
3. Check browser console (F12) for frontend errors
4. Check terminal for backend errors

---

## 🎉 You're All Set!

Your Push Performance Assessment System is ready to use. Both the backend and frontend are complete and working!

**Tomorrow, just run:**
1. `npm run server` (in main folder)
2. `npm run dev` (in client folder)
3. Open http://localhost:3000

Happy assessing! 🏋️‍♂️💪
