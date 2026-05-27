import React from 'react';
import { 
  ChevronLeft, 
  User as UserIcon, 
  Grid, 
  Sparkles, 
  BarChart2, 
  LayoutDashboard, 
  Gauge, 
  CheckCircle, 
  Car, 
  FileText, 
  ShieldAlert, 
  Phone, 
  MessageCircle,
  Users,
  Flag,
  MessageSquare,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Customer, Note } from '../types';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator';
import { MenuButton } from '../components/MenuButton';
import { SubButton } from '../components/SubButton';
import { SegmentedControl } from '../components/SegmentedControl';
import { ChipSelect } from '../components/ChipSelect';
import { LeadSourceChips } from '../components/LeadSourceChips';
import { CustomerInfoSection } from './profile/CustomerInfoSection';
import { InsuranceSection } from './profile/InsuranceSection';
import { NewVehicleSection } from './profile/NewVehicleSection';
import { TradeInSection } from './profile/TradeInSection';
import { GoalsSection } from './profile/GoalsSection';
import { TimelineNotesSection } from './profile/TimelineNotesSection';

interface Props {
  currentCustomer: Customer;
  saveStatus: 'idle' | 'saving' | 'synced' | 'error';
  isDirty: boolean;
  notes: Note[];
  newNote: string;
  activeMenu: string | null;
  isGeneratingPacket: boolean;
  isGeneratingSoldPacket: boolean;
  isEstimatingTradeValue: boolean;
  testDriveError: string | null;
  soldError: string | null;
  valuationError: string | null;
  onBack: () => void;
  onUpdateCustomer: (updates: Partial<Customer>) => void;
  onNewNoteChange: (note: string) => void;
  onAddNote: () => void;
  onActiveMenuChange: (menu: string | null) => void;
  onChat: () => void;
  onTestDrive: () => void;
  onSold: () => void;
  onTradeEstimate: (
    input: { 
      vin: string; 
      year: string; 
      make: string; 
      model: string; 
      trim: string; 
      mileage: string; 
    },
    options?: { skipCache?: boolean }
  ) => void;
  onReschedule: (customerId: string, date: string, reason: string) => void;
}

export function CustomerProfileView({
  currentCustomer,
  saveStatus,
  isDirty,
  notes,
  newNote,
  activeMenu,
  isGeneratingPacket,
  isGeneratingSoldPacket,
  isEstimatingTradeValue,
  testDriveError,
  soldError,
  valuationError,
  onBack,
  onUpdateCustomer,
  onNewNoteChange,
  onAddNote,
  onActiveMenuChange,
  onChat,
  onTestDrive,
  onSold,
  onReschedule,
  onTradeEstimate
}: Props) {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Sticky Header with Save Status */}
      <div className="sticky top-0 z-40 bg-[#f5f5f5]/80 backdrop-blur-md px-6 py-8 flex items-center justify-between border-b border-gray-200/50 mb-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="space-y-0.5">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {currentCustomer.firstName || currentCustomer.lastName ? `${currentCustomer.firstName} ${currentCustomer.middleInitial ? currentCustomer.middleInitial + ' ' : ''}${currentCustomer.lastName}`.trim() : 'Untitled'}
            </h1>
            <div className="flex items-center gap-2">
              <SaveStatusIndicator status={saveStatus} isDirty={isDirty} />
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-12 pb-32">
        <div className="px-2">
          <div className="card p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest w-24 shrink-0">Status</span>
              <SegmentedControl
                value={currentCustomer.status}
                options={[
                  { value: 'lead', label: 'Unsold', activeClass: 'bg-blue-600 text-white' },
                  { value: 'sold', label: 'Sold', activeClass: 'bg-emerald-600 text-white' },
                  { value: 'inactive', label: 'Inactive', activeClass: 'bg-gray-500 text-white' },
                ]}
                onChange={(v) => onUpdateCustomer({ status: v })}
              />
            </div>
            <div className="flex flex-wrap items-start gap-3">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest w-24 shrink-0 pt-1">Lead Source</span>
              <div className="flex-1 min-w-0">
                <LeadSourceChips
                  value={currentCustomer.leadSourceType}
                  onChange={(v) => onUpdateCustomer({ leadSourceType: v })}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-start gap-3">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest w-24 shrink-0 pt-1">Contact</span>
              <div className="flex-1 min-w-0">
                <ChipSelect
                  value={currentCustomer.contactChannel}
                  options={[
                    { value: 'text', label: 'Text' },
                    { value: 'crm-text', label: 'CRM Text' },
                    { value: 'email', label: 'Email' },
                    { value: 'snapchat', label: 'Snapchat' },
                    { value: 'facebook', label: 'Facebook' },
                  ]}
                  onChange={(v) => onUpdateCustomer({ contactChannel: v })}
                  allowClear
                />
              </div>
            </div>
          </div>
        </div>
        <CustomerInfoSection customer={currentCustomer} onChange={onUpdateCustomer} />
        <InsuranceSection customer={currentCustomer} onChange={onUpdateCustomer} />
        <NewVehicleSection customer={currentCustomer} onChange={onUpdateCustomer} />
        <TradeInSection 
          customer={currentCustomer} 
          onChange={onUpdateCustomer} 
          onTradeEstimate={onTradeEstimate}
          isEstimatingTradeValue={isEstimatingTradeValue}
          valuationError={valuationError}
        />
        <GoalsSection customer={currentCustomer} onChange={onUpdateCustomer} />
        <TimelineNotesSection 
          customer={currentCustomer}
          notes={notes}
          newNote={newNote}
          onNewNoteChange={onNewNoteChange}
          onAddNote={onAddNote}
          onChange={onUpdateCustomer}
          onReschedule={onReschedule}
        />
      </div>

      <AnimatePresence>
        {activeMenu && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onActiveMenuChange(null)}
            className="fixed inset-0 z-40 bg-black/5"
          />
        )}
      </AnimatePresence>

      <motion.div 
        animate={{ height: activeMenu ? '180px' : '90px' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 md:left-64 bg-white border-t border-gray-200 z-50 flex flex-col overflow-hidden"
      >
        {/* Main Buttons */}
        <div className="px-6 py-4 flex items-center justify-around gap-4 h-[90px] shrink-0 translate-y-0">
          <MenuButton 
            icon={<Grid size={24} />} 
            label="App" 
            active={activeMenu === 'app'} 
            onClick={() => onActiveMenuChange(activeMenu === 'app' ? null : 'app')} 
          />
          <MenuButton 
            icon={<Sparkles size={24} />} 
            label="Ai" 
            active={activeMenu === 'ai'} 
            onClick={() => onActiveMenuChange(activeMenu === 'ai' ? null : 'ai')} 
          />
          <MenuButton 
            icon={<BarChart2 size={24} />} 
            label="Insights" 
            active={activeMenu === 'insights'} 
            onClick={() => onActiveMenuChange(activeMenu === 'insights' ? null : 'insights')} 
          />
          <MenuButton 
            icon={<Users size={24} />} 
            label="Customer" 
            active={activeMenu === 'customer'} 
            onClick={() => onActiveMenuChange(activeMenu === 'customer' ? null : 'customer')} 
          />
        </div>

        {/* Sub Buttons Area */}
        <div className="flex-1 bg-gray-50/50 border-t border-gray-100 flex items-center justify-around px-8">
          {activeMenu === 'app' && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex justify-around w-full"
            >
              <SubButton icon={<LayoutDashboard size={20} />} label="Dashboard" />
              <SubButton icon={<Users size={20} />} label="Customers" />
              <SubButton icon={<Flag size={20} />} label="Leads" />
            </motion.div>
          )}
          {activeMenu === 'ai' && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex justify-around w-full"
            >
              <SubButton 
                icon={<MessageSquare size={20} />} 
                label="Chat" 
                onClick={onChat}
              />
              <SubButton 
                icon={isGeneratingPacket 
                  ? <Loader2 size={20} className="animate-spin" /> 
                  : <Gauge size={20} />
                } 
                label="Test Drive" 
                onClick={isGeneratingPacket ? undefined : onTestDrive}
                disabled={!currentCustomer.id || isGeneratingPacket}
              />
              <SubButton 
                icon={isGeneratingSoldPacket 
                  ? <Loader2 size={20} className="animate-spin" /> 
                  : <CheckCircle size={20} />
                } 
                label="Sold" 
                onClick={isGeneratingSoldPacket ? undefined : onSold}
                disabled={!currentCustomer.id || isGeneratingSoldPacket}
              />
            </motion.div>
          )}
          {activeMenu === 'insights' && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex justify-around w-full"
            >
              <SubButton icon={<Car size={20} />} label="Vehicle Selector" />
              <SubButton icon={<FileText size={20} />} label="Summary" />
              <SubButton icon={<ShieldAlert size={20} />} label="Objections" />
            </motion.div>
          )}
          {activeMenu === 'customer' && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex justify-around w-full"
            >
              <SubButton icon={<UserIcon size={20} />} label="Profile" />
              <SubButton icon={<Phone size={20} />} label="Call" />
              <SubButton icon={<MessageCircle size={20} />} label="Text" />
            </motion.div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {testDriveError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-28 md:bottom-12 left-1/2 -translate-x-1/2 z-[60] px-6 py-2.5 bg-red-500 text-white text-sm font-bold rounded-full shadow-lg whitespace-nowrap max-w-[90vw]"
          >
            {testDriveError}
          </motion.div>
        )}
        {soldError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-40 md:bottom-24 left-1/2 -translate-x-1/2 z-[60] px-6 py-2.5 bg-red-500 text-white text-sm font-bold rounded-full shadow-lg whitespace-nowrap max-w-[90vw]"
          >
            {soldError}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
