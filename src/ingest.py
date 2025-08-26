# api/ingest.py
import pandas as pd
from fastapi import APIRouter, Query

router = APIRouter()

@router.get("/jhu")
def get_jhu_data(country: str = Query(..., description="Country name e.g. India")):
    url_confirmed = (
        "https://raw.githubusercontent.com/CSSEGISandData/"
        "COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/"
        "time_series_covid19_confirmed_global.csv"
    )
    url_deaths = (
        "https://raw.githubusercontent.com/CSSEGISandData/"
        "COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/"
        "time_series_covid19_deaths_global.csv"
    )

    confirmed = pd.read_csv(url_confirmed)
    deaths = pd.read_csv(url_deaths)

    # Filter for country
    confirmed_country = confirmed[confirmed["Country/Region"] == country].drop(columns=["Lat","Long","Province/State"])
    deaths_country = deaths[deaths["Country/Region"] == country].drop(columns=["Lat","Long","Province/State"])

    # Sum across provinces if multiple rows exist
    confirmed_series = confirmed_country.groupby("Country/Region").sum().T
    deaths_series = deaths_country.groupby("Country/Region").sum().T

    # Convert index to datetime
    confirmed_series.index = pd.to_datetime(confirmed_series.index)
    deaths_series.index = pd.to_datetime(deaths_series.index)

    return {
        "dates": confirmed_series.index.strftime("%Y-%m-%d").tolist(),
        "confirmed": confirmed_series[country].tolist(),
        "deaths": deaths_series[country].tolist(),
    }
