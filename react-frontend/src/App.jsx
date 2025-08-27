import React, { useState, useMemo, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Bar, ComposedChart, ReferenceLine
} from "recharts";
import { ShieldCheck, TrendingUp, Users, Activity, Calendar, HelpCircle, Hospital, Syringe } from 'lucide-react';
import Header from './components/Header';
import Controls from './components/Controls';
import SummaryGrid from './components/SummaryGrid';
import Tabs from './components/Tabs';
import OverviewTab from './tabs/OverviewTab';
import MasksTab from './tabs/MasksTab';
import SeasonalityTab from './tabs/SeasonalityTab';
import PreparednessTab from './tabs/PreparednessTab';
import HospitalizationTab from './tabs/HospitalizationTab';
import VaccinationTab from './tabs/VaccinationTab';

const API_BASE = "http://127.0.0.1:8000";

// --- Helper Functions ---
function sumLast(arr, n) {
  if (!arr || arr.length === 0) return 0;
  return arr.slice(-n).reduce((s, x) => s + (x || 0), 0);
}

function computeDoublingTime(cases) {
  if (!cases || cases.length < 14) return null;
  const recent = sumLast(cases, 7);
  const older = sumLast(cases.slice(0, -7), 7);
  if (older <= 0 || recent <= older) return "∞";
  const growthRate = (recent - older) / older;
  const dailyGrowth = Math.pow(1 + growthRate, 1/7) - 1;
  if (dailyGrowth <= 0) return "∞";
  return (Math.log(2) / dailyGrowth).toFixed(1);
}

// --- Main App Component ---
export default function App() {
  const [dataSource, setDataSource] = useState("jhu");
  const [country, setCountry] = useState("India");
  const [dates, setDates] = useState([]);
  const [cases, setCases] = useState([]);
  const [deaths, setDeaths] = useState([]);
  const [forecast, setForecast] = useState(null);
  const [rtSeries, setRtSeries] = useState(null);
  const [loading, setLoading] = useState({ main: false, tab: false });
  const [interventionImpact, setInterventionImpact] = useState(null);
  const [seasonality, setSeasonality] = useState(null);
  const [hospitalizationData, setHospitalizationData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [yAxisScale, setYAxisScale] = useState('linear');
  
  // FIX: Added error state management
  const [error, setError] = useState(null);
  
  // FIX: Added flags to prevent duplicate API calls
  const [apiCallFlags, setApiCallFlags] = useState({
    forecastRequested: false,
    rtRequested: false
  });

  // --- Memoized Calculations for Performance ---
  const chartData = useMemo(() => dates.map((d, i) => ({ date: d, cases: cases[i] || 0, deaths: deaths[i] || 0 })), [dates, cases, deaths]);
  const totalCases = useMemo(() => sumLast(cases, cases.length), [cases]);
  const totalDeaths = useMemo(() => sumLast(deaths, deaths.length), [deaths]);
  const avg7Cases = useMemo(() => Math.round(sumLast(cases, 7) / 7 || 0), [cases]);
  const doublingTime = useMemo(() => computeDoublingTime(cases), [cases]);
  const recentRt = useMemo(() => (rtSeries && rtSeries.length ? rtSeries[rtSeries.length - 1].rt : null), [rtSeries]);

  // --- API Calls ---
  async function fetchData(endpoint, payload, loaderKey, onSuccess) {
    setLoading(prev => ({ ...prev, [loaderKey]: true }));
    setError(null); // FIX: Clear previous errors
    try {
      const response = await fetch(`${API_BASE}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
          const err = await response.json();
          throw new Error(err.detail || `API Error: ${response.statusText}`);
      }
      const data = await response.json();
      onSuccess(data);
      return data; // FIX: Return the data for promise chaining
    } catch (error) {
      console.error(`Failed to fetch from ${endpoint}:`, error);
      setError(`Failed to load ${endpoint}: ${error.message}`); // FIX: Set user-friendly error
      throw error;
    } finally {
      setLoading(prev => ({ ...prev, [loaderKey]: false }));
    }
  }

  function loadData() {
    setDataLoaded(false);
    setForecast(null);
    setRtSeries(null);
    setInterventionImpact(null);
    setSeasonality(null);
    setHospitalizationData(null);
    setActiveTab('overview');
    setError(null); // FIX: Clear errors when loading new data
    
    // FIX: Reset API call flags
    setApiCallFlags({ forecastRequested: false, rtRequested: false });
    
    fetchData(`ingest/${dataSource}`, { country }, 'main', (data) => {
      setDates(data.dates);
      setCases(data.cases);
      setDeaths(data.deaths || []);
      setDataLoaded(true);
    }).catch(() => {
      // Error is already handled in fetchData, just ensure dataLoaded stays false
      setDataLoaded(false);
    });
  }

  const runForecast = () => {
    if (!dataLoaded || apiCallFlags.forecastRequested || forecast) return;
    
    // FIX: Set flag to prevent duplicate calls
    setApiCallFlags(prev => ({ ...prev, forecastRequested: true }));
    
    fetchData('forecast', { dates, cases, horizon: 90, country_name: country }, 'tab', (data) => {
      const forecastData = data.forecast_dates.map((d, i) => ({
        date: d, mean: data.forecast_mean[i],
        lower: data.lower_95[i], upper: data.upper_95[i],
      }));
      setForecast(forecastData);
      
      const seasonalityData = data.seasonality.ds.map((d, i) => ({
        date: d,
        holidays: data.seasonality.holidays?.[i] ?? 0,
        weekly: data.seasonality.weekly?.[i] ?? 0,
        yearly: data.seasonality.yearly?.[i] ?? 0,
      }));
      setSeasonality(seasonalityData);
    }).catch(() => {
      // FIX: Reset flag on error so user can retry
      setApiCallFlags(prev => ({ ...prev, forecastRequested: false }));
    });
  };

  const runRt = () => {
    if (!dataLoaded || apiCallFlags.rtRequested || rtSeries) return;
    
    // FIX: Set flag to prevent duplicate calls
    setApiCallFlags(prev => ({ ...prev, rtRequested: true }));
    
    fetchData('rt', { dates, cases }, 'tab', (data) => {
      setRtSeries(data.dates.map((d, i) => ({ date: d, rt: data.rt[i] })));
    }).catch(() => {
      // FIX: Reset flag on error so user can retry
      setApiCallFlags(prev => ({ ...prev, rtRequested: false }));
    });
  };

  const analyzeMasks = () => {
    if (!dataLoaded) return;
    fetchData('analyze_intervention', { dates, cases, effectiveness: 0.4 }, 'tab', (data) => {
      const impactData = data.dates.map((d, i) => ({
        date: d,
        'Actual Cases': data.original_cases[i],
        'With Masks': data.intervention_cases[i],
      }));
      setInterventionImpact(impactData);
    });
  };

  // FIX: Properly return the promise from fetchData with better error handling
  const loadHospitalizationData = () => {
      if(!dataLoaded) return Promise.resolve();
      
      return fetchData('hospitalizations', { country }, 'tab', (data) => {
          const hospData = data.dates.map((d, i) => ({
              date: d,
              hospitalizations: data.hospitalizations[i],
              icu: data.icu[i]
          }));
          setHospitalizationData(hospData);
      }).catch((error) => {
          // Handle 404 specifically for missing hospitalization data
          if (error.message.includes('No hospitalization data found')) {
              setHospitalizationData([]); // Set empty array to indicate no data available
              return Promise.resolve(); // Don't propagate the error
          }
          // For other errors, let them bubble up
          throw error;
      });
  }

  // FIX: Improved useEffect with better dependency management
  useEffect(() => {
    if (dataLoaded && activeTab === 'overview') {
      // Only run if we haven't already requested these and don't have the data
      if (!forecast && !apiCallFlags.forecastRequested) {
        runForecast();
      }
      if (!rtSeries && !apiCallFlags.rtRequested) {
        runRt();
      }
    }
  }, [dataLoaded, activeTab, forecast, rtSeries, apiCallFlags.forecastRequested, apiCallFlags.rtRequested]);
  
  const renderContent = () => {
    // FIX: Show error state if there's an error
    if (error) {
      return (
        <div className="text-center p-10">
          <div className="text-red-500 mb-4">⚠️ {error}</div>
          <button 
            onClick={loadData}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      );
    }
    
    if (!dataLoaded) {
        return <div className="text-center p-10 text-gray-500">Please load data for a country to begin exploring.</div>;
    }
    if (loading.tab) {
        return <div className="text-center p-10 text-gray-500">Calculating...</div>;
    }

    switch (activeTab) {
      case 'overview':
        return <OverviewTab chartData={chartData} forecast={forecast} yAxisScale={yAxisScale} setYAxisScale={setYAxisScale} />;
      case 'masks':
        return <MasksTab data={interventionImpact} onAnalyze={analyzeMasks} />;
      case 'seasonality':
        return <SeasonalityTab data={seasonality} />;
      case 'hospitalization':
          return <HospitalizationTab data={hospitalizationData} onLoad={loadHospitalizationData} rtSeries={rtSeries} cases={cases} dates={dates}/>;
      case 'vaccination':
          return <VaccinationTab country={country} />;
      case 'preparedness':
        return <PreparednessTab />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen font-sans text-gray-800">
      <div className="container mx-auto p-4">
        <Header />
        <Controls
          dataSource={dataSource} setDataSource={setDataSource}
          country={country} setCountry={setCountry}
          onLoad={loadData} loading={loading.main}
        />
        {dataLoaded && <SummaryGrid
          totalCases={totalCases} avg7Cases={avg7Cases}
          totalDeaths={totalDeaths} doublingTime={doublingTime} recentRt={recentRt}
        />}
        <Tabs activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="bg-white p-6 rounded-b-lg shadow-lg min-h-[400px]">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}