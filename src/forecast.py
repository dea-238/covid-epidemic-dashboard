import pandas as pd
from prophet import Prophet

def fit_forecast(df: pd.DataFrame, horizon: int, country_name: str = None):
    """
    Fits a Prophet model and returns the forecast and seasonality dataframes.
    """
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
    seasonality_df = get_seasonality_components(model, forecast)

    return forecast_df, seasonality_df

def get_seasonality_components(model, forecast):
    """
    Extracts seasonality and holiday components from the Prophet model's full forecast.
    """
    seasonality_data = forecast[['ds', 'holidays', 'weekly', 'yearly']].rename(columns={'ds': 'date'})
    seasonality_data['date'] = seasonality_data['date'].dt.strftime('%Y-%m-%d')
    
    return seasonality_data
