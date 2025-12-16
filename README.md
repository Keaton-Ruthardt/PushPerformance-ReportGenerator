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

