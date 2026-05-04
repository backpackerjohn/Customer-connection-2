import React from 'react';
import { 
  ChevronLeft, 
  User as UserIcon, 
  CreditCard, 
  CarFront, 
  Users, 
  Flag, 
  MessageSquare, 
  Plus, 
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
  MessageCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Customer, Note } from '../types';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator';
import { InputField } from '../components/InputField';
import { Toggle } from '../components/Toggle';
import { MenuButton } from '../components/MenuButton';
import { SubButton } from '../components/SubButton';

interface Props {
  currentCustomer: Customer;
  saveStatus: 'idle' | 'saving' | 'synced' | 'error';
  isDirty: boolean;
  notes: Note[];
  newNote: string;
  activeMenu: string | null;
  onBack: () => void;
  onUpdateCustomer: (updates: Partial<Customer>) => void;
  onNewNoteChange: (note: string) => void;
  onAddNote: () => void;
  onActiveMenuChange: (menu: string | null) => void;
  onChat: () => void;
}

export function CustomerProfileView({
  currentCustomer,
  saveStatus,
  isDirty,
  notes,
  newNote,
  activeMenu,
  onBack,
  onUpdateCustomer,
  onNewNoteChange,
  onAddNote,
  onActiveMenuChange,
  onChat
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
        {/* Card 1: Customer Info */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
              <UserIcon size={18} />
            </div>
            <h2 className="text-xl font-bold">Customer Info</h2>
          </div>
          <div className="card p-6 space-y-6">
            <div className="grid grid-cols-5 gap-4">
              <div className="col-span-2">
                <InputField 
                  label="First Name" 
                  value={currentCustomer.firstName} 
                  onChange={v => onUpdateCustomer({ firstName: v })} 
                />
              </div>
              <div className="col-span-1">
                <InputField 
                  label="M.I." 
                  value={currentCustomer.middleInitial || ''} 
                  onChange={v => onUpdateCustomer({ middleInitial: v })} 
                />
              </div>
              <div className="col-span-2">
                <InputField 
                  label="Last Name" 
                  value={currentCustomer.lastName} 
                  onChange={v => onUpdateCustomer({ lastName: v })} 
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField 
                label="Date of Birth" 
                type="date"
                value={currentCustomer.dob} 
                onChange={v => onUpdateCustomer({ dob: v })} 
              />
              <InputField 
                label="Phone" 
                type="tel"
                value={currentCustomer.phone} 
                onChange={v => onUpdateCustomer({ phone: v })} 
              />
            </div>
            <InputField 
              label="Email" 
              type="email"
              value={currentCustomer.email} 
              onChange={v => onUpdateCustomer({ email: v })} 
            />
            <div className="space-y-4 pt-4 border-t border-gray-50">
              <InputField 
                label="Street Address" 
                value={currentCustomer.address} 
                onChange={v => onUpdateCustomer({ address: v })} 
              />
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <InputField 
                    label="City" 
                    value={currentCustomer.city} 
                    onChange={v => onUpdateCustomer({ city: v })} 
                  />
                </div>
                <InputField 
                  label="State" 
                  value={currentCustomer.state} 
                  onChange={v => onUpdateCustomer({ state: v })} 
                />
                <InputField 
                  label="Zip" 
                  value={currentCustomer.zip} 
                  onChange={v => onUpdateCustomer({ zip: v })} 
                />
              </div>
            </div>
            <div className="space-y-4 pt-4 border-t border-gray-50">
              <InputField 
                label="Driver's License Number" 
                value={currentCustomer.dlNumber} 
                onChange={v => onUpdateCustomer({ dlNumber: v })} 
              />
              <div className="grid grid-cols-2 gap-4">
                <InputField 
                  label="DL State" 
                  value={currentCustomer.dlState} 
                  onChange={v => onUpdateCustomer({ dlState: v })} 
                />
                <InputField 
                  label="DL Expiration" 
                  type="date"
                  value={currentCustomer.dlExpiration} 
                  onChange={v => onUpdateCustomer({ dlExpiration: v })} 
                />
              </div>
            </div>
          </div>
        </section>

        {/* Card 2: Insurance */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
              <CreditCard size={18} />
            </div>
            <h2 className="text-xl font-bold">Insurance</h2>
          </div>
          <div className="card p-6 space-y-6">
            <InputField 
              label="Insurance Company" 
              value={currentCustomer.insuranceCompany} 
              onChange={v => onUpdateCustomer({ insuranceCompany: v })} 
            />
            <InputField 
              label="Agent Name" 
              value={currentCustomer.agentName} 
              onChange={v => onUpdateCustomer({ agentName: v })} 
            />
          </div>
        </section>

        {/* Card: New Vehicle */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
              <CarFront size={18} />
            </div>
            <h2 className="text-xl font-bold">New Vehicle</h2>
          </div>
          <div className="card p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <InputField 
                label="Stock #" 
                value={currentCustomer.vehicleStock} 
                onChange={v => onUpdateCustomer({ vehicleStock: v })} 
              />
              <InputField 
                label="Year" 
                value={currentCustomer.vehicleYear} 
                onChange={v => onUpdateCustomer({ vehicleYear: v })} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField 
                label="Make" 
                value={currentCustomer.vehicleMake} 
                onChange={v => onUpdateCustomer({ vehicleMake: v })} 
              />
              <InputField 
                label="Model" 
                value={currentCustomer.vehicleModel} 
                onChange={v => onUpdateCustomer({ vehicleModel: v })} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField 
                label="VIN" 
                value={currentCustomer.vehicleVin} 
                onChange={v => onUpdateCustomer({ vehicleVin: v })} 
              />
              <InputField 
                label="Miles" 
                value={currentCustomer.vehicleMiles} 
                onChange={v => onUpdateCustomer({ vehicleMiles: v })} 
              />
            </div>
          </div>
        </section>

        {/* Card 3: Trade-in */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
              <Users size={18} />
            </div>
            <h2 className="text-xl font-bold">Trade-in</h2>
          </div>
          <div className="card p-6 space-y-6">
            <div className="flex items-center justify-between py-2">
              <span className="font-semibold text-gray-700">Has trade-in?</span>
              <Toggle 
                active={currentCustomer.hasTradeIn} 
                onToggle={() => onUpdateCustomer({ hasTradeIn: !currentCustomer.hasTradeIn })} 
              />
            </div>

            {currentCustomer.hasTradeIn && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-6 pt-4 border-t border-gray-100 overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-4">
                  <InputField 
                    label="Year" 
                    value={currentCustomer.tradeYear} 
                    onChange={v => onUpdateCustomer({ tradeYear: v })} 
                  />
                  <InputField 
                    label="Make" 
                    value={currentCustomer.tradeMake} 
                    onChange={v => onUpdateCustomer({ tradeMake: v })} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <InputField 
                    label="Model" 
                    value={currentCustomer.tradeModel} 
                    onChange={v => onUpdateCustomer({ tradeModel: v })} 
                  />
                  <InputField 
                    label="Trim" 
                    value={currentCustomer.tradeTrim} 
                    onChange={v => onUpdateCustomer({ tradeTrim: v })} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <InputField 
                    label="Mileage" 
                    value={currentCustomer.tradeMileage} 
                    onChange={v => onUpdateCustomer({ tradeMileage: v })} 
                  />
                  <InputField 
                    label="VIN" 
                    value={currentCustomer.tradeVin} 
                    onChange={v => onUpdateCustomer({ tradeVin: v })} 
                  />
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between py-2">
                    <span className="font-semibold text-gray-700">Still owe on it?</span>
                    <Toggle 
                      active={currentCustomer.stillOwe} 
                      onToggle={() => onUpdateCustomer({ stillOwe: !currentCustomer.stillOwe })} 
                    />
                  </div>

                  {currentCustomer.stillOwe && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-6 overflow-hidden"
                    >
                      <InputField 
                        label="Lienholder" 
                        value={currentCustomer.lienholder} 
                        onChange={v => onUpdateCustomer({ lienholder: v })} 
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <InputField 
                          label="Payoff Amount" 
                          value={currentCustomer.payoffAmount} 
                          onChange={v => onUpdateCustomer({ payoffAmount: v })} 
                        />
                        <InputField 
                          label="Monthly Payment" 
                          value={currentCustomer.monthlyPayment} 
                          onChange={v => onUpdateCustomer({ monthlyPayment: v })} 
                        />
                      </div>
                      <InputField 
                        label="Months Remaining" 
                        value={currentCustomer.monthsRemaining} 
                        onChange={v => onUpdateCustomer({ monthsRemaining: v })} 
                      />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </section>

        {/* Card 4: Goals */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Flag size={18} />
            </div>
            <h2 className="text-xl font-bold">Goals</h2>
          </div>
          <div className="card p-6 space-y-6">
            <InputField 
              label="Monthly Payment Range" 
              placeholder="e.g. $400 - $500"
              value={currentCustomer.goalsMonthlyPayment} 
              onChange={v => onUpdateCustomer({ goalsMonthlyPayment: v })} 
            />
            <div className="grid grid-cols-2 gap-4">
              <InputField 
                label="Money Down" 
                placeholder="$"
                value={currentCustomer.goalsMoneyDown} 
                onChange={v => onUpdateCustomer({ goalsMoneyDown: v })} 
              />
              <InputField 
                label="Estimated Credit Score" 
                placeholder="e.g. 720"
                value={currentCustomer.goalsCreditScore} 
                onChange={v => onUpdateCustomer({ goalsCreditScore: v })} 
              />
            </div>
          </div>
        </section>

        {/* Card 5: Notes Card */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center text-pink-600">
              <MessageSquare size={18} />
            </div>
            <h2 className="text-xl font-bold">Timeline & Notes</h2>
          </div>
          
          <div className="card overflow-hidden">
            {/* Add Note Input */}
            <div className="p-4 bg-gray-50/50 border-b border-gray-100">
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Add a discovery note..."
                  className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-gray-900 outline-none transition-all"
                  value={newNote}
                  onChange={(e) => onNewNoteChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onAddNote()}
                />
                <button 
                  onClick={onAddNote}
                  disabled={!newNote.trim()}
                  className="bg-gray-900 text-white p-2 rounded-xl disabled:opacity-30 disabled:grayscale transition-all active:scale-95"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>

            {/* Notes Feed */}
            <div className="divide-y divide-gray-50 flex flex-col max-h-[400px] overflow-y-auto">
              {notes.length === 0 ? (
                <div className="p-12 text-center text-gray-400 space-y-2">
                  <MessageSquare size={24} className="mx-auto opacity-20" />
                  <p className="text-xs font-medium uppercase tracking-widest">No notes yet</p>
                </div>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="p-4 space-y-2 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${
                        note.type === 'ai' ? 'text-indigo-500' : 'text-gray-400'
                      }`}>
                        {note.type === 'ai' ? 'Ai Discovery' : 'Manual Entry'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {note.createdAt?.seconds ? new Date(note.createdAt.seconds * 1000).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Pending...'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed">{note.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
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
              <SubButton icon={<Gauge size={20} />} label="Test Drive" />
              <SubButton icon={<CheckCircle size={20} />} label="Sold" />
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
    </div>
  );
}
