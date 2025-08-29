import pandas as pd
import requests

def get_jhu_data(country: str) -> pd.DataFrame:
    """
    Fetches and processes time series data from the JHU CSSE COVID-19 repository.
    """
    base_url = "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/"
    
    def process_jhu_df(url: str, country: str) -> pd.Series:
        df = pd.read_csv(url)
        # Handle case-insensitivity and common names
        country_df = df[df['Country/Region'].str.lower() == country.lower()]
        if country_df.empty:
            # Add more aliases as needed
            country_aliases = {
                "united states": "us",
                "united kingdom": "uk"
            }
            country_df = df[df['Country/Region'].str.lower() == country_aliases.get(country.lower(), "")]
        
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
    Fetches and processes data from WHO and alternative sources.
    """
    # Try multiple WHO data sources
    sources = [
        _get_who_official_data,
        _get_who_github_data,
        _get_owid_who_data
    ]
    
    for source_func in sources:
        try:
            df = source_func(country)
            if not df.empty:
                return df
        except Exception as e:
            print(f"WHO source {source_func.__name__} failed for {country}: {e}")
            continue
    
    return pd.DataFrame()

def _get_who_official_data(country: str) -> pd.DataFrame:
    """Try WHO official CSV endpoint"""
    url = "https://covid19.who.int/WHO-COVID-19-global-data.csv"
    
    # Add headers to avoid 403 errors
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    
    from io import StringIO
    df = pd.read_csv(StringIO(response.text), parse_dates=['Date_reported'])
    
    # Handle different country name formats
    country_variations = _get_country_variations(country)
    
    country_df = None
    for variation in country_variations:
        temp_df = df[df['Country'].str.lower() == variation.lower()]
        if not temp_df.empty:
            country_df = temp_df
            break
    
    if country_df is None or country_df.empty:
        return pd.DataFrame()

    country_df = country_df.rename(columns={
        'Date_reported': 'date',
        'New_cases': 'cases',
        'New_deaths': 'deaths'
    })
    
    return country_df[['date', 'cases', 'deaths']].sort_values('date').reset_index(drop=True)

def _get_who_github_data(country: str) -> pd.DataFrame:
    """Try WHO data from GitHub mirror"""
    url = "https://raw.githubusercontent.com/datasets/covid-19/master/data/countries-aggregated.csv"
    
    df = pd.read_csv(url, parse_dates=['Date'])
    
    country_variations = _get_country_variations(country)
    
    country_df = None
    for variation in country_variations:
        temp_df = df[df['Country'].str.lower() == variation.lower()]
        if not temp_df.empty:
            country_df = temp_df
            break
    
    if country_df is None or country_df.empty:
        return pd.DataFrame()
    
    # Calculate daily new cases and deaths from cumulative
    country_df = country_df.sort_values('Date')
    country_df['cases'] = country_df['Confirmed'].diff().fillna(0).clip(lower=0)
    country_df['deaths'] = country_df['Deaths'].diff().fillna(0).clip(lower=0)
    
    return country_df[['Date', 'cases', 'deaths']].rename(columns={'Date': 'date'}).reset_index(drop=True)

def _get_owid_who_data(country: str) -> pd.DataFrame:
    """Get WHO-compatible data from Our World in Data"""
    url = "https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/owid-covid-data.csv"
    
    df = pd.read_csv(url, parse_dates=['date'])
    
    country_variations = _get_country_variations(country)
    
    country_df = None
    for variation in country_variations:
        temp_df = df[df['location'].str.lower() == variation.lower()]
        if not temp_df.empty:
            country_df = temp_df
            break
    
    if country_df is None or country_df.empty:
        return pd.DataFrame()
    
    # Use new_cases and new_deaths columns
    result_df = country_df[['date', 'new_cases', 'new_deaths']].copy()
    result_df = result_df.rename(columns={
        'new_cases': 'cases',
        'new_deaths': 'deaths'
    })
    
    # Fill NaN values with 0 and ensure non-negative
    result_df['cases'] = result_df['cases'].fillna(0).clip(lower=0)
    result_df['deaths'] = result_df['deaths'].fillna(0).clip(lower=0)
    
    return result_df.dropna(subset=['date']).sort_values('date').reset_index(drop=True)

def _get_country_variations(country: str) -> list:
    """Get different variations of country names"""
    variations = [
        country,
        country.title(),
        country.upper(),
        country.lower()
    ]
    
    # Add common country name mappings
    country_mappings = {
        'us': ['United States', 'USA', 'United States of America'],
        'usa': ['United States', 'US', 'United States of America'],
        'united states': ['US', 'USA', 'United States of America'],
        'uk': ['United Kingdom', 'Britain', 'Great Britain'],
        'britain': ['United Kingdom', 'UK', 'Great Britain'],
        'united kingdom': ['UK', 'Britain', 'Great Britain'],
        'germany': ['Deutschland'],
        'deutschland': ['Germany'],
        'south korea': ['Korea, South', 'Republic of Korea'],
        'north korea': ['Korea, North', 'Democratic People\'s Republic of Korea'],
        'russia': ['Russian Federation'],
        'iran': ['Iran, Islamic Republic of'],
        'syria': ['Syrian Arab Republic'],
        'venezuela': ['Venezuela, Bolivarian Republic of']
    }
    
    country_lower = country.lower()
    if country_lower in country_mappings:
        variations.extend(country_mappings[country_lower])
    
    return list(set(variations))  # Remove duplicates