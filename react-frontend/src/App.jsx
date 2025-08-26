import React, { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart, BarChart, Bar, ReferenceLine, ReferenceArea
} from "recharts";

/**
 * Full-featured Epidemic Dashboard App.jsx
 * Expects backend at API_BASE (default http://127.0.0.1:8000)
 *
 * - Data sources: sample / WHO / JHU
 * - Summary cards: totals, 7d avg, doubling time, recent R_t
 * - Plots: cases (line+bar), deaths, R_t, forecast (with CI)
 * - Interventions: add mask/lockdown intervals which create overlays and can be used in
 *   client-side SEIR time-varying simulation fallback.
 */

const API_BASE = "http://127.0.0.1:8000";

function isoDate(d) {
  // keep YYYY-MM-DD
  return d instanceof Date ? d.toISOString().slice(0, 10) : d;
}

function sumLast(arr, n) {
  if (!arr || arr.length === 0) return 0;
  return arr.slice(-n).reduce((s, x) => s + (x || 0), 0);
}

function computeDoublingTime(cases) {
  // approximate doubling time using growth rate over last 7 days
  if (!cases || cases.length < 8) return null;
  const recent = sumLast(cases, 7);
  const older = sumLast(cases, 14) - recent;
  if (older <= 0 || recent <= 0) return null;
  const r = recent / older; // ratio over 7 days
  const growthRatePerDay = Math.pow(r, 1 / 7) - 1;
  if (growthRatePerDay <= 0) return null;
  const doubling = Math.log(2) / Math.log(1 + growthRatePerDay);
  return doubling;
}

export default function App() {
  const [dataSource, setDataSource] = useState("sample"); // 'sample'|'who'|'jhu'
  const [country, setCountry] = useState("India");
  const [dates, setDates] = useState([]);
  const [cases, setCases] = useState([]);
  const [deaths, setDeaths] = useState([]);
  const [forecast, setForecast] = useState(null); // array of {date, mean, lower_80, upper_80, lower_95, upper_95}
  const [rtSeries, setRtSeries] = useState(null); // array of {date, rt, low, high}
  const [seir, setSeir] = useState(null);
  const [loading, setLoading] = useState(false);

  // interventions: {type: 'mask'|'lockdown', startDay: 10, duration: 30, effectiveness: 0.5}
  const [interventions, setInterventions] = useState([]);
  const [ivType, setIvType] = useState("mask");
  const [ivStart, setIvStart] = useState(14);
  const [ivDuration, setIvDuration] = useState(30);
  const [ivEff, setIvEff] = useState(0.5);

  const chartData = useMemo(() => {
    return dates.map((d, i) => ({
      date: d,
      cases: cases[i] || 0,
      deaths: deaths[i] || 0,
      forecast_mean: forecast ? (forecast.find(f => f.date === d)?.mean ?? null) : null
    }));
  }, [dates, cases, deaths, forecast]);

  // summary metrics
  const totalCases = useMemo(() => sumLast(cases, cases.length), [cases]);
  const totalDeaths = useMemo(() => sumLast(deaths, deaths.length), [deaths]);
  const avg7Cases = useMemo(() => Math.round(sumLast(cases, 7) / Math.min(7, cases.length) || 0), [cases]);
  const avg7Deaths = useMemo(() => Math.round(sumLast(deaths, 7) / Math.min(7, deaths.length) || 0), [deaths]);
  const doublingTime = useMemo(() => computeDoublingTime(cases), [cases]);
  const recentRt = useMemo(() => (rtSeries && rtSeries.length ? rtSeries.slice(-1)[0].rt : null), [rtSeries]);

  // ---------- data loading ----------
  async function loadSample() {
    // small built-in sample
    const sample = [
      ["2020-03-01",1],["2020-03-02",3],["2020-03-03",2],["2020-03-04",4],
      ["2020-03-05",8],["2020-03-06",12],["2020-03-07",15],["2020-03-08",20],
      ["2020-03-09",18],["2020-03-10",25]
    ];
    setDates(sample.map(s => s[0]));
    setCases(sample.map(s => s[1]));
    setDeaths(sample.map(() => 0));
    setForecast(null);
    setRtSeries(null);
    setSeir(null);
  }

  async function loadWho(countryOrIso) {
    setLoading(true);
    try {
      const payload = countryOrIso.length === 2 ? { iso2: countryOrIso } : { country: countryOrIso };
      const resp = await fetch(`${API_BASE}/ingest/who`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });
      const json = await resp.json();
      setDates(json.dates);
      setCases(json.cases);
      setDeaths(json.deaths || []);
      setForecast(null); setRtSeries(null); setSeir(null);
    } catch (e) {
      console.error(e); alert("WHO fetch failed: " + (e.message || e));
    } finally { setLoading(false); }
  }

  async function loadJhu(countryName) {
    setLoading(true);
    try {
      const payload = { country: countryName };
      const resp = await fetch(`${API_BASE}/ingest/jhu`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });
      const json = await resp.json();
      setDates(json.dates);
      setCases(json.cases);
      setDeaths(json.deaths || []);
      setForecast(null); setRtSeries(null); setSeir(null);
    } catch (e) {
      console.error(e); alert("JHU fetch failed: " + (e.message || e));
    } finally { setLoading(false); }
  }

  // ---------- modeling calls ----------
  async function runForecast(horizon = 14) {
    if (!dates.length || !cases.length) return alert("Load data first");
    setLoading(true);
    try {
      const payload = { dates, cases, horizon };
      const r = await fetch(`${API_BASE}/forecast`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });
      const j = await r.json();
      const arr = j.forecast_dates.map((d, i) => ({
        date: d, mean: j.forecast_mean[i],
        lower_80: j.lower_80[i], upper_80: j.upper_80[i],
        lower_95: j.lower_95[i], upper_95: j.upper_95[i]
      }));
      setForecast(arr);
    } catch (e) {
      console.error(e); alert("Forecast failed: " + (e.message || e));
    } finally { setLoading(false); }
  }

  async function runRt() {
    if (!dates.length || !cases.length) return alert("Load data first");
    setLoading(true);
    try {
      const payload = { dates, cases, serial_interval: 4.0, window: 7 };
      const r = await fetch(`${API_BASE}/rt`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(payload) });
      const j = await r.json();
      const arr = j.dates.map((d, i) => ({ date: d, rt: j.rt[i], low: j.rt_low[i], high: j.rt_high[i] }));
      setRtSeries(arr);
    } catch (e) {
      console.error(e); alert("R_t failed: " + (e.message || e));
    } finally { setLoading(false); }
  }

  // ---------- interventions ----------
  function addIntervention() {
    setInterventions(prev => [...prev, { type: ivType, startDay: Number(ivStart), duration: Number(ivDuration), effectiveness: Number(ivEff) }]);
  }

  function clearInterventions(){ setInterventions([]); }

  // run intervention scenario locally (Euler SEIR) using interventions as beta reductions
  function runInterventionScenarioLocal({ population = 1000000, days = 180, beta = 0.32, sigma = 1/5.2, gamma = 1/7 }) {
    // build beta schedule
    const schedule = Array(days + 1).fill(beta);
    interventions.forEach(iv => {
      const s = Math.max(0, iv.startDay);
      const e = Math.min(days, iv.startDay + iv.duration);
      for (let d = s; d <= e; d++) schedule[d] = schedule[d] * (1 - iv.effectiveness);
    });

    // initial conditions
    let S = population - 10 - 0 - 0;
    let E = 10;
    let I = 10;
    let R = 0;
    const out = [];
    for (let t = 0; t <= days; t++) {
      const beta_t = schedule[Math.min(t, schedule.length - 1)];
      const dS = -beta_t * S * I / population;
      const dE = beta_t * S * I / population - sigma * E;
      const dI = sigma * E - gamma * I;
      const dR = gamma * I;
      S += dS; E += dE; I += dI; R += dR;
      const new_cases = Math.max(0, sigma * E);
      out.push({ date: `day_${t}`, S, E, I, R, new_cases });
    }
    setSeir(out);
  }

  // ---------- helpers for overlays ----------
  // convert intervention to date-based overlay using earliest date as day 0
  function overlaysFromInterventions() {
    if (!dates.length) return [];
    const day0 = new Date(dates[0]);
    return interventions.map((iv, idx) => {
      const startDate = new Date(day0); startDate.setDate(startDate.getDate() + iv.startDay);
      const endDate = new Date(day0); endDate.setDate(endDate.getDate() + iv.startDay + iv.duration);
      return { ...iv, start: isoDate(startDate), end: isoDate(endDate), id: idx };
    });
  }

  // ---------- UI ----------
  return (
    <div style={{ padding: 20, fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Epidemic Management Dashboard</h1>
        <div style={{ color: "#666", fontSize: 12 }}>API: {API_BASE}</div>
      </header>

      {/* Top controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <select value={dataSource} onChange={e => setDataSource(e.target.value)}>
          <option value="sample">Sample</option>
          <option value="who">WHO</option>
          <option value="jhu">JHU</option>
        </select>

        <input value={country} onChange={e => setCountry(e.target.value)} placeholder="Country (e.g., India)" style={{ padding: 6 }} />

        <button onClick={async () => {
          if (dataSource === "sample") await loadSample();
          else if (dataSource === "who") await loadWho(country);
          else if (dataSource === "jhu") await loadJhu(country);
        }}>{loading ? "Loading..." : "Load Data"}</button>

        <button onClick={() => { runForecast(14); }}>Forecast 14d</button>
        <button onClick={() => { runRt(); }}>Estimate Rₜ</button>
        <button onClick={() => runInterventionScenarioLocal({ population: 10000000, days: 180, beta: 0.32 })}>Run Intervention Scenario (local)</button>
      </div>

      {/* summary cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8, width: 180 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Total cases</div>
          <div style={{ fontSize: 20, fontWeight: "600" }}>{totalCases}</div>
          <div style={{ fontSize: 12, color: "#666" }}>7d avg: {avg7Cases}</div>
        </div>
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8, width: 180 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Total deaths</div>
          <div style={{ fontSize: 20, fontWeight: "600" }}>{totalDeaths}</div>
          <div style={{ fontSize: 12, color: "#666" }}>7d avg: {avg7Deaths}</div>
        </div>
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8, width: 220 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Doubling time (days)</div>
          <div style={{ fontSize: 20, fontWeight: "600" }}>{doublingTime ? doublingTime.toFixed(1) : "N/A"}</div>
          <div style={{ fontSize: 12, color: "#666" }}>Recent Rₜ: {recentRt ? Number(recentRt).toFixed(2) : "N/A"}</div>
        </div>
      </div>

      {/* Charts row: Cases & forecast left, R_t right */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 2, padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
          <h3 style={{ marginTop: 0 }}>Cases (daily) — history & forecast</h3>
          <div style={{ height: 360 }}>
            <ResponsiveContainer>
              <LineChart data={[...chartData, ...(forecast || []).map(f => ({ date: f.date, cases: null }))]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="cases" barSize={0} />
                <Line type="monotone" dataKey="cases" name="Cases" stroke="#8884d8" dot={false} />
                {forecast && (
                  <>
                    <Line type="monotone" dataKey="mean" name="Forecast mean" stroke="#FF7300"
                          data={forecast.map(f => ({ date: f.date, mean: f.mean }))} dot={false} />
                    {/* draw 80% band as two areas */}
                    <AreaChart data={forecast}>
                      <Area dataKey="upper_80" stroke="none" fill="rgba(255,115,0,0.08)" />
                    </AreaChart>
                  </>
                )}
                {/* intervention overlays as vertical ReferenceArea */}
                {overlaysFromInterventions().map(iv => (
                  <ReferenceArea key={iv.id} x1={iv.start} x2={iv.end}
                                 strokeOpacity={0.1}
                                 fill={iv.type === "mask" ? "green" : "red"}
                                 fillOpacity={0.08}
                                 />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ flex: 1, padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
          <h3 style={{ marginTop: 0 }}>Rₜ</h3>
          <div style={{ height: 360 }}>
            <ResponsiveContainer>
              <LineChart data={rtSeries || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis domain={["auto", "auto"]} />
                <Tooltip />
                <Line type="monotone" dataKey="rt" stroke="#82ca9d" dot={false} />
                <ReferenceLine y={1} stroke="#333" strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Deaths chart */}
      <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8, marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Daily deaths</h3>
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="deaths" fill="#ff4d4f" />
              {/* overlays */}
              {overlaysFromInterventions().map(iv => (
                <ReferenceArea key={iv.id + "_d"} x1={iv.start} x2={iv.end}
                               strokeOpacity={0.1}
                               fill={iv.type === "mask" ? "green" : "red"}
                               fillOpacity={0.06} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Intervention builder */}
      <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Interventions (for overlays & scenario simulation)</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <select value={ivType} onChange={e => setIvType(e.target.value)}>
            <option value="mask">Mask mandate (multiplicative β reduction)</option>
            <option value="lockdown">Lockdown</option>
          </select>
          <input type="number" value={ivStart} onChange={e=>setIvStart(e.target.value)} style={{ width: 80 }} /> <span>start day</span>
          <input type="number" value={ivDuration} onChange={e=>setIvDuration(e.target.value)} style={{ width: 80 }} /> <span>duration (days)</span>
          <input type="number" value={ivEff} step="0.05" min="0" max="1" onChange={e=>setIvEff(e.target.value)} style={{ width: 80 }} /> <span>effectiveness</span>
          <button onClick={addIntervention}>Add</button>
          <button onClick={clearInterventions}>Clear</button>
        </div>
        <div>
          <strong>Planned interventions:</strong>
          <ul>
            {interventions.map((iv, i) => <li key={i}>{iv.type} start {iv.startDay} for {iv.duration} days — {Math.round(iv.effectiveness*100)}% effectiveness</li>)}
          </ul>
        </div>
      </div>

      {/* SEIR simulation result */}
      {seir && (
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8, marginTop: 12 }}>
          <h3 style={{ marginTop: 0 }}>SEIR simulation (intervention scenario)</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer>
              <AreaChart data={seir}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area dataKey="S" stackId="1" name="S" />
                <Area dataKey="E" stackId="1" name="E" />
                <Area dataKey="I" stackId="1" name="I" />
                <Area dataKey="R" stackId="1" name="R" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <footer style={{ marginTop: 16, color: "#666", fontSize: 13 }}>
        Notes: Forecasts are short-term. SEIR here is deterministic Euler fallback for intervention scenarios. For production-grade policy analysis, use server-side time-varying SEIR solver + calibration to mobility & hospitalization data.
      </footer>
    </div>
  );
}
