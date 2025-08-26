from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta
import random

app = FastAPI()

# Add CORS so frontend can talk to backend
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # loosened for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Input models
class WHOQuery(BaseModel):
    country: str | None = None
    iso2: str | None = None

class JHUQuery(BaseModel):
    country: str

# Utility → fallback dummy data
def fallback_data():
    today = datetime.today()
    dates = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
    cases = [random.randint(50, 500) for _ in dates]
    deaths = [random.randint(0, 50) for _ in dates]
    return {"dates": dates, "cases": cases, "deaths": deaths}

# WHO ingestion
@app.post("/ingest/who")
def ingest_who(q: WHOQuery):
    try:
        # Replace this with your real loader
        if not q.country and not q.iso2:
            raise ValueError("Missing country or iso2")

        # Fake: simulate no data returned
        df = None  

        if df is None or len(df) == 0:
            raise ValueError("No WHO data found")

        # If real df → convert to JSON
        return {"dates": df["date"].tolist(),
                "cases": df["cases"].tolist(),
                "deaths": df["deaths"].tolist()}

    except Exception as e:
        print(f"WHO ingest failed: {e}")
        return fallback_data()

# JHU ingestion
@app.post("/ingest/jhu")
def ingest_jhu(q: JHUQuery):
    try:
        if not q.country:
            raise ValueError("Missing country")

        # Fake: simulate no data returned
        cases, deaths = None, None  

        if not cases or not deaths:
            raise ValueError("No JHU data found")

        # If real data → return normally
        return {"dates": list(cases.index.astype(str)),
                "cases": list(cases.values),
                "deaths": list(deaths.values)}

    except Exception as e:
        print(f"JHU ingest failed: {e}")
        return fallback_data()
