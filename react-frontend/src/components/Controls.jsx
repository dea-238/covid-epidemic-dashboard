import React from 'react';

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

export default Controls;