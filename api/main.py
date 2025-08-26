from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import pandas as pd

# Import your project's modules
from src.ingest import get_jhu_data, get_who_data
from src.forecast import fit_forecast, get_seasonality_components
from src.rt import estimate_rt
from src.analysis import analyze_intervention_impact

app = FastAPI(
    title="Epidemic Explorer API",
    description="API for epidemic forecasting, R_t estimation, and intervention analysis.",
    version="4.0.0"
)

# Add CORS middleware to allow the React frontend to communicate with this backend
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models for API Request Validation ---

class IngestRequest(BaseModel):
    country: str

class ForecastRequest(BaseModel):
    dates: List[str]
    cases: List[float]
    horizon: int
    country_name: str | None = None

class RtRequest(BaseModel):
    dates: List[str]
    cases: List[float]
    serial_interval: float = 4.0
    window: int = 7

class InterventionRequest(BaseModel):
    dates: List[str]
    cases: List[float]
    effectiveness: float

# --- API Endpoints ---

@app.post("/ingest/jhu")
def ingest_jhu_endpoint(req: IngestRequest):
    try:
        df = get_jhu_data(req.country)
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No JHU data found for '{req.country}'. Please check the country name (it's case-sensitive, e.g., 'US', 'United Kingdom').")
        return {
            "dates": df['date'].dt.strftime('%Y-%m-%d').tolist(),
            "cases": df['cases'].tolist(),
            "deaths": df['deaths'].tolist(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred while fetching JHU data: {e}")

@app.post("/ingest/who")
def ingest_who_endpoint(req: IngestRequest):
    try:
        df = get_who_data(req.country)
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No WHO data found for '{req.country}'. Please check the country name.")
        return {
            "dates": df['date'].dt.strftime('%Y-%m-%d').tolist(),
            "cases": df['cases'].tolist(),
            "deaths": df['deaths'].tolist(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred while fetching WHO data: {e}")


@app.post("/forecast")
def forecast_endpoint(req: ForecastRequest):
    try:
        df = pd.DataFrame({'date': pd.to_datetime(req.dates), 'cases': req.cases})
        model, full_forecast = fit_forecast(df, req.horizon, req.country_name)
        
        forecast_period = full_forecast.tail(req.horizon)
        seasonality = get_seasonality_components(model, full_forecast)
        
        return {
            "forecast_dates": forecast_period['date'].dt.strftime('%Y-%m-%d').tolist(),
            "forecast_mean": forecast_period['mean'].tolist(),
            "lower_95": forecast_period['lower_95'].tolist(),
            "upper_95": forecast_period['upper_95'].tolist(),
            "seasonality": seasonality,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during forecasting: {e}")

@app.post("/rt")
def rt_endpoint(req: RtRequest):
    try:
        df = pd.DataFrame({'date': pd.to_datetime(req.dates), 'cases': req.cases})
        rt_df = estimate_rt(df, req.serial_interval, req.window)
        rt_df = rt_df.where(pd.notnull(rt_df), None) # Replace NaN with None for JSON
        return {
            "dates": rt_df['date'].dt.strftime('%Y-%m-%d').tolist(),
            "rt": rt_df['R_t'].tolist(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during R_t estimation: {e}")

@app.post("/analyze_intervention")
def analyze_intervention_endpoint(req: InterventionRequest):
    try:
        df = pd.DataFrame({'date': pd.to_datetime(req.dates), 'cases': req.cases})
        impact_analysis = analyze_intervention_impact(df, req.effectiveness)
        return {
            "dates": impact_analysis['dates'],
            "original_cases": impact_analysis['original_cases'],
            "intervention_cases": impact_analysis['intervention_cases'],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during intervention analysis: {e}")
