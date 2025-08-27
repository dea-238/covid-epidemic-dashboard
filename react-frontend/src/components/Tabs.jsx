import React from 'react';
import { TrendingUp, ShieldCheck, Calendar, HelpCircle, Hospital, Syringe } from 'lucide-react';

const Tabs = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: <TrendingUp/> },
    { id: 'masks', label: 'The Mask Effect', icon: <ShieldCheck/> },
    { id: 'seasonality', label: 'Seasons & Holidays', icon: <Calendar/> },
    { id: 'hospitalization', label: 'Hospitalization', icon: <Hospital/>},
    { id: 'vaccination', label: 'Vaccination', icon: <Syringe/>},
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

export default Tabs;