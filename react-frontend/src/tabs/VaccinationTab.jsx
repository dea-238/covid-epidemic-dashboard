import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar
} from 'recharts';

const VaccinationTab = ({ country }) => {
    const [vaccinationData, setVaccinationData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchVaccinationData = async () => {
            setLoading(true);
            setError(null);
            try {
                const formattedCountry = country.charAt(0).toUpperCase() + country.slice(1);
                const response = await fetch(`https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/vaccinations/country_data/${formattedCountry}.csv`);

                if (!response.ok) {
                    throw new Error('Vaccination data not available for this country.');
                }

                const csvText = await response.text();
                const rows = csvText.split('\n').slice(1);
                const data = rows.map(row => {
                    const [date, , , , daily_vaccinations, , people_fully_vaccinated] = row.split(',');
                    return {
                        date,
                        daily_vaccinations: parseInt(daily_vaccinations) || 0,
                        people_fully_vaccinated: parseInt(people_fully_vaccinated) || 0,
                    };
                }).filter(row => row.date);

                if (data.length === 0) {
                   throw new Error('No vaccination data could be parsed for this country.');
                }

                setVaccinationData(data);
            } catch (error) {
                console.error("Failed to fetch vaccination data:", error);
                setError(error.message);
                setVaccinationData(null);
            } finally {
                setLoading(false);
            }
        };

        if (country) {
            fetchVaccinationData();
        }
    }, [country]);

    if (loading) {
        return <div className="text-center p-8 text-gray-500">Loading vaccination data...</div>;
    }
    
    if (error) {
        return <div className="text-center p-8 text-gray-500">{error}</div>;
    }

    return (
        <div>
            <h3 className="font-bold text-lg mb-2">Vaccination Progress</h3>
            <p className="text-sm text-gray-600 mb-4">
                This section shows the progress of the vaccination campaign in the selected country. Data is sourced from Our World in Data.
            </p>
            {vaccinationData ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-semibold mb-2">Daily Vaccinations</h4>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={vaccinationData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="daily_vaccinations" name="Daily Vaccinations" fill="#8884d8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div>
                        <h4 className="font-semibold mb-2">Cumulative Vaccinations</h4>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={vaccinationData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="people_fully_vaccinated" name="Fully Vaccinated" stroke="#82ca9d" dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            ) : (
                <div className="text-center p-8 text-gray-500">No vaccination data available to display.</div>
            )}
        </div>
    );
};

export default VaccinationTab;