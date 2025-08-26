# Epidemic Management System — COVID-19 Time Series & SEIR

This starter kit gives you:
- **FastAPI service** for:
  - Univariate case forecasting (SARIMAX / Auto-ARIMA-lite)
  - **Rₜ estimation** (simple Cori-style with rolling smoothing)
  - **SEIR simulation** (deterministic ODE)
  - **WHO & JHU data ingestion** (country-level)
- **Streamlit dashboard** to upload CSVs or fetch official datasets, visualize metrics, run forecasts, estimate Rₜ, and simulate SEIR scenarios.
- **React + Vite frontend** scaffold (optional) with interventions builder and charts (Recharts).

## Quickstart (backend + streamlit)
```bash
cd epidemic-management-system
python -m venv .venv
# mac/linux
source .venv/bin/activate
# windows
# .venv\Scripts\activate

pip install -r requirements.txt

# start API
uvicorn api.main:app --reload

# in another terminal
streamlit run app/streamlit_app.py
