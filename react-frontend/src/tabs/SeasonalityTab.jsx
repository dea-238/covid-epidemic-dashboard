import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SeasonalityTab = ({ data }) => (
    <div>
        <h3 className="font-bold text-lg mb-2">Do Germs Like Certain Weather or Holidays?</h3>
        <p className="text-sm text-gray-600 mb-4">Sometimes, more people get sick during cold seasons or after big holiday gatherings. This chart shows those patterns as identified by the forecasting model.</p>
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
        ) : <div className="text-center p-8 text-gray-500">This chart appears after the forecast is calculated on the Overview tab.</div>}
    </div>
);

export default SeasonalityTab;