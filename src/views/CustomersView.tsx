import React, { useState, useEffect } from 'react';
import { Plus, Users, ChevronRight, Search, RotateCcw, ChevronDown, ChevronUp, SlidersHorizontal, X, ArrowUpRight, Bookmark } from 'lucide-react';
import { motion } from 'motion/react';
import { Customer } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { applyFilters, FilterCriteria, formatDateISO } from '../lib/customerSearch';
import { renderTemplate, getDefaultModelYear } from '../lib/templateRenderer';
import { CopyButton } from '../components/CopyButton';
import { TextedCheckbox } from '../components/TextedCheckbox';
import { ReminderKind } from '../lib/reminders/engine';

interface Props {
  customers: Customer[];
  notesByCustomer?: Record<string, string[]>;
  onNewCustomer: () => void;
  onEditCustomer: (customer: Customer) => void;
  onTexted: (customerId: string, when: Date, closedKinds: ReminderKind[]) => void;
  onReschedule?: (customerId: string, date: string, reason: string, mode?: 'defer' | 'add') => void;
  onAddNote?: (customerId: string, content: string) => Promise<void>;
}

const ALL_STATUS_OPTIONS: ('lead' | 'sold' | 'inactive')[] = ['lead', 'sold', 'inactive'];

const MAJOR_LEAD_SOURCES = [
  'walk-in', 'crm', 'vep', 'dealer-wizard', 'orphan',
  'referral', 'social', 'showroom', 'phone', 'web', 'other'
];

function getDateBeforeDays(days: number, refDate: Date = new Date()): string {
  const d = new Date(refDate);
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function CustomersView({ customers, notesByCustomer, onNewCustomer, onEditCustomer, onTexted }: Props) {
  const [template, setTemplate] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('todayTemplate') ?? '';
  });

  const [modelYear, setModelYear] = useState<string>(() => {
    if (typeof window === 'undefined') return getDefaultModelYear();
    return localStorage.getItem('latestModelYear') ?? getDefaultModelYear();
  });

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem('todayTemplate', template);
    }, 500);
    return () => clearTimeout(t);
  }, [template]);

  useEffect(() => {
    if (modelYear) localStorage.setItem('latestModelYear', modelYear);
  }, [modelYear]);

  const [showFilters, setShowFilters] = React.useState(true);
  const [showUnclassified, setShowUnclassified] = React.useState(false);
  const [pushSuccess, setPushSuccess] = React.useState(false);

  const handlePushToToday = () => {
    if (typeof window === 'undefined') return;
    const existingRaw = localStorage.getItem('todayPinnedIds');
    let existing: string[] = [];
    try {
      existing = existingRaw ? JSON.parse(existingRaw) : [];
      if (!Array.isArray(existing)) existing = [];
    } catch {
      existing = [];
    }
    const matchedIds = filteredCustomers.map(c => c.id).filter((id): id is string => !!id);
    const mergedSet = Array.from(new Set([...existing, ...matchedIds]));
    localStorage.setItem('todayPinnedIds', JSON.stringify(mergedSet));
    
    setPushSuccess(true);
    setTimeout(() => setPushSuccess(false), 2000);
  };

  interface SavedFilter {
    name: string;
    criteria: FilterCriteria & {
      _carAgePreset?: string;
      _purchasePreset?: string;
      _recencyPreset?: string;
      _carAgeMin?: number;
      _carAgeMax?: number;
      _purchasedWithinDaysMin?: number;
      _purchasedWithinDaysMax?: number;
    };
  }

  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('savedCustomerFilters');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [newFilterName, setNewFilterName] = useState('');
  const [activeFilterName, setActiveFilterName] = useState<string | null>(null);

  // Filter states
  const [recall, setRecall] = React.useState('');
  const [status, setStatus] = React.useState<('lead' | 'sold' | 'inactive')[]>([]);
  const [leadSourceType, setLeadSourceType] = React.useState<string[]>([]);
  const [vehicleScope, setVehicleScope] = React.useState<'owns' | 'wants' | 'either'>('either');
  const [makeInput, setMakeInput] = React.useState('');
  const [modelInput, setModelInput] = React.useState('');

  // Car Age presets & custom
  const [carAgePreset, setCarAgePreset] = React.useState<string>('any'); // 'any' | 'new' | 'mid' | 'old' | 'custom'
  const [carAgeMin, setCarAgeMin] = React.useState<number | undefined>(undefined);
  const [carAgeMax, setCarAgeMax] = React.useState<number | undefined>(undefined);

  // Time since purchase presets & custom
  const [purchasePreset, setPurchasePreset] = React.useState<string>('any'); // 'any' | '30d' | '90d' | '365d' | '1y+' | 'custom'
  const [purchasedWithinDaysMin, setPurchasedWithinDaysMin] = React.useState<number | undefined>(undefined);
  const [purchasedWithinDaysMax, setPurchasedWithinDaysMax] = React.useState<number | undefined>(undefined);

  // Recency presets & custom
  const [recencyField, setRecencyField] = React.useState<'lastContactedAt' | 'createdAt' | 'leadGeneratedDate'>('lastContactedAt');
  const [recencyPreset, setRecencyPreset] = React.useState<string>('any'); // 'any' | '7d' | '30d' | '90d' | '90d+' | 'custom'
  const [recencyMin, setRecencyMin] = React.useState<string>(''); // YYYY-MM-DD
  const [recencyMax, setRecencyMax] = React.useState<string>(''); // YYYY-MM-DD

  // Sort and initial organization
  const sortedCustomers = React.useMemo(() => {
    return [...customers].sort((a, b) => {
      const aTime = a.updatedAt?.seconds ?? a.createdAt?.seconds ?? Infinity;
      const bTime = b.updatedAt?.seconds ?? b.createdAt?.seconds ?? Infinity;
      return bTime - aTime;
    });
  }, [customers]);

  const resetFilters = () => {
    setRecall('');
    setStatus([]);
    setLeadSourceType([]);
    setVehicleScope('either');
    setMakeInput('');
    setModelInput('');
    setCarAgePreset('any');
    setCarAgeMin(undefined);
    setCarAgeMax(undefined);
    setPurchasePreset('any');
    setPurchasedWithinDaysMin(undefined);
    setPurchasedWithinDaysMax(undefined);
    setRecencyPreset('any');
    setRecencyMin('');
    setRecencyMax('');
    setActiveFilterName(null);
  };

  const isFiltered = React.useMemo(() => {
    return (
      !!recall.trim() ||
      status.length > 0 ||
      leadSourceType.length > 0 ||
      vehicleScope !== 'either' ||
      !!makeInput.trim() ||
      !!modelInput.trim() ||
      carAgePreset !== 'any' ||
      purchasePreset !== 'any' ||
      recencyPreset !== 'any'
    );
  }, [recall, status, leadSourceType, vehicleScope, makeInput, modelInput, carAgePreset, purchasePreset, recencyPreset]);

  // Construct search criteria
  const criteria = React.useMemo((): FilterCriteria => {
    // Car Age boundaries based on presets
    let finalAgeMin: number | undefined = undefined;
    let finalAgeMax: number | undefined = undefined;
    if (carAgePreset === 'new') {
      finalAgeMin = 0;
      finalAgeMax = 3;
    } else if (carAgePreset === 'mid') {
      finalAgeMin = 3;
      finalAgeMax = 7;
    } else if (carAgePreset === 'old') {
      finalAgeMin = 8;
      finalAgeMax = 100;
    } else if (carAgePreset === 'custom') {
      finalAgeMin = carAgeMin;
      finalAgeMax = carAgeMax;
    }

    // Purchase days boundaries based on presets
    let finalPurMin: number | undefined = undefined;
    let finalPurMax: number | undefined = undefined;
    if (purchasePreset === '30d') {
      finalPurMin = 0;
      finalPurMax = 30;
    } else if (purchasePreset === '90d') {
      finalPurMin = 30;
      finalPurMax = 90;
    } else if (purchasePreset === '365d') {
      finalPurMin = 90;
      finalPurMax = 365;
    } else if (purchasePreset === '1y+') {
      finalPurMin = 365;
      finalPurMax = 9999;
    } else if (purchasePreset === 'custom') {
      finalPurMin = purchasedWithinDaysMin;
      finalPurMax = purchasedWithinDaysMax;
    }

    // Recency Date limits
    let finalRecMin: string | undefined = undefined;
    let finalRecMax: string | undefined = undefined;
    const todayStr = formatDateISO(new Date());

    if (recencyPreset === '7d') {
      finalRecMin = getDateBeforeDays(7);
      finalRecMax = todayStr;
    } else if (recencyPreset === '30d') {
      finalRecMin = getDateBeforeDays(30);
      finalRecMax = getDateBeforeDays(7);
    } else if (recencyPreset === '90d') {
      finalRecMin = getDateBeforeDays(90);
      finalRecMax = getDateBeforeDays(30);
    } else if (recencyPreset === '90d+') {
      finalRecMin = undefined;
      finalRecMax = getDateBeforeDays(90);
    } else if (recencyPreset === 'custom') {
      finalRecMin = recencyMin || undefined;
      finalRecMax = recencyMax || undefined;
    }

    return {
      status: status.length > 0 ? status : undefined,
      leadSourceType: leadSourceType.length > 0 ? leadSourceType : undefined,
      vehicleScope,
      make: makeInput ? makeInput.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      model: modelInput ? modelInput.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      carAgeMin: finalAgeMin,
      carAgeMax: finalAgeMax,
      purchasedWithinDaysMin: finalPurMin,
      purchasedWithinDaysMax: finalPurMax,
      recencyField,
      recencyMin: finalRecMin,
      recencyMax: finalRecMax,
      recall: recall || undefined,
    };
  }, [
    status, leadSourceType, vehicleScope, makeInput, modelInput,
    carAgePreset, carAgeMin, carAgeMax,
    purchasePreset, purchasedWithinDaysMin, purchasedWithinDaysMax,
    recencyField, recencyPreset, recencyMin, recencyMax, recall
  ]);

  const handleSaveFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilterName.trim()) return;
    const name = newFilterName.trim();
    
    const newFilter = {
      name,
      criteria: {
        ...criteria,
        _carAgePreset: carAgePreset,
        _purchasePreset: purchasePreset,
        _recencyPreset: recencyPreset,
        _carAgeMin: carAgeMin,
        _carAgeMax: carAgeMax,
        _purchasedWithinDaysMin: purchasedWithinDaysMin,
        _purchasedWithinDaysMax: purchasedWithinDaysMax
      }
    };
    
    setSavedFilters(prev => {
      const next = prev.filter(f => f.name.toLowerCase() !== name.toLowerCase());
      const updated = [...next, newFilter];
      localStorage.setItem('savedCustomerFilters', JSON.stringify(updated));
      return updated;
    });
    
    setActiveFilterName(name);
    setNewFilterName('');
  };

  const handleApplySavedFilter = (sf: SavedFilter) => {
    const c = sf.criteria;
    setRecall(c.recall || '');
    setStatus(c.status || []);
    setLeadSourceType(c.leadSourceType || []);
    setVehicleScope(c.vehicleScope || 'either');
    setMakeInput(c.make ? c.make.join(', ') : '');
    setModelInput(c.model ? c.model.join(', ') : '');
    
    setCarAgePreset(c._carAgePreset || 'any');
    setCarAgeMin(c._carAgeMin);
    setCarAgeMax(c._carAgeMax);
    
    setPurchasePreset(c._purchasePreset || 'any');
    setPurchasedWithinDaysMin(c._purchasedWithinDaysMin);
    setPurchasedWithinDaysMax(c._purchasedWithinDaysMax);
    
    setRecencyField(c.recencyField || 'lastContactedAt');
    setRecencyPreset(c._recencyPreset || 'any');
    setRecencyMin(c.recencyMin || '');
    setRecencyMax(c.recencyMax || '');
    
    setActiveFilterName(sf.name);
  };

  const handleDeleteSavedFilter = (name: string) => {
    setSavedFilters(prev => {
      const next = prev.filter(f => f.name !== name);
      localStorage.setItem('savedCustomerFilters', JSON.stringify(next));
      return next;
    });
    if (activeFilterName === name) {
      setActiveFilterName(null);
    }
  };

  const { matched: filteredCustomers, unclassified: unclassifiedCustomers } = React.useMemo(() => {
    return applyFilters(sortedCustomers, criteria, new Date(), notesByCustomer);
  }, [sortedCustomers, criteria, notesByCustomer]);

  // Check if any vehicle facet is active to determine if unclassified applies
  const isVehicleFacetActive = React.useMemo(() => {
    return !!(criteria.make || criteria.model || criteria.carAgeMin !== undefined || criteria.carAgeMax !== undefined);
  }, [criteria]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Customers Book</h2>
          <p className="text-gray-500 text-sm">
            {isFiltered 
              ? `Showing ${filteredCustomers.length} results of ${customers.length} total.`
              : `All ${customers.length} clients.`}
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0 justify-end">
          {filteredCustomers.length > 0 && (
            <button
              onClick={handlePushToToday}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all shadow-sm active:scale-95 ${
                pushSuccess
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-100 border-amber-200 hover:bg-amber-200 text-amber-900'
              }`}
            >
              <ArrowUpRight size={16} />
              <span>{pushSuccess ? 'Pushed ✔' : `Push ${filteredCustomers.length} to Today`}</span>
            </button>
          )}

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
              showFilters 
                ? 'bg-gray-100 border-gray-300 text-gray-800' 
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal size={16} />
            <span>{showFilters ? 'Hide Filters' : 'Filter & Search'}</span>
          </button>

          <button 
            onClick={onNewCustomer}
            className="bg-gray-950 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-sm active:scale-95 transition-transform"
          >
            <Plus size={18} />
            <span className="font-semibold text-sm">New Customer</span>
          </button>
        </div>
      </header>

      {/* Outbound Template Bar */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Outbound Text Template</h3>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium">Current model year:</label>
            <input
              type="number"
              value={modelYear}
              onChange={(e) => setModelYear(e.target.value)}
              min={2000}
              max={2100}
              step={1}
              className="w-20 text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:border-gray-400"
            />
          </div>
        </div>
        <textarea
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          placeholder="Paste a template. Use [name], [trade model], [trade year], [vehicle model], [vehicle year], or [latest model year]."
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-lg p-3 focus:outline-none focus:border-gray-400 resize-y"
        />
        <p className="text-xs text-gray-400">
          Placeholders:{' '}
          <code className="bg-gray-50 px-1 py-0.5 rounded">[name]</code>{' '}
          <code className="bg-gray-50 px-1 py-0.5 rounded">[trade model]</code>{' '}
          <code className="bg-gray-50 px-1 py-0.5 rounded">[trade year]</code>{' '}
          <code className="bg-gray-50 px-1 py-0.5 rounded">[vehicle model]</code>{' '}
          <code className="bg-gray-50 px-1 py-0.5 rounded">[vehicle year]</code>{' '}
          <code className="bg-gray-50 px-1 py-0.5 rounded">[latest model year]</code>
        </p>
      </div>

      {/* Interactive Power Filter Panel */}
      {showFilters && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-6"
        >
          {/* Saved Smart Views */}
          <div className="bg-neutral-50 border border-gray-100 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Bookmark size={14} className="text-amber-700" />
                  Saved Smart Views
                </h4>
                <p className="text-[11px] text-gray-400 font-medium">Reopen a saved filter combination live against your current book.</p>
              </div>

              {/* Save Current Filter Form */}
              {isFiltered && (
                <form onSubmit={handleSaveFilter} className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Name this view..."
                    value={newFilterName}
                    onChange={(e) => setNewFilterName(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-gray-400 w-44"
                  />
                  <button
                    type="submit"
                    className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200 font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-all"
                  >
                    <span>Save View</span>
                  </button>
                </form>
              )}
            </div>

            {savedFilters.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No saved views yet. Configure some filters below and give them a name to save.</p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {savedFilters.map((sf, index) => {
                  const isActive = activeFilterName === sf.name;
                  return (
                    <div
                      key={index}
                      className={`inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                        isActive
                          ? 'bg-amber-250 border-amber-350 text-amber-950 font-bold shadow-xs'
                          : 'bg-white border-gray-200 hover:border-gray-300 text-gray-750 hover:bg-neutral-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleApplySavedFilter(sf)}
                        className="transition-colors text-left"
                      >
                        {sf.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedFilter(sf.name)}
                        className="p-0.5 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors shrink-0"
                        title={`Delete saved filter "${sf.name}"`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Main recall search */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Free-text recall (e.g. name, mail, phone, state, trade-makes, etc.)..."
                value={recall}
                onChange={(e) => setRecall(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-950 transition-shadow bg-gray-50/50"
              />
              {recall && (
                <button 
                  onClick={() => setRecall('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {isFiltered && (
              <button
                onClick={resetFilters}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors shrink-0"
              >
                <RotateCcw size={15} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {/* Status & Lead Source */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Status</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setStatus([])}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      status.length === 0
                        ? 'bg-gray-900 border-gray-900 text-white font-semibold'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    All
                  </button>
                  {ALL_STATUS_OPTIONS.map(st => {
                    const active = status.includes(st);
                    return (
                      <button
                        key={st}
                        onClick={() => {
                          if (active) {
                            setStatus(status.filter(x => x !== st));
                          } else {
                            setStatus([...status, st]);
                          }
                        }}
                        className={`text-xs capitalize px-2.5 py-1 rounded-full border transition-colors ${
                          active
                            ? 'bg-gray-950 border-gray-900 text-white font-semibold'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Lead Source</label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 border border-gray-50 rounded-lg">
                  <button
                    onClick={() => setLeadSourceType([])}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      leadSourceType.length === 0
                        ? 'bg-gray-900 border-gray-900 text-white font-semibold'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    All
                  </button>
                  {MAJOR_LEAD_SOURCES.map(source => {
                    const active = leadSourceType.includes(source);
                    return (
                      <button
                        key={source}
                        onClick={() => {
                          if (active) {
                            setLeadSourceType(leadSourceType.filter(x => x !== source));
                          } else {
                            setLeadSourceType([...leadSourceType, source]);
                          }
                        }}
                        className={`text-xs capitalize px-2.5 py-1 rounded-full border transition-colors ${
                          active
                            ? 'bg-gray-950 border-gray-900 text-white font-semibold'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {source.replace('-', ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Vehicle owned/wanted & make/model */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Vehicle Scope</label>
                <div className="grid grid-cols-3 gap-1 bg-gray-150 p-1 rounded-xl border border-gray-100">
                  {(['either', 'owns', 'wants'] as const).map(scope => (
                    <button
                      key={scope}
                      onClick={() => setVehicleScope(scope)}
                      className={`text-xs py-1.5 rounded-lg font-semibold capitalize transition-all ${
                        vehicleScope === scope
                          ? 'bg-white text-gray-950 shadow-sm'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {scope}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500">Make (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="Toyota, Ford"
                    value={makeInput}
                    onChange={(e) => setMakeInput(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-gray-900 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500">Model (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="RAV4, F150"
                    value={modelInput}
                    onChange={(e) => setModelInput(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-gray-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Age, Recency & Purchases */}
            <div className="space-y-4">
              {/* Car Age Facet */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Car Age</label>
                  {carAgePreset === 'custom' && (
                    <span className="text-[10px] text-gray-400 font-mono">Custom</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {([
                    { val: 'any', label: 'All' },
                    { val: 'new', label: '<3 yrs' },
                    { val: 'mid', label: '3-7 yrs' },
                    { val: 'old', label: '8+ yrs' },
                    { val: 'custom', label: 'Custom' }
                  ]).map(ch => (
                    <button
                      key={ch.val}
                      onClick={() => setCarAgePreset(ch.val)}
                      className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all ${
                        carAgePreset === ch.val
                          ? 'bg-gray-950 text-white border-gray-900 font-semibold'
                          : 'bg-white text-gray-600 border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
                {carAgePreset === 'custom' && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      placeholder="Min"
                      value={carAgeMin ?? ''}
                      onChange={(e) => setCarAgeMin(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-2 py-1 border border-gray-100 rounded text-xs"
                    />
                    <span className="text-xs text-gray-400">-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      value={carAgeMax ?? ''}
                      onChange={(e) => setCarAgeMax(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-2 py-1 border border-gray-100 rounded text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Purchase window & time-since */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Time Since Purchase</label>
                <div className="flex flex-wrap gap-1">
                  {([
                    { val: 'any', label: 'All' },
                    { val: '30d', label: '< 30d' },
                    { val: '90d', label: '30-90d' },
                    { val: '365d', label: '90-365d' },
                    { val: '1y+', label: '1yr+' },
                    { val: 'custom', label: 'Custom' }
                  ]).map(ch => (
                    <button
                      key={ch.val}
                      onClick={() => setPurchasePreset(ch.val)}
                      className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all ${
                        purchasePreset === ch.val
                          ? 'bg-gray-950 text-white border-gray-900 font-semibold'
                          : 'bg-white text-gray-600 border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
                {purchasePreset === 'custom' && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      placeholder="Min days"
                      value={purchasedWithinDaysMin ?? ''}
                      onChange={(e) => setPurchasedWithinDaysMin(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-2 py-1 border border-gray-100 rounded text-xs"
                    />
                    <span className="text-xs text-gray-400">-</span>
                    <input
                      type="number"
                      placeholder="Max days"
                      value={purchasedWithinDaysMax ?? ''}
                      onChange={(e) => setPurchasedWithinDaysMax(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-2 py-1 border border-gray-100 rounded text-xs"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recency Segment */}
          <div className="border-t border-gray-100 pt-6 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 shrink-0 col-span-1">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block">Recency Type</label>
                <div className="flex bg-gray-50 border border-gray-200 rounded-xl p-1 shrink-0">
                  {([
                    { val: 'lastContactedAt', label: 'Last Contacted' },
                    { val: 'createdAt', label: 'Date Added' },
                    { val: 'leadGeneratedDate', label: 'Lead Gen Date' }
                  ] as const).map(f => (
                    <button
                      key={f.val}
                      onClick={() => setRecencyField(f.val)}
                      className={`text-xs px-3 py-1 rounded-lg font-semibold transition-all ${
                        recencyField === f.val
                          ? 'bg-white text-gray-950 shadow-sm'
                          : 'text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 flex-1 select-none">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block">Recency Range</label>
                <div className="flex flex-wrap gap-1">
                  {([
                    { val: 'any', label: 'Any' },
                    { val: '7d', label: 'Under 7d' },
                    { val: '30d', label: '7-30d' },
                    { val: '90d', label: '30-90d' },
                    { val: '90d+', label: '90d+' },
                    { val: 'custom', label: 'Custom Range' }
                  ]).map(ch => (
                    <button
                      key={ch.val}
                      onClick={() => setRecencyPreset(ch.val)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                        recencyPreset === ch.val
                          ? 'bg-gray-950 text-white border-gray-900 font-semibold'
                          : 'bg-white text-gray-600 border-gray-100'
                      }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {recencyPreset === 'custom' && (
              <div className="flex items-center gap-3 pt-2 max-w-md">
                <div className="space-y-1 w-full">
                  <span className="text-[10px] uppercase font-bold text-gray-400">Start Date</span>
                  <input
                    type="date"
                    value={recencyMin}
                    onChange={(e) => setRecencyMin(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-100 rounded-lg text-xs"
                  />
                </div>
                <div className="space-y-1 w-full">
                  <span className="text-[10px] uppercase font-bold text-gray-400">End Date</span>
                  <input
                    type="date"
                    value={recencyMax}
                    onChange={(e) => setRecencyMax(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-100 rounded-lg text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Unclassified disclosure bar */}
      {isVehicleFacetActive && unclassifiedCustomers.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-4 text-amber-900 text-sm space-y-2">
          <button 
            type="button"
            onClick={() => setShowUnclassified(!showUnclassified)}
            className="flex items-center justify-between w-full font-medium"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span>Couldn't Classify ({unclassifiedCustomers.length})</span>
              <p className="text-[11px] text-amber-700 font-normal hidden sm:inline ml-2">Vehicles facets are active, but these customer files lack year/make/model data to safely match.</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-amber-800 font-semibold uppercase tracking-wider">
              <span>{showUnclassified ? 'Hide' : 'Show list'}</span>
              {showUnclassified ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </button>
          
          {showUnclassified && (
            <div className="pt-3 border-t border-amber-100/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {unclassifiedCustomers.map(c => (
                <div 
                  key={c.id} 
                  onClick={() => onEditCustomer(c)}
                  className="flex items-center justify-between bg-white/95 px-3 py-2 rounded-xl border border-amber-100 hover:bg-amber-50 cursor-pointer transition-colors"
                >
                  <span className="font-bold text-xs truncate text-amber-950">{c.firstName} {c.lastName}</span>
                  <span className="text-[9px] uppercase tracking-wider font-semibold text-gray-500 bg-gray-50 border border-gray-150 px-1.5 py-0.5 rounded-md">{c.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grid of customers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.length === 0 ? (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
              <Users className="text-gray-400" />
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-lg">No customers yet</p>
              <p className="text-gray-500 text-sm max-w-xs mx-auto">Start by adding your first customer profile.</p>
            </div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
              <Search className="text-gray-400 animate-pulse" />
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-lg">No matches</p>
              <p className="text-gray-500 text-sm max-w-xs mx-auto">No customers found matching current filters. Try resetting the criteria or modifying the bounds.</p>
            </div>
          </div>
        ) : (
          filteredCustomers.map((customer) => {
            const personalizedText = template.trim()
              ? renderTemplate(template, customer, modelYear)
              : '';

            return (
              <motion.div 
                layoutId={customer.id}
                key={customer.id} 
                onClick={() => onEditCustomer(customer)}
                className="card p-6 flex flex-col justify-between hover:shadow-md transition-shadow group cursor-pointer"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-lg leading-tight text-gray-900 group-hover:text-amber-955 transition-colors">
                      {customer.firstName} {customer.middleInitial ? customer.middleInitial + ' ' : ''}{customer.lastName}
                    </h3>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={customer.status} />
                      {customer.leadSourceType && (
                        <span className="text-[9px] uppercase tracking-wider text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full font-medium">
                          {customer.leadSourceType.replace('-', ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 space-y-1.5">
                    {customer.email && <p className="truncate" title={customer.email}>{customer.email}</p>}
                    {customer.phone && (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <span>{customer.phone}</span>
                        <CopyButton value={customer.phone} />
                      </div>
                    )}
                  </div>

                  {personalizedText && (
                    <div className="mt-3 bg-gray-50 border border-gray-100 rounded-lg p-3 flex items-start justify-between gap-3" onClick={(e) => e.stopPropagation()}>
                      <p className="text-xs text-gray-800 whitespace-pre-wrap flex-1 leading-normal font-sans">
                        {personalizedText}
                      </p>
                      <CopyButton 
                        value={personalizedText} 
                        label="Copy" 
                        className="bg-white border border-gray-200 shrink-0 shadow-xs"
                      />
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between gap-4">
                  <div onClick={(e) => e.stopPropagation()} className="bg-neutral-50 border border-gray-150 rounded-xl px-3 py-1.5 transition-colors">
                    <TextedCheckbox 
                      customerId={customer.id!}
                      closedKinds={['cadence']}
                      onTexted={onTexted}
                    />
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-gray-400 font-semibold uppercase tracking-wider group-hover:text-gray-700 transition-colors">
                    <span>View Profile</span>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
