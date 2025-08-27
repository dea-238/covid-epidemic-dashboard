import React, { useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const MasksTab = ({ data, onAnalyze }) => {
    useEffect(() => {
        if (!data) {
            onAnalyze();
        }
    }, [data, onAnalyze]);

    return (
        <div>
            <h3 className="font-bold text-lg mb-2">How Masks Can Be Superheroes!</h3>
            <p className="text-sm text-gray-600 mb-4">Masks are like shields that help stop germs from spreading. This chart shows the real cases compared to how many there might have been if everyone wore masks (assuming a 40% reduction in transmission).</p>
            {data ? (
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="Actual Cases" stroke="#8884d8" dot={false} />
                        <Line type="monotone" dataKey="With Masks" name="Cases with Masks" stroke="#82ca9d" dot={false} strokeWidth={2} />
                    </LineChart>
                </ResponsiveContainer>
            ) : <div className="text-center p-8 text-gray-500">Calculating the power of masks...</div>}
        </div>
    );
}

export default MasksTab;