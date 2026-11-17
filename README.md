# JunctionFlow AI 🚦🤖

**Smart Intersection Traffic Forecasting & Proactive Congestion Intelligence**

JunctionFlow AI is an end-to-end intelligent transportation system that ingests urban intersection telemetry, decomposes historical time-series traffic patterns, trains machine learning forecasting models (Seasonal-Naive, SARIMAX, Random Forest), flags upcoming capacity bottlenecks, and streams real-time telemetry updates to a live command dashboard via Socket.IO.

---

## 🌟 Key Features

- **Real-Time Traffic Control Center**:
  - Live intersection status streaming with **Socket.IO** (6-second telemetry pulse simulation).
  - Dynamic capacity utilization progress bars and peak hourly vehicle counts.
  - Proactive **Critical Congestion Alerts** forecasting bottleneck windows for the next 24 hours.
  - One-click multi-tab sync (`Sync Now`) and real-time cache invalidation.
- **Historical Trend Explorer & STL Decomposition**:
  - Multi-resolution time-series decomposition (Trend, Seasonal, Residual).
  - Spatial junction matrix heatmaps, weekday traffic profiles, and weather impact analysis.
  - Interactive raw records table with customizable 15-record pagination and 1-click **CSV / XLSX Export**.
- **Automated Feature Engineering**:
  - Zero-data-leakage lag generator ($t-1, t-2, \dots, t-24, t-168$).
  - Pre-shift rolling window statistics (mean, standard deviation, min, max over 3h, 6h, 12h, 24h).
  - Cyclical temporal embeddings ($\sin/\cos$ for hour-of-day and day-of-week), public holiday flags, and weather encoding.
- **Machine Learning Forecast Engine**:
  - **Seasonal-Naive**: 24-hour cycle baseline with confidence bounds.
  - **SARIMAX**: Classical statistical time-series model incorporating exogenous weather regressors.
  - **Random Forest Regressor**: Multi-step recursive forecasting with tree-variance confidence intervals and feature importance attribution.
  - Future weather override simulator (test heatwaves, severe rain, or storm scenarios).
  - **Latest 3 Reports Showcase**: One-click preview of recent forecasts with localized system timestamps.
- **Accuracy Benchmarking & Model Comparison**:
  - Full statistical evaluation metrics: $R^2$, RMSE, MAE, sMAPE.
  - Side-by-side model comparison across identical junction test sets.
- **Executive Reporting & Exports**:
  - Automated **PDF Report Generation** with styled summaries, key performance metrics, and bottleneck alerts.
  - **Excel (XLSX)** and **CSV** data exports.

---

## 🛠️ Architecture & Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.11+, FastAPI, Uvicorn, Pydantic v2, Python-SocketIO (ASGI) |
| **Data & ML** | Pandas, NumPy, SciPy, Scikit-learn, Statsmodels, Joblib |
| **Database** | MongoDB 7 / MongoDB Atlas via **Motor** (AsyncIO driver), GridFS |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, TanStack Query, Recharts, Socket.IO Client |
| **Reports** | ReportLab (PDF), openpyxl (Excel) |
| **DevOps** | Docker, Docker Compose, Nginx (Reverse Proxy with WebSocket upgrade), Ruff |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 20+ & **npm**
- **Python** 3.11+
- **Docker Desktop** (optional, for containerized run)
- **MongoDB** (Local instance or remote MongoDB Atlas cluster)

---

### Option A: Local Development (Recommended)

#### 1. Clone & Configure Environment
```bash
cp .env.example .env
```
Edit `.env` to configure your MongoDB connection:
```env
# MongoDB Atlas (or local mongodb://localhost:27017/junctionflow)
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/junctionflow?retryWrites=true&w=majority
MONGO_DB=junctionflow

# Backend
APP_ENV=development
SECRET_KEY=your-secret-key-change-in-production
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
LOG_LEVEL=INFO

# Frontend
VITE_API_URL=http://localhost:8000
```

#### 2. Start Backend
```bash
cd backend

# Create & activate virtual environment (Windows)
python -m venv .venv
.venv\Scripts\activate

# Install dependencies
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# Run FastAPI + Socket.IO server
uvicorn app.main:app --reload --port 8000
```
Backend API will be accessible at:
- **API Server**: `http://localhost:8000`
- **Swagger Docs**: `http://localhost:8000/docs`
- **Socket.IO Path**: `http://localhost:8000/socket.io/`

#### 3. Start Frontend
```bash
cd frontend

# Install packages
npm install

# Start Vite dev server with WebSocket proxy
npm run dev
```
Frontend will be accessible at:
- **Web App**: `http://localhost:5173`

---

### Option B: Docker Compose (Full Stack)

To run the entire stack with containerized Nginx, FastAPI, and MongoDB:

```bash
docker compose up --build
```

| Service | Port | Description |
|---|---|---|
| **Frontend** | `http://localhost:80` | Production React SPA served via Nginx with WebSocket reverse proxy |
| **Backend** | `http://localhost:8000` | FastAPI ASGI + Socket.IO server |
| **API Docs** | `http://localhost:8000/docs` | Interactive OpenAPI documentation |
| **MongoDB** | `mongodb://localhost:27017` | Local MongoDB 7 database (if not using remote Atlas) |

---

## 📊 End-to-End Workflow

```
1. Register Junctions  ──>  Set intersection name, coordinates & vehicle/hour capacity.
2. Ingest Dataset     ──>  Upload CSV/XLSX traffic telemetry & validate columns.
3. Explore Patterns   ──>  Inspect hourly trends, heatmaps, and STL components.
4. Engineer Features  ──>  Generate leakage-safe lag, rolling, and cyclical features.
5. Train ML Models    ──>  Train Seasonal-Naive, SARIMAX, and Random Forest models.
6. Run Forecasts      ──>  Predict 24h/48h/72h volumes and test weather overrides.
7. Monitor Dashboard  ──>  Stream live junction telemetry and inspect bottleneck warnings.
8. Generate Reports   ──>  Download executive PDF analysis or raw Excel data.
```

---

## 📡 Socket.IO Real-Time Channels

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `connect` | Client ➔ Server | — | Client establishes WebSocket or polling handshake |
| `dashboard:init` | Server ➔ Client | `{ live, summary, alerts, server_time }` | Immediate dashboard state snapshot on connection |
| `dashboard:telemetry_pulse` | Server ➔ Client | `{ live, server_time }` | Live junction telemetry pulse emitted every 6s |
| `dashboard:update` | Server ➔ Client | `{ live, summary, alerts, server_time }` | Triggered when a new forecast is generated or dataset ingested |
| `request_dashboard_refresh` | Client ➔ Server | — | Client requests an on-demand real-time re-sync |

---

## 🧪 Testing & Code Quality

### Backend Unit Tests & Linter
```bash
cd backend

# Run comprehensive test suite
pytest -v

# Run static analysis and linting
ruff check backend

# Test code formatting
python -m black --check backend/app backend/tests
```

### Frontend Typecheck & Production Build
```bash
cd frontend

# Run unit tests
npm test

# Build production bundle with optimized vendor chunking
npm run build
```

---

## 📁 Repository Structure

```
JunctionFlow AI/
├── backend/
│   ├── app/
│   │   ├── api/routes/         # REST API endpoints (junctions, datasets, models, etc.)
│   │   ├── core/               # App configuration, logging & Socket.IO server manager
│   │   ├── db/                 # Motor MongoDB connection & GridFS setup
│   │   ├── models/             # Pydantic data models & request/response schemas
│   │   ├── services/           # Core business logic, feature engineering & report builder
│   │   │   └── ml/             # ML estimators (Seasonal Naive, SARIMAX, Random Forest)
│   │   └── main.py             # ASGI application entrypoint with Socket.IO mounting
│   ├── tests/                  # Pytest unit tests for ML, metrics, and validation
│   ├── Dockerfile              # Python 3.11-slim container build
│   ├── .dockerignore           # Excluded files for container builds
│   └── requirements.txt        # Backend dependencies
│
├── frontend/
│   ├── src/
│   │   ├── api/                # Axios API service endpoints
│   │   ├── components/         # Reusable UI components, cards, and icons
│   │   ├── pages/              # Application views (Dashboard, Explore, Forecasts, etc.)
│   │   ├── services/           # Socket.IO client service & useDashboardSocket hook
│   │   ├── utils/              # Localized date & time formatting utilities
│   │   └── App.tsx             # Root router configuration
│   ├── nginx.conf              # Production Nginx reverse proxy with WebSocket support
│   ├── Dockerfile              # Multi-stage production container build
│   ├── .dockerignore           # Excluded frontend build files
│   └── package.json            # Frontend dependencies & scripts
│
├── .dockerignore               # Root Docker build exclusion
├── .env.example                # Environment variables template
├── .gitignore                  # Git tracking exclusions
├── docker-compose.yml          # Multi-container orchestration definition
└── README.md                   # Project documentation
```

---

## 📄 License
This project is licensed under the MIT License.
