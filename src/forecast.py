import pandas as pd
try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False
    print("Warning: Prophet not available. Forecast functionality will be limited.")

def fit_forecast(df: pd.DataFrame, horizon: int, country_name: str = None):
    """
    Fits a Prophet model and returns the forecast and seasonality dataframes.
    """
    if not PROPHET_AVAILABLE:
        # Fallback to simple linear trend if Prophet is not available
        return _simple_forecast(df, horizon)
    
    df_prophet = df.rename(columns={'date': 'ds', 'cases': 'y'})
    
    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
    )

    if country_name:
        try:
            model.add_country_holidays(country_name=country_name)
        except Exception as e:
            print(f"Warning: Could not add holidays for {country_name}: {e}")

    model.fit(df_prophet)

    future = model.make_future_dataframe(periods=horizon)
    forecast = model.predict(future)

    # Prepare the main forecast dataframe
    forecast_df = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].rename(columns={
        'ds': 'date', 'yhat': 'mean', 'yhat_lower': 'lower_95', 'yhat_upper': 'upper_95'
    })
    
    for col in ['mean', 'lower_95', 'upper_95']:
        forecast_df[col] = forecast_df[col].clip(lower=0)

    # Prepare the seasonality dataframe
    seasonality_df = get_seasonality_components(model)

    return forecast_df.tail(horizon), seasonality_df

def get_seasonality_components(model):
    """
    Extracts seasonality and holiday components from the Prophet model.
    """
    from prophet.plot import plot_weekly, plot_yearly
    import matplotlib.pyplot as plt
    
    # This is a placeholder as we can't directly return plots.
    # We will return the components from the model instead.
    
    active_seasonalities = []
    if 'weekly' in model.seasonalities:
        active_seasonalities.append('weekly')
    if 'yearly' in model.seasonalities:
        active_seasonalities.append('yearly')
    if model.holidays is not None:
        active_seasonalities.append('holidays')

    future = model.make_future_dataframe(periods=365)
    forecast = model.predict(future)
    
    seasonality_data = forecast[['ds'] + active_seasonalities]
    seasonality_data['ds'] = seasonality_data['ds'].dt.strftime('%Y-%m-%d')
    
    return seasonality_data

def _simple_forecast(df: pd.DataFrame, horizon: int):
    """
    Simple linear trend forecast as fallback when Prophet is not available.
    """
    import numpy as np
    from datetime import timedelta
    
    # Simple linear regression on the last 30 days
    recent_data = df.tail(30).copy()
    recent_data['days'] = range(len(recent_data))
    
    # Fit linear trend
    if len(recent_data) > 1:
        slope = np.polyfit(recent_data['days'], recent_data['cases'], 1)[0]
        intercept = recent_data['cases'].iloc[-1]
    else:
        slope = 0
        intercept = recent_data['cases'].iloc[0] if len(recent_data) > 0 else 0
    
    # Generate forecast dates
    last_date = df['date'].max()
    forecast_dates = [last_date + timedelta(days=i+1) for i in range(horizon)]
    
    # Generate forecast values
    forecast_values = [max(0, intercept + slope * (i+1)) for i in range(horizon)]
    
    # Create forecast dataframe with confidence intervals (simplified)
    forecast_df = pd.DataFrame({
        'date': forecast_dates,
        'mean': forecast_values,
        'lower_95': [max(0, val * 0.8) for val in forecast_values],
        'upper_95': [val * 1.2 for val in forecast_values]
    })
    
    # Simple seasonality data (empty for fallback)
    seasonality_df = pd.DataFrame({
        'ds': [str(date.date()) for date in forecast_dates[:7]],
    })
    
    return forecast_df, seasonality_df