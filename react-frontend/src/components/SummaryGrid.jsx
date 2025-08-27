import React from 'react';
import { Users, Activity, TrendingUp, ShieldCheck } from 'lucide-react';
import SummaryCard from './SummaryCard';

const SummaryGrid = ({ totalCases, avg7Cases, totalDeaths, doublingTime, recentRt }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <SummaryCard icon={<Users className="text-blue-500"/>} title="Total Cases" value={totalCases.toLocaleString()} subtitle={`7-day avg: ${avg7Cases.toLocaleString()}`} />
    <SummaryCard icon={<Activity className="text-red-500"/>} title="Total Deaths" value={totalDeaths.toLocaleString()} />
    <SummaryCard icon={<TrendingUp className="text-green-500"/>} title="Doubling Time" value={`${doublingTime} days`} subtitle="How fast it spreads" />
    <SummaryCard icon={<ShieldCheck className="text-yellow-500"/>} title="Rₜ Number" value={recentRt ? Number(recentRt).toFixed(2) : "N/A"} subtitle="1 person infects..." />
  </div>
);

export default SummaryGrid;