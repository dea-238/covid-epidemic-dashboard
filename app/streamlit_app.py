import streamlit as st
import pandas as pd
import requests
import matplotlib.pyplot as plt

st.set_page_config(page_title="Epidemic Management System", layout="wide")

st.title("🦠 Epidemic Management System — COVID-19 (Starter)")

st.markdown(
    "Upload a daily **cases** CSV (`date,cases`), or fetch WHO/JHU data, then:\n"
    "- Visualize and smooth trends\n"
    "- Run **forecast**\n"
    "- Estimate **Rₜ**\n"
    "- Run **SEIR** simulations"
)

api_url = st.text_input("API Base URL", value="http://127.0.0.1:8000")

# -------- Data Source Loader ----------
st.divider()
st.subheader("Data Source Loader")

source = st.selectbox("Pick source", ["WHO (official)", "JHU-CSSE (archived)"])
colA, colB = st.columns(2)
with colA:
    country_name = st.text_input("Country name (e.g., India, United States)", value="India")
with colB:
    iso2 = st.text_input("ISO2 (optional, WHO only)", value="")

df = None

if st.button("Fetch from source"):
    try:
        if source.startswith("WHO"):
            payload = {"country": country_name} if iso2.strip()=="" else {"iso2": iso2.strip().upper()}
            r = requests.post(f"{api_url}/ingest/who", json=payload, timeout=60)
        else:
            payload = {"country": country_name, "kind": "confirmed"}
            r = requests.post(f"{api_url}/ingest/jhu", json=payload, timeout=60)
        r.raise_for_status()
        res = r.json()
        df = pd.DataFrame({
            "date": pd.to_datetime(res["dates"]),
            "cases": res["cases"],
            "deaths": res["deaths"],
        }).sort_values("date")
        st.success(f"Loaded {len(df)} rows from {res.get('source','unknown')}")
        st.dataframe(df.tail(20))
        st.download_button("Download CSV", df.to_csv(index=False).encode("utf-8"), file_name=f"{source.split()[0].lower()}_{country_name.replace(' ','_').lower()}.csv", mime="text/csv")
    except Exception as e:
        st.exception(e)

st.divider()
st.subheader("Upload CSV (date,cases)")
uploaded = st.file_uploader("Upload CSV", type=["csv"])
if uploaded:
    df = pd.read_csv(uploaded)

if df is not None:
    if "date" not in df.columns or "cases" not in df.columns:
        st.error("CSV must have columns: date, cases")
    else:
        df['date'] = pd.to_datetime(df['date'])
        df = df.sort_values('date')

        st.subheader("Raw & Smoothed Cases")
        w = st.slider("Smoothing window (days)", 3, 21, 7, step=2)
        df['smooth'] = df['cases'].rolling(w, min_periods=1, center=True).mean()

        fig = plt.figure()
        plt.plot(df['date'], df['cases'], label="Cases")
        plt.plot(df['date'], df['smooth'], label=f"Smoothed ({w}d)")
        plt.xlabel("Date"); plt.ylabel("Daily Cases"); plt.legend(); plt.tight_layout()
        st.pyplot(fig)

        st.divider()
        st.subheader("Forecast")
        horizon = st.slider("Horizon (days)", 7, 60, 14, step=1)

        if st.button("Run Forecast"):
            payload = {
                "dates": df['date'].dt.strftime("%Y-%m-%d").tolist(),
                "cases": df['cases'].astype(float).tolist(),
                "horizon": int(horizon),
            }
            try:
                r = requests.post(f"{api_url}/forecast", json=payload, timeout=60)
                r.raise_for_status()
                res = r.json()
                fc = pd.DataFrame({
                    "date": pd.to_datetime(res["forecast_dates"]),
                    "mean": res["forecast_mean"],
                    "lower_80": res["lower_80"],
                    "upper_80": res["upper_80"],
                    "lower_95": res["lower_95"],
                    "upper_95": res["upper_95"],
                })
                fig2 = plt.figure()
                plt.plot(df['date'], df['cases'], label="Cases (history)")
                plt.plot(fc['date'], fc['mean'], label="Forecast")
                plt.fill_between(fc['date'], fc['lower_80'], fc['upper_80'], alpha=0.2, label="80%")
                plt.fill_between(fc['date'], fc['lower_95'], fc['upper_95'], alpha=0.1, label="95%")
                plt.xlabel("Date"); plt.ylabel("Daily Cases"); plt.legend(); plt.tight_layout()
                st.pyplot(fig2)
                st.dataframe(fc)
            except Exception as e:
                st.exception(e)

        st.divider()
        st.subheader("Rₜ Estimation")
        serial_interval = st.number_input("Serial interval (days)", min_value=1.0, max_value=10.0, value=4.0, step=0.5)
        window = st.slider("Smoothing window (days)", 3, 28, 7, step=1)

        if st.button("Estimate Rₜ"):
            payload = {
                "dates": df['date'].dt.strftime("%Y-%m-%d").tolist(),
                "cases": df['cases'].astype(float).tolist(),
                "serial_interval": float(serial_interval),
                "window": int(window),
            }
            try:
                r = requests.post(f"{api_url}/rt", json=payload, timeout=60)
                r.raise_for_status()
                res = r.json()
                rt = pd.DataFrame({
                    "date": pd.to_datetime(res["dates"]),
                    "R_t": res["rt"],
                    "R_t_low": res["rt_low"],
                    "R_t_high": res["rt_high"],
                })
                fig3 = plt.figure()
                plt.plot(rt['date'], rt['R_t'], label="Rₜ")
                plt.fill_between(rt['date'], rt['R_t_low'], rt['R_t_high'], alpha=0.2, label="CI")
                plt.axhline(1.0, linestyle="--")
                plt.xlabel("Date"); plt.ylabel("Rₜ"); plt.legend(); plt.tight_layout()
                st.pyplot(fig3)
                st.dataframe(rt)
            except Exception as e:
                st.exception(e)

st.divider()
st.subheader("SEIR Simulation")

col1, col2 = st.columns(2)
with col1:
    N = st.number_input("Population (N)", min_value=1, value=10000000, step=1000)
    E0 = st.number_input("Initial Exposed (E0)", min_value=0, value=100, step=10)
    I0 = st.number_input("Initial Infected (I0)", min_value=0, value=50, step=10)
    R0 = st.number_input("Initial Removed (R0)", min_value=0, value=0, step=10)
with col2:
    beta = st.number_input("β (contact rate)", min_value=0.0001, value=0.32, step=0.01, format="%.4f")
    sigma = st.number_input("σ = 1/incubation", min_value=0.0001, value=1/5.2, step=0.01, format="%.4f")
    gamma = st.number_input("γ = 1/infectious duration", min_value=0.0001, value=1/7.0, step=0.01, format="%.4f")
days = st.slider("Days", 30, 365, 180)

if st.button("Run SEIR Simulation"):
    payload = {
        "population": int(N),
        "initial_exposed": int(E0),
        "initial_infected": int(I0),
        "initial_removed": int(R0),
        "beta": float(beta),
        "sigma": float(sigma),
        "gamma": float(gamma),
        "days": int(days),
    }
    try:
        r = requests.post(f"{api_url}/seir_simulate", json=payload, timeout=60)
        r.raise_for_status()
        res = r.json()
        sim = pd.DataFrame({
            "date": pd.to_datetime(res["date"]),
            "S": res["S"],
            "E": res["E"],
            "I": res["I"],
            "R": res["R"],
            "new_cases_proxy": res["new_cases_proxy"],
        })
        fig4 = plt.figure()
        plt.plot(sim['date'], sim['S'], label="S")
        plt.plot(sim['date'], sim['E'], label="E")
        plt.plot(sim['date'], sim['I'], label="I")
        plt.plot(sim['date'], sim['R'], label="R")
        plt.xlabel("Date"); plt.ylabel("People"); plt.legend(); plt.tight_layout()
        st.pyplot(fig4)

        fig5 = plt.figure()
        plt.plot(sim['date'], sim['new_cases_proxy'], label="New Cases (proxy)")
        plt.xlabel("Date"); plt.ylabel("Daily new (proxy)"); plt.legend(); plt.tight_layout()
        st.pyplot(fig5)

        st.dataframe(sim)
    except Exception as e:
        st.exception(e)
