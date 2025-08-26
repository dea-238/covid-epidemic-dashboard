import React, { useState, useMemo, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, BarChart, Bar, ReferenceLine, ComposedChart
} from "recharts";
import { ShieldCheck, TrendingUp, Users, Activity, Calendar, HelpCircle, Hospital, Sun, Moon } from 'lucide-react';


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
  const [activeTab, setActiveTab] = useState('overview');
  const [dataLoaded, setDataLoaded] = useState(false);

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
    try {
      const response = await fetch(`${API_BASE}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
      const data = await response.json();
      onSuccess(data);
    } catch (error) {
      console.error(`Failed to fetch from ${endpoint}:`, error);
      alert(`Error: ${error.message}`);
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
    fetchData(`ingest/${dataSource}`, { country }, 'main', (data) => {
      setDates(data.dates);
      setCases(data.cases);
      setDeaths(data.deaths || []);
      setDataLoaded(true);
    });
  }

  const runForecast = () => {
    if (!dataLoaded) return;
    fetchData('forecast', { dates, cases, horizon: 90, country_name: country }, 'tab', (data) => {
      const forecastData = data.forecast_dates.map((d, i) => ({
        date: d, mean: data.forecast_mean[i],
        lower: data.lower_95[i], upper: data.upper_95[i],
      }));
      setForecast(forecastData);
      setSeasonality(data.seasonality);
    });
  };

  const runRt = () => {
    if (!dataLoaded) return;
    fetchData('rt', { dates, cases }, 'tab', (data) => {
      setRtSeries(data.dates.map((d, i) => ({ date: d, rt: data.rt[i] })));
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

  // Effect to automatically fetch data for tabs when they are opened
  useEffect(() => {
    if (!dataLoaded) return; // Don't fetch if no base data is loaded

    if (activeTab === 'overview' && !forecast) {
      runForecast();
      runRt();
    } else if (activeTab === 'masks' && !interventionImpact) {
      analyzeMasks();
    } else if (activeTab === 'seasonality' && !seasonality) {
      runForecast();
    }
  }, [activeTab, dataLoaded]);
  
  const renderContent = () => {
    if (!dataLoaded) {
        return <div className="text-center p-10 text-gray-500">Please load data for a country to begin exploring.</div>;
    }
    if (loading.tab) {
        return <div className="text-center p-10 text-gray-500">Calculating...</div>;
    }

    switch (activeTab) {
      case 'overview':
        return <OverviewTab chartData={chartData} forecast={forecast} rtSeries={rtSeries} />;
      case 'masks':
        return <MasksTab data={interventionImpact} />;
      case 'seasonality':
        return <SeasonalityTab data={seasonality} />;
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

// --- UI Components ---

const Header = () => (
  <header className="text-center mb-6">
    <h1 className="text-4xl font-bold text-blue-600">Epidemic Explorer for Kids</h1>
    <p className="text-gray-600 mt-2">Learn how we can fight germs together! 🦸‍♀️🦸‍♂️</p>
  </header>
);

const Controls = ({ dataSource, setDataSource, country, setCountry, onLoad, loading }) => (
  <div className="bg-white p-4 rounded-lg shadow-md mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
    <select value={dataSource} onChange={e => setDataSource(e.target.value)} className="w-full p-2 border rounded-md bg-gray-50">
      <option value="jhu">JHU Data</option>
      <option value="who">WHO Data</option>
    </select>
    <input value={country} onChange={e => setCountry(e.target.value)} placeholder="Enter a country" className="w-full p-2 border rounded-md col-span-1 md:col-span-2" />
    <button onClick={onLoad} disabled={loading} className="w-full bg-blue-500 text-white p-2 rounded-md font-semibold hover:bg-blue-700 transition duration-300 disabled:bg-gray-300">
      {loading ? 'Fetching Germs...' : 'Load Data'}
    </button>
  </div>
);

const SummaryGrid = ({ totalCases, avg7Cases, totalDeaths, doublingTime, recentRt }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <SummaryCard icon={<Users className="text-blue-500"/>} title="Total Cases" value={totalCases.toLocaleString()} subtitle={`7-day avg: ${avg7Cases.toLocaleString()}`} />
    <SummaryCard icon={<Activity className="text-red-500"/>} title="Total Deaths" value={totalDeaths.toLocaleString()} />
    <SummaryCard icon={<TrendingUp className="text-green-500"/>} title="Doubling Time" value={`${doublingTime} days`} subtitle="How fast it spreads" />
    <SummaryCard icon={<ShieldCheck className="text-yellow-500"/>} title="Rₜ Number" value={recentRt ? Number(recentRt).toFixed(2) : "N/A"} subtitle="1 person infects..." />
  </div>
);

const SummaryCard = ({ icon, title, value, subtitle }) => (
    <div className="bg-white p-4 rounded-lg shadow-md flex items-center">
        <div className="mr-4 text-3xl">{icon}</div>
        <div>
            <div className="text-sm text-gray-500">{title}</div>
            <div className="text-2xl font-bold">{value}</div>
            {subtitle && <div className="text-xs text-gray-400">{subtitle}</div>}
        </div>
    </div>
);

const Tabs = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: <TrendingUp/> },
    { id: 'masks', label: 'The Mask Effect', icon: <ShieldCheck/> },
    { id: 'seasonality', label: 'Seasons & Holidays', icon: <Calendar/> },
    { id: 'preparedness', label: 'Be a Hero!', icon: <HelpCircle/> }
  ];

  return (
    <div className="flex border-b border-gray-200">
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors duration-200 ${
            activeTab === tab.id
              ? 'border-b-2 border-blue-500 text-blue-600 bg-white rounded-t-lg'
              : 'text-gray-500 hover:text-blue-600'
          }`}
        >
          {tab.icon} {tab.label}
        </button>
      ))}
    </div>
  );
};

// --- Tab Content Components ---

const OverviewTab = ({ chartData, forecast, rtSeries }) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div className="lg:col-span-2">
      <h3 className="font-bold mb-2 text-lg">Daily Cases and Future Forecast</h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={[...chartData, ...(forecast || []).map(f => ({ date: f.date, cases: null }))]}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="cases" fill="#8884d8" name="Cases" />
          {forecast && (
            <Line type="monotone" dataKey="mean" name="Forecast" stroke="#ff7300" dot={false} data={forecast} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <div>
      <h3 className="font-bold mb-2 text-lg">Spread Speed (Rₜ)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={rtSeries || []}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 'auto']} />
          <Tooltip />
          <ReferenceLine y={1} label="Control Line" stroke="red" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="rt" name="Rₜ" stroke="#82ca9d" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const MasksTab = ({ data }) => (
    <div>
        <h3 className="font-bold text-lg mb-2">How Masks Can Be Superheroes!</h3>
        <p className="text-sm text-gray-600 mb-4">Masks are like shields that help stop germs from spreading. This chart shows the real cases compared to how many there might have been if everyone wore masks.</p>
        {data ? (
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Actual Cases" stroke="#8884d8" dot={false} />
                    <Line type="monotone" dataKey="With Masks" stroke="#82ca9d" dot={false} strokeWidth={2} />
                </LineChart>
            </ResponsiveContainer>
        ) : <div className="text-center p-8 text-gray-500">This chart will appear once the analysis is complete.</div>}
    </div>
);

const SeasonalityTab = ({ data }) => (
    <div>
        <h3 className="font-bold text-lg mb-2">Do Germs Like Certain Weather or Holidays?</h3>
        <p className="text-sm text-gray-600 mb-4">Sometimes, more people get sick during cold seasons or after big holiday gatherings. This chart shows those patterns.</p>
        {data ? (
            <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="holidays" name="Holiday Effect" fill="#ffc658" />
                    <Line type="monotone" dataKey="weekly" name="Weekly Pattern" stroke="#8884d8" dot={false} />
                    <Line type="monotone" dataKey="yearly" name="Yearly Pattern" stroke="#82ca9d" dot={false} />
                </ComposedChart>
            </ResponsiveContainer>
        ) : <div className="text-center p-8 text-gray-500">This chart will appear once the forecast is calculated.</div>}
    </div>
);

const PreparednessTab = () => (
    <div>
        <h3 className="font-bold text-lg mb-2">Be a Health Hero!</h3>
        <p className="text-sm text-gray-600 mb-4">If a new bug comes to town, here’s how you can be a superhero and keep everyone safe:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard icon={<Hospital className="text-red-500"/>} title="Help Our Hospitals">
                When many people get sick, hospitals get very busy. By staying healthy, we help doctors and nurses take care of the sickest people.
            </InfoCard>
            <InfoCard icon={<ShieldCheck className="text-green-500"/>} title="Your Superhero Toolkit">
                <ul className="list-disc list-inside text-sm space-y-1">
                    <li><strong>Wash Hands:</strong> Use soap and water like you're washing away super-villains!</li>
                    <li><strong>Wear a Mask:</strong> It's your shield against invisible germs.</li>
                    <li><strong>Keep Your Distance:</strong> Give everyone their own "superhero space".</li>
                    <li><strong>Stay Home if Sick:</strong> Rest up and keep your germs from traveling.</li>
                </ul>
            </InfoCard>
        </div>
    </div>
);

const InfoCard = ({ icon, title, children }) => (
    <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center mb-2">
            <div className="text-2xl mr-3">{icon}</div>
            <h4 className="font-bold">{title}</h4>
        </div>
        <div className="text-sm text-gray-700">{children}</div>
    </div>
);
