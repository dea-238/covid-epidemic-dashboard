import pandas as pd

def get_jhu_data(country: str) -> pd.DataFrame:
    """
    Fetches and processes time series data from the JHU CSSE COVID-19 repository.
    """
    base_url = "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/"
    
    def process_jhu_df(url: str, country: str) -> pd.Series:
        df = pd.read_csv(url)
        country_df = df[df['Country/Region'] == country]
        if country_df.empty:
            return None
        # Sum up provinces/states to get a single national number
        series = country_df.drop(columns=['Province/State', 'Country/Region', 'Lat', 'Long']).sum()
        series.index = pd.to_datetime(series.index)
        return series

    confirmed_series = process_jhu_df(f"{base_url}time_series_covid19_confirmed_global.csv", country)
    deaths_series = process_jhu_df(f"{base_url}time_series_covid19_deaths_global.csv", country)

    if confirmed_series is None or deaths_series is None:
        return pd.DataFrame() # Return empty dataframe if country not found

    # Convert cumulative totals to daily new cases/deaths
    daily_cases = confirmed_series.diff().fillna(0).clip(lower=0)
    daily_deaths = deaths_series.diff().fillna(0).clip(lower=0)

    result_df = pd.DataFrame({
        'date': daily_cases.index,
        'cases': daily_cases.values,
        'deaths': daily_deaths.values
    }).reset_index(drop=True)
    
    return result_df

def get_who_data(country: str) -> pd.DataFrame:
    """
    Fetches and processes data from the WHO's official COVID-19 dataset.
    """
    url = "https://covid19.who.int/WHO-COVID-19-global-data.csv"
    df = pd.read_csv(url, parse_dates=['Date_reported'])
    
    country_df = df[df['Country'] == country].copy()
    
    if country_df.empty:
        return pd.DataFrame()

    country_df = country_df.rename(columns={
        'Date_reported': 'date',
        'New_cases': 'cases',
        'New_deaths': 'deaths'
    })
    
    return country_df[['date', 'cases', 'deaths']].sort_values('date').reset_index(drop=True)
