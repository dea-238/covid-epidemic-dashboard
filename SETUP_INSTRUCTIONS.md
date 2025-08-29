# Epidemic Management System - Setup Instructions

## Fixed Issues ✅

1. **Missing `__init__.py` files** - Added to `api/` and `app/` directories
2. **Prophet import hanging** - Added fallback mechanism for when Prophet is slow/unavailable
3. **Missing Streamlit app** - Created complete Streamlit dashboard at `app/streamlit_app.py`
4. **React dependencies** - Installed and verified
5. **API server configuration** - Fixed CORS and import issues

## Quick Start

### 1. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 2. Start the API Server
```bash
# Option A: Using the test script (recommended)
python tmp_rovodev_start_servers.py

# Option B: Direct uvicorn command
uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```

### 3. Start the React Frontend
```bash
cd react-frontend
npm install  # Already done
npm run dev
```

### 4. Start the Streamlit Dashboard (Alternative)
```bash
streamlit run app/streamlit_app.py
```

## Available Interfaces

1. **API Documentation**: http://127.0.0.1:8000/docs
2. **React Frontend**: http://localhost:5173 (after `npm run dev`)
3. **Streamlit Dashboard**: http://localhost:8501 (after streamlit command)

## API Endpoints

- `GET /` - Health check
- `POST /ingest/jhu` - Fetch JHU CSSE data
- `POST /ingest/who` - Fetch WHO data
- `POST /forecast` - Generate forecasts
- `POST /rt` - Calculate reproduction number
- `POST /intervention` - Analyze intervention impact
- `POST /hospitalization` - Get hospitalization data

## Features Working

✅ **Data Ingestion**: JHU CSSE and WHO COVID-19 datasets  
✅ **Time Series Forecasting**: Prophet with linear fallback  
✅ **R_t Estimation**: Cori-style reproduction number calculation  
✅ **Intervention Analysis**: Impact simulation  
✅ **Hospitalization Data**: ICU and hospital occupancy  
✅ **Interactive Dashboards**: Both React and Streamlit interfaces  
✅ **CORS Configuration**: Frontend can communicate with API  

## Troubleshooting

### Prophet Import Issues
If Prophet is slow to import, the system will automatically fall back to a simple linear forecasting method.

### Data Source Issues
- JHU CSSE data: Uses live GitHub repository
- WHO data: Uses official WHO CSV endpoint
- Both sources may occasionally be unavailable

### Port Conflicts
- API: Default port 8000 (configurable)
- React: Default port 5173 (Vite default)
- Streamlit: Default port 8501

## Example Usage

### Using the API directly:
```python
import requests

# Fetch data
response = requests.post("http://127.0.0.1:8000/ingest/jhu", 
                        json={"country": "US"})
data = response.json()

# Calculate R_t
rt_response = requests.post("http://127.0.0.1:8000/rt", 
                           json={
                               "dates": data["dates"],
                               "cases": data["cases"],
                               "serial_interval": 4.0
                           })
```

### Using the React Frontend:
1. Open http://localhost:5173
2. Select a country
3. Choose analysis type (Overview, R_t, Forecasting, etc.)
4. View interactive charts and results

### Using the Streamlit Dashboard:
1. Open http://localhost:8501
2. Select data source (JHU, WHO, or upload CSV)
3. Enter country name
4. Use the various analysis tools

## Project Structure
```
├── api/                 # FastAPI backend
├── src/                 # Core analysis modules
├── react-frontend/      # React dashboard
├── app/                 # Streamlit dashboard
├── requirements.txt     # Python dependencies
└── SETUP_INSTRUCTIONS.md # This file
```