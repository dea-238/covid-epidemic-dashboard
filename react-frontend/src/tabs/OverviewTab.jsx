import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const OverviewTab = ({ chartData, forecast, yAxisScale, setYAxisScale }) => (
    <div>
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Daily Cases and Future Forecast</h3>
            <div>
                <label htmlFor="y-axis-scale" className="mr-2 text-sm font-medium text-gray-700">Y-Axis Scale:</label>
                <select id="y-axis-scale" value={yAxisScale} onChange={(e) => setYAxisScale(e.target.value)} className="p-1 border rounded-md bg-gray-50 text-sm">
                    <option value="linear">Linear</option>
                    <option value="log">Logarithmic</option>
                </select>
            </div>
        </div>
        <p className="text-sm text-gray-600 mb-4">
            This chart shows the number of new COVID-19 cases reported each day. The bars represent the actual daily cases, while the orange line shows the forecasted trend for the next 90 days. You can switch the y-axis to a logarithmic scale to better visualize exponential growth.
        </p>
        <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis scale={yAxisScale === 'log' ? 'log' : 'linear'} domain={yAxisScale === 'log' ? [1, 'auto'] : [0, 'auto']} allowDataOverflow />
                <Tooltip />
                <Legend />
                <Bar dataKey="cases" fill="#8884d8" name="Daily Cases" />
                {forecast && (
                    <Line type="monotone" dataKey="mean" name="Forecast" stroke="#ff7300" dot={false} data={forecast} />
                )}
            </ComposedChart>
        </ResponsiveContainer>
    </div>
);

export default OverviewTab;