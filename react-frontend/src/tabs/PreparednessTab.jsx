import React from 'react';
import { Hospital, ShieldCheck } from 'lucide-react';

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

export default PreparednessTab;