import React, { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar
} from 'recharts';

const HospitalizationTab = ({ data, onLoad, rtSeries, cases, dates }) => {
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Only fetch data if it hasn't been fetched yet and there's no error
        if (!data && !error) {
            setIsLoading(true);
            onLoad().catch(err => {
                // Set the error state if the fetch fails
                setError(err.message);
            }).finally(() => {
                setIsLoading(false);
            });
        }
    }, [data, onLoad, error]);

    const combinedData = useMemo(() => {
        if (!rtSeries || !cases || !dates) return [];
        return dates.map((date, i) => ({
            date,
            rt: rtSeries[i]?.rt,
            cases: cases[i]
        }));
    }, [rtSeries, cases, dates]);

    if (isLoading) {
        return <div className="text-center p-8 text-gray-500">Loading hospitalization data...</div>;
    }

    if (error && error.includes("No hospitalization data found")) {
        return <div className="text-center p-8 text-gray-500">No hospitalization data is available for this country.</div>;
    }
    
    if (error) {
        return <div className="text-center p-8 text-red-500">An error occurred: {error}</div>;
    }

    return (
        <div>
            <h3 className="font-bold text-lg mb-2">Hospitalization & Preparedness</h3>
            <p className="text-sm text-gray-600 mb-4">
                This section provides insights into the healthcare system's capacity and the epidemic's severity.
            </p>
            {data ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-semibold mb-2">Hospitalization Rate</h4>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="hospitalizations" name="Hospitalized" stroke="#8884d8" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div>
                        <h4 className="font-semibold mb-2">ICU Occupancy</h4>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="icu" name="ICU" stroke="#82ca9d" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="lg:col-span-2">
                         <h4 className="font-semibold mb-2">Reproduction Rate (Rt) vs. Cases</h4>
                        <ResponsiveContainer width="100%" height={300}>
                            <ComposedChart data={combinedData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                                <Tooltip />
                                <Legend />
                                <Bar yAxisId="left" dataKey="cases" fill="#8884d8" name="Cases" />
                                <Line yAxisId="right" type="monotone" dataKey="rt" name="Rt" stroke="#82ca9d" dot={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            ) : (
                <div className="text-center p-8 text-gray-500">Preparing to load data...</div>
            )}
        </div>
    );
};

export default HospitalizationTab;