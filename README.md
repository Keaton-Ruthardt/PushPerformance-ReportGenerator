# Push Performance Assessment Report System

A comprehensive assessment report system for Push Performance that generates professional PDF reports by pulling data from VALD API and combining it with trainer observations.

## Features

- **VALD API Integration**: Automatically pulls force plate test data for professional athletes
- **Percentile Analysis**: Compares athlete metrics against professional player population
- **Dual Input System**: Combines objective VALD data with trainer professional knowledge
- **PDF Generation**: Creates professional, branded assessment reports
- **Editable Reports**: Trainers can edit and regenerate reports as needed
- **Automated Sync**: Background job updates percentile ranges daily

## Project Structure

```
push-performance-app/
├── server/
│   ├── config/
│   │   └── database.js          # PostgreSQL connection
│   ├── middleware/
│   │   └── auth.js               # JWT authentication
│   ├── models/
│   │   └── schema.sql            # Database schema
│   ├── routes/
│   │   ├── auth.js               # Authentication endpoints
│   │   ├── athletes.js           # Athlete data endpoints
│   │   ├── reports.js            # Report CRUD endpoints
│   │   └── pdf.js                # PDF generation endpoint
│   ├── scripts/
│   │   └── syncPercentiles.js    # Percentile sync script
│   ├── services/
│   │   ├── valdService.js        # VALD API integration
│   │   ├── percentileService.js  # Percentile calculations
│   │   └── pdfService.js         # PDF generation
│   └── index.js                  # Main server file
├── client/                       # React frontend (to be built)
├── .env.example                  # Environment variables template
├── .gitignore
├── package.json
└── README.md
```

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- VALD API credentials

## Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd "C:\Users\Jkeat\Push Performance\push-performance-app"
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up PostgreSQL database:**
   ```sql
   CREATE DATABASE push_performance;
   ```

4. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

5. **Configure environment variables in `.env`:**
   ```env
   # Database
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=push_performance
   DB_USER=postgres
   DB_PASSWORD=your_password

   # JWT
   JWT_SECRET=your_secret_key

   # VALD API (replace with actual credentials)
   VALD_API_URL=https://api.vald.com
   VALD_API_KEY=your_vald_api_key
   VALD_API_SECRET=your_vald_api_secret

   # Trainer credentials
   TRAINER_USERNAME=pushtrainer
   TRAINER_PASSWORD=PushPerformance2025!
   ```

## Running the Application

### Development Mode

1. **Start the backend server:**
   ```bash
   npm run server
   ```
   Server will run on `http://localhost:5000`

2. **Initial setup - Run percentile sync:**
   ```bash
   npm run sync-percentiles
   ```
   This populates the database with percentile ranges from VALD pro athletes.

### Testing the API

**Health Check:**
```bash
curl http://localhost:5000/health
```

**Login:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"pushtrainer","password":"PushPerformance2025!"}'
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login and get JWT token
- `POST /api/auth/verify` - Verify JWT token

### Athletes
- `GET /api/athletes` - Get all professional athletes
- `GET /api/athletes/:id` - Get athlete details
- `GET /api/athletes/:id/tests` - Get athlete test results with percentiles

### Reports
- `POST /api/reports` - Create/update assessment report
- `GET /api/reports/:athleteId` - Get assessment report
- `DELETE /api/reports/:athleteId` - Delete assessment report

### PDF
- `POST /api/pdf/generate` - Generate PDF from report data

## Force Plate Tests Supported

1. **Countermovement Jump (CMJ)** - 12 metrics
2. **Squat Jump (SJ)** - 5 metrics
3. **Hop Test (HT)** - 3 metrics
4. **Single Leg CMJ (SL CMJ)** - 9 metrics per leg with asymmetry analysis
5. **Isometric Mid-Thigh Pull (IMTP)** - 4 metrics
6. **Plyometric Push-Up (PPU)** - 6 metrics

## Percentile Color Coding

- **Green**: 75th percentile and above (top 25%)
- **Yellow**: 25th-75th percentile (middle 50%)
- **Red**: Below 25th percentile (bottom 25%)

## Asymmetry Color Coding

- **Green**: < 5%
- **Yellow**: 5-10%
- **Red**: > 10%

## Database Schema

- **percentile_ranges**: Stores min/max/percentile values for each test metric
- **assessment_reports**: Stores athlete profiles and trainer assessments
- **test_results**: Stores force plate test data and key takeaways

## Deployment to Render

**📋 Quick Start**: See [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md)

**📚 Complete Guide**: See [DEPLOYMENT.md](./DEPLOYMENT.md)

**🔐 Environment Variables**: See [ENV_VARIABLES.md](./ENV_VARIABLES.md)

### Quick Deploy Steps:

1. Push code to GitHub
2. Create Web Service on Render (or use Blueprint with `render.yaml`)
3. Set environment variables (see `ENV_VARIABLES.md`)
4. Upload BigQuery credentials as secret file
5. Add disk for Puppeteer cache
6. Deploy!

The app includes:
- React frontend (Vite build)
- Node.js/Express backend
- Puppeteer PDF generation
- BigQuery integration
- Professional athlete filtering
- Spider chart metric selector

## Important Notes

### VALD API Integration
The VALD service (`server/services/valdService.js`) contains placeholder endpoint structures. You'll need to:
1. Review actual VALD API documentation
2. Update endpoint URLs to match their actual API
3. Adjust response data mapping based on their actual response structure
4. Add proper authentication headers as required by VALD

### Next Steps for Frontend
The backend is complete. Next steps would include:
1. Building React frontend components
2. Creating athlete selection interface
3. Building the assessment form with all editable sections
4. Implementing test result displays with percentile visualizations
5. Adding PDF preview and download functionality

## Troubleshooting

**Database connection issues:**
- Ensure PostgreSQL is running
- Check database credentials in `.env`
- Verify database exists: `CREATE DATABASE push_performance;`

**VALD API errors:**
- Verify API credentials are correct
- Check API endpoint URLs match VALD's actual API
- Ensure professional athletes are tagged correctly in VALD

**Percentile sync fails:**
- Check VALD API connectivity
- Verify sufficient pro athlete data exists
- Review logs for specific error messages

## Support

For issues or questions, contact the development team.

## License

Proprietary - Push Performance AZ
