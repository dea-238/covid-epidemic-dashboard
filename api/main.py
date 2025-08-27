from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
import logging

# Import your project's modules
from src.ingest import get_jhu_data, get_who_data
from src.forecast import fit_forecast
from src.rt import estimate_rt
from src.analysis import analyze_intervention_impact
from src.hospitalizations import get_hospitalization_data

# FIX: Configure logging for better debugging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Epidemic Explorer API",
    description="API for epidemic forecasting, R_t estimation, and intervention analysis.",
    version="5.3.1"  # FIX: Version increment for improvements
)

# Add CORS middleware to allow the React frontend to communicate with this backend
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    # This allows your frontend to connect.
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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
    country_name: Optional[str] = None  # FIX: Use Optional instead of | None for better compatibility

class RtRequest(BaseModel):
    dates: List[str]
    cases: List[float]
    serial_interval: float = 4.0
    window: int = 7

class InterventionRequest(BaseModel):
    dates: List[str]
    cases: List[float]
    effectiveness: float

# FIX: Add input validation helper
def validate_time_series_data(dates: List[str], cases: List[float]) -> tuple[pd.DataFrame, str]:
    """Validate and prepare time series data, return (dataframe, error_message)"""
    try:
        if len(dates) != len(cases):
            return None, "Dates and cases arrays must have the same length"
        
        if len(dates) == 0:
            return None, "No data provided"
        
        # Check for negative cases
        if any(case < 0 for case in cases if case is not None):
            return None, "Cases cannot be negative"
        
        df = pd.DataFrame({'date': pd.to_datetime(dates), 'cases': cases})
        df = df.dropna()  # Remove any rows with NaN values
        
        if df.empty:
            return None, "No valid data after cleaning"
        
        return df, None
        
    except Exception as e:
        return None, f"Data validation error: {str(e)}"

# --- API Endpoints ---

@app.post("/ingest/jhu")
def ingest_jhu_endpoint(req: IngestRequest):
    """Ingest JHU COVID-19 data for a specific country"""
    try:
        logger.info(f"Fetching JHU data for country: {req.country}")
        df = get_jhu_data(req.country)
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No JHU data found for '{req.country}'.")
        
        logger.info(f"Successfully fetched {len(df)} records for {req.country}")
        return {
            "dates": df['date'].dt.strftime('%Y-%m-%d').tolist(),
            "cases": df['cases'].tolist(),
            "deaths": df['deaths'].tolist(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching JHU data for {req.country}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/ingest/who")
def ingest_who_endpoint(req: IngestRequest):
    """Ingest WHO COVID-19 data for a specific country"""
    try:
        logger.info(f"Fetching WHO data for country: {req.country}")
        df = get_who_data(req.country)
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No WHO data found for '{req.country}'.")
        
        logger.info(f"Successfully fetched {len(df)} records for {req.country}")
        return {
            "dates": df['date'].dt.strftime('%Y-%m-%d').tolist(),
            "cases": df['cases'].tolist(),
            "deaths": df['deaths'].tolist(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching WHO data for {req.country}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/forecast")
def forecast_endpoint(req: ForecastRequest):
    """Generate epidemic forecast using Prophet model"""
    try:
        # FIX: Add input validation
        df, error_msg = validate_time_series_data(req.dates, req.cases)
        if error_msg:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # FIX: Validate horizon
        if req.horizon <= 0 or req.horizon > 365:
            raise HTTPException(status_code=400, detail="Horizon must be between 1 and 365 days")
        
        logger.info(f"Generating forecast with horizon {req.horizon} days")
        forecast_df, seasonality_df = fit_forecast(df, req.horizon, req.country_name)
        
        # FIX: Better handling of NaN values in forecast results
        forecast_result = {
            "forecast_dates": forecast_df['date'].dt.strftime('%Y-%m-%d').tolist(),
            "forecast_mean": forecast_df['mean'].replace({np.nan: None}).tolist(),
            "lower_95": forecast_df['lower_95'].replace({np.nan: None}).tolist(),
            "upper_95": forecast_df['upper_95'].replace({np.nan: None}).tolist(),
            "seasonality": {
                key: [None if pd.isna(val) else val for val in values] 
                for key, values in seasonality_df.to_dict(orient='list').items()
            },
        }
        
        logger.info("Forecast generated successfully")
        return forecast_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating forecast: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Forecast generation failed: {str(e)}")

@app.post("/rt")
def rt_endpoint(req: RtRequest):
    """Estimate effective reproduction number (R_t)"""
    try:
        # FIX: Add input validation
        df, error_msg = validate_time_series_data(req.dates, req.cases)
        if error_msg:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # FIX: Validate parameters
        if req.serial_interval <= 0:
            raise HTTPException(status_code=400, detail="Serial interval must be positive")
        
        if req.window <= 0 or req.window > len(df):
            raise HTTPException(status_code=400, detail=f"Window must be between 1 and {len(df)}")
        
        logger.info(f"Estimating R_t with serial_interval={req.serial_interval}, window={req.window}")
        rt_df = estimate_rt(df, req.serial_interval, req.window)
        
        # FIX: More robust NaN handling
        rt_values = rt_df['R_t'].replace({np.nan: None, np.inf: None, -np.inf: None}).tolist()
        
        result = {
            "dates": rt_df['date'].dt.strftime('%Y-%m-%d').tolist(),
            "rt": rt_values,
        }
        
        logger.info("R_t estimation completed successfully")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error estimating R_t: {str(e)}")
        raise HTTPException(status_code=500, detail=f"R_t estimation failed: {str(e)}")

@app.post("/analyze_intervention")
def analyze_intervention_endpoint(req: InterventionRequest):
    """Analyze the impact of interventions on epidemic spread"""
    try:
        # FIX: Add input validation
        df, error_msg = validate_time_series_data(req.dates, req.cases)
        if error_msg:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # FIX: Validate effectiveness parameter
        if not (0 <= req.effectiveness <= 1):
            raise HTTPException(status_code=400, detail="Effectiveness must be between 0 and 1")
        
        logger.info(f"Analyzing intervention impact with effectiveness={req.effectiveness}")
        impact_analysis = analyze_intervention_impact(df, req.effectiveness)
        
        logger.info("Intervention analysis completed successfully")
        return {
            "dates": impact_analysis['dates'],
            "original_cases": impact_analysis['original_cases'],
            "intervention_cases": impact_analysis['intervention_cases'],
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing intervention: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Intervention analysis failed: {str(e)}")

@app.post("/hospitalizations")
def hospitalizations_endpoint(req: IngestRequest):
    """Get hospitalization data for a specific country"""
    try:
        logger.info(f"Fetching hospitalization data for country: {req.country}")
        
        # FIX: Handle the case where hospitalization data might not exist
        try:
            df = get_hospitalization_data(req.country)
        except Exception as data_error:
            logger.warning(f"Hospitalization data not available for {req.country}: {str(data_error)}")
            # Return empty data structure instead of 404
            return {
                "dates": [],
                "hospitalizations": [],
                "icu": [],
                "message": f"Hospitalization data not available for '{req.country}'"
            }
        
        if df.empty:
            logger.info(f"No hospitalization data available for {req.country}")
            # Return empty data structure instead of 404
            return {
                "dates": [],
                "hospitalizations": [],
                "icu": [],
                "message": f"No hospitalization data available for '{req.country}'"
            }
        
        # FIX: Better handling of missing columns
        result = {
            "dates": df['date'].dt.strftime('%Y-%m-%d').tolist(),
            "hospitalizations": df.get('hospitalizations', []).tolist() if 'hospitalizations' in df.columns else [],
            "icu": df.get('icu', []).tolist() if 'icu' in df.columns else [],
            "message": f"Successfully loaded {len(df)} hospitalization records"
        }
        
        logger.info(f"Successfully fetched hospitalization data: {len(df)} records")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching hospitalization data for {req.country}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Hospitalization data fetch failed: {str(e)}")

# FIX: Add health check endpoint
@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "version": "5.3.1"}

# FIX: Add endpoint to list available countries (if your data modules support it)
@app.get("/countries")
def list_countries():
    """List available countries (placeholder - implement based on your data sources)"""
    # This would need to be implemented based on your actual data sources
    # For now, return a placeholder response
    return {
        "message": "Country listing not implemented yet",
        "suggestion": "Try common country names like 'India', 'United States', 'Germany', etc."
    }