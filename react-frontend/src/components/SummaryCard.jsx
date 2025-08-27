import React from 'react';

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

export default SummaryCard;