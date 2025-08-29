import streamlit as st
import pandas as pd
import numpy as np
import sys
import os

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.ingest import get_jhu_data, get_who_data
from src.rt import estimate_rt
from src.analysis import analyze_intervention_impact
from src.hospitalizations import get_hospitalization_data

st.set_page_config(
    page_title="Epidemic Explorer Dashboard",
    page_icon="🦠",
    layout="wide"
)

st.title("🦠 Epidemic Explorer Dashboard")
st.markdown("Analyze COVID-19 data, estimate reproduction numbers, and simulate interventions")

# Sidebar for data source selection
st.sidebar.header("Data Configuration")
data_source = st.sidebar.selectbox("Select Data Source", ["JHU CSSE", "WHO", "Upload CSV"])

if data_source in ["JHU CSSE", "WHO"]:
    country = st.sidebar.text_input("Country Name", value="US")
    
    if st.sidebar.button("Load Data"):
        with st.spinner("Loading data..."):
            try:
                if data_source == "JHU CSSE":
                    df = get_jhu_data(country)
                else:
                    df = get_who_data(country)
                
                if df.empty:
                    st.error(f"No data found for {country}")
                else:
                    st.session_state['data'] = df
                    st.success(f"Loaded {len(df)} records for {country}")
            except Exception as e:
                st.error(f"Error loading data: {e}")

elif data_source == "Upload CSV":
    uploaded_file = st.sidebar.file_uploader("Choose a CSV file", type="csv")
    if uploaded_file is not None:
        try:
            df = pd.read_csv(uploaded_file)
            df['date'] = pd.to_datetime(df['date'])
            st.session_state['data'] = df
            st.success(f"Uploaded {len(df)} records")
        except Exception as e:
            st.error(f"Error reading CSV: {e}")

# Main dashboard
if 'data' in st.session_state:
    df = st.session_state['data']
    
    # Display data overview
    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Total Records", len(df))
    with col2:
        st.metric("Date Range", f"{df['date'].min().date()} to {df['date'].max().date()}")
    with col3:
        st.metric("Total Cases", f"{df['cases'].sum():,.0f}")
    
    # Plot time series
    st.subheader("📈 Time Series Data")
    st.line_chart(df.set_index('date')['cases'])
    
    # R_t estimation
    st.subheader("🔬 Reproduction Number (R_t) Estimation")
    serial_interval = st.slider("Serial Interval (days)", 1.0, 10.0, 4.0, 0.5)
    window = st.slider("Smoothing Window (days)", 3, 14, 7)
    
    if st.button("Calculate R_t"):
        with st.spinner("Calculating R_t..."):
            try:
                rt_df = estimate_rt(df, serial_interval=serial_interval, window=window)
                st.line_chart(rt_df.set_index('date')['R_t'])
                
                # Show recent R_t value
                recent_rt = rt_df['R_t'].dropna().iloc[-1] if not rt_df['R_t'].dropna().empty else None
                if recent_rt:
                    color = "red" if recent_rt > 1 else "green"
                    st.markdown(f"**Most Recent R_t:** <span style='color:{color}'>{recent_rt:.2f}</span>", unsafe_allow_html=True)
            except Exception as e:
                st.error(f"Error calculating R_t: {e}")
    
    # Intervention analysis
    st.subheader("🛡️ Intervention Impact Analysis")
    effectiveness = st.slider("Intervention Effectiveness (%)", 0, 100, 30) / 100
    
    if st.button("Analyze Intervention"):
        with st.spinner("Analyzing intervention impact..."):
            try:
                result = analyze_intervention_impact(df, effectiveness)
                
                # Create comparison chart
                comparison_df = pd.DataFrame({
                    'date': pd.to_datetime(result['dates']),
                    'Original Cases': result['original_cases'],
                    'With Intervention': result['intervention_cases']
                })
                
                st.line_chart(comparison_df.set_index('date'))
                
                # Calculate impact metrics
                original_total = sum(result['original_cases'])
                intervention_total = sum(result['intervention_cases'])
                cases_prevented = original_total - intervention_total
                
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.metric("Cases Prevented", f"{cases_prevented:,.0f}")
                with col2:
                    st.metric("Reduction", f"{(cases_prevented/original_total)*100:.1f}%")
                with col3:
                    st.metric("Effectiveness", f"{effectiveness*100:.0f}%")
                    
            except Exception as e:
                st.error(f"Error analyzing intervention: {e}")
    
    # Hospitalization data (if available)
    if st.checkbox("Show Hospitalization Data"):
        if 'country' in locals():
            with st.spinner("Loading hospitalization data..."):
                try:
                    hosp_df = get_hospitalization_data(country)
                    if not hosp_df.empty:
                        st.subheader("🏥 Hospitalization Data")
                        
                        col1, col2 = st.columns(2)
                        with col1:
                            st.line_chart(hosp_df.set_index('date')['hospitalizations'])
                            st.caption("Hospital Occupancy")
                        with col2:
                            st.line_chart(hosp_df.set_index('date')['icu'])
                            st.caption("ICU Occupancy")
                    else:
                        st.warning("No hospitalization data available for this country")
                except Exception as e:
                    st.error(f"Error loading hospitalization data: {e}")

else:
    st.info("👈 Please select a data source and load data to begin analysis")

# Footer
st.markdown("---")
st.markdown("**Data Sources:** Johns Hopkins University CSSE, World Health Organization")
st.markdown("**Note:** This is an educational tool. For official health guidance, consult your local health authorities.")