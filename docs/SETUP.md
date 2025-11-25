# Push Performance - Setup Guide

## Quick Start Guide

Follow these steps to get the Push Performance Assessment Report System up and running.

### Step 1: Install Dependencies

```bash
cd "C:\Users\Jkeat\Push Performance\push-performance-app"
npm install
npm install concurrently --save-dev
```

### Step 2: Set Up PostgreSQL Database

1. **Install PostgreSQL** (if not already installed):
   - Download from: https://www.postgresql.org/download/
   - During installation, remember the password you set for the `postgres` user

2. **Create the database:**
   ```bash
   # Open PostgreSQL command line (psql)
   psql -U postgres

   # Create database
   CREATE DATABASE push_performance;

   # Exit psql
   \q
   ```

### Step 3: Configure Environment Variables

1. **Copy the example environment file:**
   ```bash
   copy .env.example .env
   ```

2. **Edit `.env` file** with your actual credentials:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=push_performance
   DB_USER=postgres
   DB_PASSWORD=YOUR_POSTGRES_PASSWORD_HERE

   # JWT Configuration
   JWT_SECRET=pushperformance_secret_key_change_this_in_production

   # VALD API Configuration
   VALD_API_URL=https://api.vald.com
   VALD_API_KEY=YOUR_VALD_API_KEY_HERE
   VALD_API_SECRET=YOUR_VALD_API_SECRET_HERE

   # Hardcoded Credentials (for trainer login)
   TRAINER_USERNAME=pushtrainer
   TRAINER_PASSWORD=PushPerformance2025!

   # Percentile Sync Schedule (cron format - default: daily at 3am)
   PERCENTILE_SYNC_SCHEDULE=0 3 * * *
   ```

### Step 4: Start the Server

```bash
npm run server
```

You should see:
```
✅ Database schema initialized successfully
🚀 Push Performance Server is running on port 5000
📊 Health check: http://localhost:5000/health
🔄 Percentile sync scheduled: 0 3 * * *
```

### Step 5: Initial Data Sync

Run the percentile sync to populate the database with professional athlete norms:

```bash
npm run sync-percentiles
```

This will:
- Fetch all professional athletes from VALD
- Calculate percentile ranges for each test metric
- Store the data in PostgreSQL

### Step 6: Test the API

**Test health endpoint:**
```bash
curl http://localhost:5000/health
```

**Test login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"pushtrainer\",\"password\":\"PushPerformance2025!\"}"
```

You should receive a JWT token in the response.

## Next Steps

### Building the Frontend

The backend is complete! Next, you'll want to build the React frontend. Here's what needs to be done:

1. **Set up React app in the client folder**
2. **Create components:**
   - Login page
   - Athlete selection page
   - Assessment report form
   - Force plate test displays with percentile visualizations
   - PDF preview/download

3. **Connect to the backend API** using axios

Would you like me to help build the React frontend next?

## Troubleshooting

### "Cannot connect to database"
- Ensure PostgreSQL is running
- Check your DB password in `.env`
- Verify the database exists: `psql -U postgres -c "\l"`

### "Module not found" errors
- Run `npm install` again
- Delete `node_modules` and run `npm install`

### VALD API errors
- Double-check your API credentials
- Review the VALD API documentation to ensure endpoint URLs match
- The VALD service file may need adjustment based on their actual API structure

### "Port already in use"
- Change PORT in `.env` to a different number (e.g., 5001)
- Or kill the process using port 5000

## Important Notes for VALD Integration

The VALD API service (`server/services/valdService.js`) contains **placeholder code**. You MUST:

1. **Get actual VALD API documentation**
2. **Update endpoint URLs** to match their real API endpoints
3. **Adjust data mapping** based on their actual response structure
4. **Test with real VALD credentials**

The endpoints I've created are based on assumptions. They might be:
- `/api/v1/athletes` instead of `/athletes`
- Different authentication method (OAuth, API key in header, etc.)
- Different response structure

## Production Deployment Checklist

Before deploying to production:

- [ ] Change `JWT_SECRET` to a strong random string
- [ ] Update `TRAINER_PASSWORD` to a secure password
- [ ] Verify VALD API credentials are correct
- [ ] Test percentile sync with real data
- [ ] Set up PostgreSQL backups
- [ ] Configure HTTPS/SSL
- [ ] Set up monitoring and logging
- [ ] Test PDF generation with real athlete data

## Support

If you run into any issues during setup, check:
1. The README.md file for API documentation
2. Server logs for error messages
3. Database connection and schema

Need help? Review the code comments in each file for detailed explanations.
