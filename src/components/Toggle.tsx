import React from 'react';
import { motion } from 'motion/react';

interface Props {
  active: boolean;
  onToggle: () => void;
}

export const Toggle = ({ active, onToggle }: Props) => (
  <button 
    onClick={onToggle}
    className={`relative w-12 h-6 rounded-full transition-colors ${active ? 'bg-gray-900' : 'bg-gray-200'}`}
  >
    <motion.div 
      animate={{ x: active ? 24 : 4 }}
      className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
    />
  </button>
);
