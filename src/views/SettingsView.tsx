import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { FormsManagerSection } from './settings/FormsManagerSection';

interface Props {
  onBack: () => void;
}

export function SettingsView({ onBack }: Props) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="sticky top-0 z-40 bg-[#f5f5f5]/80 backdrop-blur-md px-6 py-8 flex items-center gap-4 border-b border-gray-200/50 mb-6">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Settings</h1>
      </div>
      <div className="p-6 space-y-12 pb-32">
        <FormsManagerSection />
      </div>
    </div>
  );
}
