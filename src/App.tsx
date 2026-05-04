import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Users, 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  ChevronRight,
  ChevronLeft,
  User as UserIcon,
  MessageSquare, 
  Grid, 
  Camera, 
  Upload,
  CarFront, 
  CreditCard,
  Sparkles,
  BarChart2,
  Flag,
  FileText,
  ShieldAlert,
  Car,
  Phone,
  MessageCircle
} from 'lucide-react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  onSnapshot,
  updateDoc,
  doc
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { motion, AnimatePresence } from 'motion/react';

import { AIChatOverlay } from './components/AIChatOverlay';

// --- Types ---
interface Customer {
  id?: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  dob?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  dlNumber?: string;
  dlState?: string;
  dlExpiration?: string;
  vehicleStock?: string;
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleVin?: string;
  vehicleMiles?: string;
  insuranceCompany?: string;
  agentName?: string;
  hasTradeIn: boolean;
  tradeYear?: string;
  tradeMake?: string;
  tradeModel?: string;
  tradeTrim?: string;
  tradeMileage?: string;
  tradeVin?: string;
  stillOwe: boolean;
  lienholder?: string;
  payoffAmount?: string;
  monthlyPayment?: string;
  monthsRemaining?: string;
  goalsMonthlyPayment?: string;
  goalsMoneyDown?: string;
  goalsCreditScore?: string;
  status: 'active' | 'inactive' | 'lead';
  createdAt?: any;
  updatedAt?: any;
}

interface Note {
  id?: string;
  content: string;
  type: 'manual' | 'ai' | 'transcript';
  authorId: string;
  createdAt: any;
}

const emptyCustomer: Customer = {
  firstName: '',
  middleInitial: '',
  lastName: '',
  status: 'lead',
  hasTradeIn: false,
  stillOwe: false,
};

// --- Components ---

const LoginView = () => {
  const handleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f5f5f5]">
      <div className="w-full max-w-md text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Customer Connect</h1>
          <p className="text-gray-500">Manage your relationships with clarity and ease.</p>
        </div>
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 border border-gray-200 py-4 px-6 rounded-2xl font-medium shadow-sm active:scale-95 transition-transform"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'profile'>('dashboard');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currentCustomer, setCurrentCustomer] = useState<Customer>(emptyCustomer);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'synced' | 'error'>('idle');
  const [isDirty, setIsDirty] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [pendingAINotes, setPendingAINotes] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Auto-save effect
  useEffect(() => {
    const hasAnyData = Boolean(
      currentCustomer.firstName || currentCustomer.lastName || 
      currentCustomer.phone || currentCustomer.email || 
      currentCustomer.dlNumber || currentCustomer.vehicleVin ||
      currentCustomer.address || currentCustomer.insuranceCompany
    );

    if (!isDirty || !user || !hasAnyData) return;

    setSaveStatus('idle'); // Just changed, wait for debounce
    const timeoutId = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        let customerId = currentCustomer.id;

        if (customerId) {
          const customerRef = doc(db, 'customers', customerId);
          await updateDoc(customerRef, {
            ...currentCustomer,
            updatedAt: serverTimestamp()
          });
        } else {
          const docRef = await addDoc(collection(db, 'customers'), {
            ...currentCustomer,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          customerId = docRef.id;
          // Update current state with the new ID to prevent multiple creations
          setCurrentCustomer(prev => ({ ...prev, id: customerId }));

          // BUG 5 FIX: Flush pending notes for the new customer
          if (pendingAINotes.length > 0) {
            const notesBatch = pendingAINotes.map(noteContent => 
              addDoc(collection(db, 'customers', customerId!, 'notes'), {
                content: noteContent,
                type: 'ai',
                authorId: user.uid,
                createdAt: serverTimestamp()
              })
            );
            await Promise.all(notesBatch);
            setPendingAINotes([]);
          }
        }
        setSaveStatus('synced');
        setIsDirty(false);
      } catch (error) {
        setSaveStatus('error');
        handleFirestoreError(error, OperationType.WRITE, 'customers');
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [currentCustomer, isDirty, user, pendingAINotes]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'customers'),
      where('createdBy', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });

    return unsubscribe;
  }, [user]);

  // Fetch notes for current customer
  useEffect(() => {
    if (!user || !currentCustomer.id) {
      setNotes([]);
      return;
    }

    const q = query(
      collection(db, 'customers', currentCustomer.id, 'notes'),
      where('authorId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Note));
      // Sort by descending date
      setNotes(data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `customers/${currentCustomer.id}/notes`);
    });

    return unsubscribe;
  }, [user, currentCustomer.id]);

  const handleNewCustomer = () => {
    setCurrentCustomer(emptyCustomer);
    setSaveStatus('idle');
    setIsDirty(false);
    setView('profile');
  };

  const handleEditCustomer = (customer: Customer) => {
    setCurrentCustomer(customer);
    setSaveStatus('synced');
    setIsDirty(false);
    setView('profile');
  };

  const updateCustomer = (updates: Partial<Customer>) => {
    setCurrentCustomer(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
    setSaveStatus('idle');
  };

  const handleAddNote = async () => {
    if (!user || !currentCustomer.id || !newNote.trim()) return;

    try {
      await addDoc(collection(db, 'customers', currentCustomer.id, 'notes'), {
        content: newNote.trim(),
        type: 'manual',
        authorId: user.uid,
        createdAt: serverTimestamp()
      });
      setNewNote('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `customers/${currentCustomer.id}/notes`);
    }
  };

  const handleAIFieldsExtracted = (fields: any, notesSummary?: string) => {
    if (Object.keys(fields).length > 0) {
      updateCustomer(fields);
    }
    
    if (notesSummary && user) {
      if (currentCustomer.id) {
        // Customer exists, write immediately
        addDoc(collection(db, 'customers', currentCustomer.id, 'notes'), {
          content: notesSummary,
          type: 'ai',
          authorId: user.uid,
          createdAt: serverTimestamp()
        }).catch(err => handleFirestoreError(err, OperationType.WRITE, `customers/${currentCustomer.id}/notes`));
      } else {
        // BUG 5 FIX: Buffer the note for the pending customer
        setPendingAINotes(prev => [...prev, notesSummary]);
      }
    }
  };

  if (loading) return null;
  if (!user) return <LoginView />;

  return (
    <div className="min-h-screen bg-[#f5f5f5] pb-24 md:pb-0 md:pl-64">
      {/* Side Navigation (Desktop) */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 hidden md:flex flex-col p-6 space-y-8">
        <h1 className="text-2xl font-bold tracking-tight px-2">Connect</h1>
        <nav className="flex-1 space-y-2">
          <NavItem 
            icon={<LayoutDashboard size={20} />} 
            label="Dashboard" 
            active={view === 'dashboard'} 
            onClick={() => setView('dashboard')}
          />
          <NavItem icon={<Users size={20} />} label="Customers" />
          <NavItem icon={<Settings size={20} />} label="Settings" />
        </nav>
        <div className="pt-6 border-t border-gray-100">
          <button 
            onClick={() => signOut(auth)}
            className="flex items-center gap-3 text-gray-500 hover:text-red-500 px-2 py-2 transition-colors w-full"
          >
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      <AnimatePresence mode="wait">
        {view === 'dashboard' ? (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-6 max-w-5xl mx-auto space-y-8"
          >
            <header className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <p className="text-gray-500">You have {customers.length} total customers.</p>
              </div>
              <button 
                onClick={handleNewCustomer}
                className="bg-gray-900 text-white p-4 md:px-6 md:py-3 rounded-full md:rounded-2xl flex items-center gap-2 shadow-lg shadow-gray-900/20 active:scale-95 transition-transform"
              >
                <Plus size={20} />
                <span className="hidden md:inline font-semibold">New Customer</span>
              </button>
            </header>

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
              ) : (
                customers.map((customer) => (
                  <motion.div 
                    layoutId={customer.id}
                    key={customer.id} 
                    onClick={() => handleEditCustomer(customer)}
                    className="card p-6 flex flex-col justify-between hover:shadow-md transition-shadow group cursor-pointer"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <h3 className="font-bold text-lg leading-tight">
                          {customer.firstName} {customer.middleInitial ? customer.middleInitial + ' ' : ''}{customer.lastName}
                        </h3>
                        <StatusBadge status={customer.status} />
                      </div>
                      <div className="text-sm text-gray-500 space-y-1">
                        <p>{customer.email}</p>
                        <p>{customer.phone}</p>
                      </div>
                    </div>
                    <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-50">
                      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">View Profile</span>
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="profile"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="max-w-2xl mx-auto"
          >
            {/* Sticky Header with Save Status */}
            <div className="sticky top-0 z-40 bg-[#f5f5f5]/80 backdrop-blur-md px-6 py-8 flex items-center justify-between border-b border-gray-200/50 mb-6">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setView('dashboard')}
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
                        onChange={v => updateCustomer({ firstName: v })} 
                      />
                    </div>
                    <div className="col-span-1">
                      <InputField 
                        label="M.I." 
                        value={currentCustomer.middleInitial || ''} 
                        onChange={v => updateCustomer({ middleInitial: v })} 
                      />
                    </div>
                    <div className="col-span-2">
                      <InputField 
                        label="Last Name" 
                        value={currentCustomer.lastName} 
                        onChange={v => updateCustomer({ lastName: v })} 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField 
                      label="Date of Birth" 
                      type="date"
                      value={currentCustomer.dob} 
                      onChange={v => updateCustomer({ dob: v })} 
                    />
                    <InputField 
                      label="Phone" 
                      type="tel"
                      value={currentCustomer.phone} 
                      onChange={v => updateCustomer({ phone: v })} 
                    />
                  </div>
                  <InputField 
                    label="Email" 
                    type="email"
                    value={currentCustomer.email} 
                    onChange={v => updateCustomer({ email: v })} 
                  />
                  <div className="space-y-4 pt-4 border-t border-gray-50">
                    <InputField 
                      label="Street Address" 
                      value={currentCustomer.address} 
                      onChange={v => updateCustomer({ address: v })} 
                    />
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-1">
                        <InputField 
                          label="City" 
                          value={currentCustomer.city} 
                          onChange={v => updateCustomer({ city: v })} 
                        />
                      </div>
                      <InputField 
                        label="State" 
                        value={currentCustomer.state} 
                        onChange={v => updateCustomer({ state: v })} 
                      />
                      <InputField 
                        label="Zip" 
                        value={currentCustomer.zip} 
                        onChange={v => updateCustomer({ zip: v })} 
                      />
                    </div>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-gray-50">
                    <InputField 
                      label="Driver's License Number" 
                      value={currentCustomer.dlNumber} 
                      onChange={v => updateCustomer({ dlNumber: v })} 
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <InputField 
                        label="DL State" 
                        value={currentCustomer.dlState} 
                        onChange={v => updateCustomer({ dlState: v })} 
                      />
                      <InputField 
                        label="DL Expiration" 
                        type="date"
                        value={currentCustomer.dlExpiration} 
                        onChange={v => updateCustomer({ dlExpiration: v })} 
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
                    onChange={v => updateCustomer({ insuranceCompany: v })} 
                  />
                  <InputField 
                    label="Agent Name" 
                    value={currentCustomer.agentName} 
                    onChange={v => updateCustomer({ agentName: v })} 
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
                      onChange={v => updateCustomer({ vehicleStock: v })} 
                    />
                    <InputField 
                      label="Year" 
                      value={currentCustomer.vehicleYear} 
                      onChange={v => updateCustomer({ vehicleYear: v })} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField 
                      label="Make" 
                      value={currentCustomer.vehicleMake} 
                      onChange={v => updateCustomer({ vehicleMake: v })} 
                    />
                    <InputField 
                      label="Model" 
                      value={currentCustomer.vehicleModel} 
                      onChange={v => updateCustomer({ vehicleModel: v })} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <InputField 
                      label="VIN" 
                      value={currentCustomer.vehicleVin} 
                      onChange={v => updateCustomer({ vehicleVin: v })} 
                    />
                    <InputField 
                      label="Miles" 
                      value={currentCustomer.vehicleMiles} 
                      onChange={v => updateCustomer({ vehicleMiles: v })} 
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
                      onToggle={() => updateCustomer({ hasTradeIn: !currentCustomer.hasTradeIn })} 
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
                          onChange={v => updateCustomer({ tradeYear: v })} 
                        />
                        <InputField 
                          label="Make" 
                          value={currentCustomer.tradeMake} 
                          onChange={v => updateCustomer({ tradeMake: v })} 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <InputField 
                          label="Model" 
                          value={currentCustomer.tradeModel} 
                          onChange={v => updateCustomer({ tradeModel: v })} 
                        />
                        <InputField 
                          label="Trim" 
                          value={currentCustomer.tradeTrim} 
                          onChange={v => updateCustomer({ tradeTrim: v })} 
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <InputField 
                          label="Mileage" 
                          value={currentCustomer.tradeMileage} 
                          onChange={v => updateCustomer({ tradeMileage: v })} 
                        />
                        <InputField 
                          label="VIN" 
                          value={currentCustomer.tradeVin} 
                          onChange={v => updateCustomer({ tradeVin: v })} 
                        />
                      </div>

                      <div className="space-y-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between py-2">
                          <span className="font-semibold text-gray-700">Still owe on it?</span>
                          <Toggle 
                            active={currentCustomer.stillOwe} 
                            onToggle={() => updateCustomer({ stillOwe: !currentCustomer.stillOwe })} 
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
                              onChange={v => updateCustomer({ lienholder: v })} 
                            />
                            <div className="grid grid-cols-2 gap-4">
                              <InputField 
                                label="Payoff Amount" 
                                value={currentCustomer.payoffAmount} 
                                onChange={v => updateCustomer({ payoffAmount: v })} 
                              />
                              <InputField 
                                label="Monthly Payment" 
                                value={currentCustomer.monthlyPayment} 
                                onChange={v => updateCustomer({ monthlyPayment: v })} 
                              />
                            </div>
                            <InputField 
                              label="Months Remaining" 
                              value={currentCustomer.monthsRemaining} 
                              onChange={v => updateCustomer({ monthsRemaining: v })} 
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
                    onChange={v => updateCustomer({ goalsMonthlyPayment: v })} 
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <InputField 
                      label="Money Down" 
                      placeholder="$"
                      value={currentCustomer.goalsMoneyDown} 
                      onChange={v => updateCustomer({ goalsMoneyDown: v })} 
                    />
                    <InputField 
                      label="Estimated Credit Score" 
                      placeholder="e.g. 720"
                      value={currentCustomer.goalsCreditScore} 
                      onChange={v => updateCustomer({ goalsCreditScore: v })} 
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
                        onChange={(e) => setNewNote(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                      />
                      <button 
                        onClick={handleAddNote}
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
                  onClick={() => setActiveMenu(null)}
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
                  onClick={() => setActiveMenu(activeMenu === 'app' ? null : 'app')} 
                />
                <MenuButton 
                  icon={<Sparkles size={24} />} 
                  label="Ai" 
                  active={activeMenu === 'ai'} 
                  onClick={() => setActiveMenu(activeMenu === 'ai' ? null : 'ai')} 
                />
                <MenuButton 
                  icon={<BarChart2 size={24} />} 
                  label="Insights" 
                  active={activeMenu === 'insights'} 
                  onClick={() => setActiveMenu(activeMenu === 'insights' ? null : 'insights')} 
                />
                <MenuButton 
                  icon={<Users size={24} />} 
                  label="Customer" 
                  active={activeMenu === 'customer'} 
                  onClick={() => setActiveMenu(activeMenu === 'customer' ? null : 'customer')} 
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
                      onClick={() => setIsChatOpen(true)}
                    />
                    <SubButton icon={<Camera size={20} />} label="Camera" />
                    <SubButton icon={<Upload size={20} />} label="Upload" />
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
          </motion.div>
        )}
      </AnimatePresence>

      <AIChatOverlay 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)}
        currentCustomer={currentCustomer}
        onFieldsExtracted={handleAIFieldsExtracted}
      />

      {/* Mobile Nav Bar - Only visible on Dashboard or if we want global nav */}
      {view === 'dashboard' && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-8 py-4 flex items-center justify-between z-40">
          <NavIconButton icon={<LayoutDashboard size={24} />} active />
          <NavIconButton icon={<Users size={24} />} onClick={() => setView('dashboard')} />
          <NavIconButton icon={<Settings size={24} />} />
          <button 
            onClick={() => signOut(auth)}
            className="text-gray-400 hover:text-red-500"
          >
            <LogOut size={24} />
          </button>
        </nav>
      )}
    </div>
  );
}

// --- Internal UI Components ---

const SaveStatusIndicator = ({ status, isDirty }: { status: 'idle' | 'saving' | 'synced' | 'error', isDirty: boolean }) => {
  if (status === 'saving') return (
    <div className="flex items-center gap-1.5 text-blue-600 font-bold uppercase tracking-tighter text-[10px]">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full" />
      Saving...
    </div>
  );
  if (status === 'synced') return (
    <div className="flex items-center gap-1.5 text-green-600 font-bold uppercase tracking-tighter text-[10px]">
      <div className="w-1.5 h-1.5 bg-green-600 rounded-full shadow-[0_0_8px_rgba(22,163,74,0.5)]" />
      Synced
    </div>
  );
  if (isDirty) return (
    <div className="flex items-center gap-1.5 text-amber-600 font-bold uppercase tracking-tighter text-[10px]">
      <div className="w-1.5 h-1.5 bg-amber-600 rounded-full animate-pulse" />
      Unsaved Changes
    </div>
  );
  if (status === 'error') return (
    <div className="flex items-center gap-1.5 text-red-600 font-bold uppercase tracking-tighter text-[10px]">
      Error Saving
    </div>
  );
  return null;
};

const InputField = ({ label, value, onChange, type = "text", placeholder = "" }: { 
  label: string, 
  value?: string, 
  onChange: (v: string) => void,
  type?: string,
  placeholder?: string
}) => (
  <div className="space-y-1.5 flex-1">
    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1 leading-none">{label}</label>
    <input 
      type={type}
      placeholder={placeholder}
      className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 focus:ring-2 focus:ring-gray-900 transition-all font-medium text-sm"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
    />
  </div>
);

const Toggle = ({ active, onToggle }: { active: boolean, onToggle: () => void }) => (
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

const MenuButton = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 min-w-[64px] transition-all ${active ? 'text-gray-900 scale-110' : 'text-gray-400 grayscale'}`}
  >
    <div className={`p-2 rounded-2xl transition-colors ${active ? 'bg-gray-100' : 'bg-transparent'}`}>
      {icon}
    </div>
    <span className={`text-[10px] font-bold uppercase tracking-tighter text-center leading-none ${active ? 'opacity-100' : 'opacity-40'}`}>{label}</span>
  </button>
);

const SubButton = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className="flex flex-col items-center gap-1.5 opacity-60 hover:opacity-100 transition-opacity"
  >
    <div className="p-2.5 bg-white shadow-sm border border-gray-100 rounded-xl">
      {icon}
    </div>
    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">{label}</span>
  </button>
);

const NavItem = ({ icon, label, active = false, onClick }: { 
  icon: React.ReactNode, 
  label: string, 
  active?: boolean,
  onClick?: () => void
}) => (
  <div 
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all ${
      active ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/10' : 'text-gray-500 hover:bg-gray-50'
    }`}
  >
    {icon}
    <span className="font-semibold">{label}</span>
  </div>
);

const NavIconButton = ({ icon, active = false, onClick }: { icon: React.ReactNode, active?: boolean, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className={`p-2 transition-colors ${active ? 'text-gray-900' : 'text-gray-400'}`}
  >
    {icon}
  </button>
);

const StatusBadge = ({ status }: { status: string }) => {
  const colors = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-500',
    lead: 'bg-blue-100 text-blue-700'
  };
  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors[status as keyof typeof colors]}`}>
      {status}
    </span>
  );
}
