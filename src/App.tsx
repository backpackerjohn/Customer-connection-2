import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  LayoutDashboard, 
  Settings, 
  LogOut,
  Sparkles,
  Bell
} from 'lucide-react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, handleFirestoreError, OperationType } from './lib/firebase';
import { motion, AnimatePresence } from 'motion/react';

import { AIChatOverlay } from './components/AIChatOverlay';
import { NavItem } from './components/NavItem';
import { NavIconButton } from './components/NavIconButton';

import { Customer, Note, emptyCustomer } from './types';
import { 
  createCustomer, updateCustomer, subscribeToCustomers 
} from './services/customersService';
import { createNote, subscribeToNotes } from './services/notesService';
import { createContact } from './services/contactsService';
import { ReminderKind, recordContact, computeNextCadenceDue, rollNextCadence } from './lib/reminders/engine';
import { REMINDER_CONFIG } from './lib/reminders/config';
import { 
  buildTestDrivePacket, 
  buildSoldPacket,
  downloadPdfBytes, 
  packetFilename,
  selectSoldForms,
  soldPacketFilename
} from './services/pdfService';
import { getFormFileMetadata, uploadCustomerImage } from './services/imagesService';
import { getTradeValuation } from './services/valuationService';
import { FORM_SLOTS } from './lib/formSlots';

import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { CustomerProfileView } from './views/CustomerProfileView';
import { SettingsView } from './views/SettingsView';
import { BulkIntakeView } from './views/BulkIntakeView';
import { TodayView } from './views/TodayView';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'profile' | 'settings' | 'bulk-intake' | 'today'>('dashboard');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currentCustomer, setCurrentCustomer] = useState<Customer>(emptyCustomer);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'synced' | 'error'>('idle');
  const [isDirty, setIsDirty] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isGeneratingPacket, setIsGeneratingPacket] = useState(false);
  const [isGeneratingSoldPacket, setIsGeneratingSoldPacket] = useState(false);
  const [isEstimatingTradeValue, setIsEstimatingTradeValue] = useState(false);
  const [testDriveError, setTestDriveError] = useState<string | null>(null);
  const [soldError, setSoldError] = useState<string | null>(null);
  const [valuationError, setValuationError] = useState<string | null>(null);
  const requestTokenRef = useRef<number>(0);
  const currentCustomerIdRef = useRef<string | undefined>(currentCustomer.id);
  const [pendingAINotes, setPendingAINotes] = useState<string[]>([]);
  const [pendingImages, setPendingImages] = useState<{ 
    type: 'license' | 'insurance', 
    file: File 
  }[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    currentCustomerIdRef.current = currentCustomer.id;
  }, [currentCustomer.id]);

  // Auto-save effect
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, status, hasTradeIn, stillOwe, createdAt, updatedAt, ...rest } = currentCustomer;
    const hasAnyData =
      Object.values(rest).some(v => v !== '' && v !== undefined && v !== null) ||
      hasTradeIn !== false ||
      stillOwe !== false;

    if (!isDirty || !user || !hasAnyData) return;
    
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting status before debounce
    setSaveStatus('idle'); 
    const timeoutId = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        let customerId = currentCustomer.id;

        if (customerId) {
          await updateCustomer(customerId, currentCustomer);
        } else {
          customerId = await createCustomer(user.uid, currentCustomer);
          // Update current state with the new ID to prevent multiple creations
          setCurrentCustomer(prev => ({ ...prev, id: customerId }));

          // BUG 5 FIX: Flush pending notes for the new customer
          if (pendingAINotes.length > 0) {
            await Promise.all(pendingAINotes.map(content => 
              createNote(customerId!, {
                content, 
                type: 'ai', 
                authorId: user.uid
              })
            ));
            setPendingAINotes([]);
          }

          // Step 8d: Flush pending images for the new customer
          if (pendingImages.length > 0) {
            const uploads = await Promise.all(
              pendingImages.map(img => 
                uploadCustomerImage(user.uid, customerId!, img.type, img.file)
                  .then(url => ({ type: img.type, url }))
              )
            );
            const urlPatch: Partial<Customer> = {};
            for (const { type, url } of uploads) {
              if (type === 'license') urlPatch.dlImageUrl = url;
              else urlPatch.insuranceImageUrl = url;
            }
            await updateCustomer(customerId!, { ...currentCustomer, id: customerId, ...urlPatch });
            setCurrentCustomer(prev => ({ ...prev, ...urlPatch }));
            setPendingImages([]);
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
  }, [currentCustomer, isDirty, user, pendingAINotes, pendingImages]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToCustomers(
      user.uid,
      setCustomers,
      (error) => handleFirestoreError(error, OperationType.LIST, 'customers')
    );

    return unsubscribe;
  }, [user]);

  // Fetch notes for current customer
  useEffect(() => {
    if (!user || !currentCustomer.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting notes when customer changes
      setNotes([]);
      return;
    }

    const unsubscribe = subscribeToNotes(
      currentCustomer.id,
      user.uid,
      setNotes,
      (error) => handleFirestoreError(error, OperationType.LIST, `customers/${currentCustomer.id}/notes`)
    );

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

  const handleTexted = async (customerId: string, when: Date, closedKinds: ReminderKind[]) => {
    if (!user) return;
    
    // Find the customer to update
    const targetCustomer = customers.find(c => c.id === customerId);
    if (!targetCustomer) return;

    try {
      // 1. Write the contact record
      await createContact(customerId, {
        authorId: user.uid,
        kinds: closedKinds,
        note: `Contacted customer via text message (${closedKinds.join(' + ')} outreach).`,
        attestedAt: when.toISOString()
      });

      // 2. Advance next cadence math
      const updatedCust = recordContact(targetCustomer, when, closedKinds, REMINDER_CONFIG);
      const nextDue = computeNextCadenceDue(updatedCust, REMINDER_CONFIG);
      
      const patch: Partial<Customer> = {
        lastContactedAt: updatedCust.lastContactedAt,
        nextCadenceDue: nextDue,
        manualReminders: updatedCust.manualReminders || []
      };

      if (closedKinds.includes('referral48to72h')) {
        patch.referralAskedAt = when.toISOString();
      }

      // 3. Update Firestore & local state
      await updateCustomer(customerId, { ...targetCustomer, ...patch });
      
      if (currentCustomer.id === customerId) {
        setCurrentCustomer(prev => ({ ...prev, ...patch }));
      }
    } catch (error) {
      console.error('Failed to log texted and advance cadence:', error);
      handleFirestoreError(error, OperationType.WRITE, `customers/${customerId}/contacts`);
    }
  };

  const handleReschedule = async (customerId: string, dateStr: string, reason: string) => {
    if (!user) return;

    const targetCustomer = customers.find(c => c.id === customerId);
    if (!targetCustomer) return;

    try {
      const activeReminders = targetCustomer.manualReminders || [];
      const updatedReminders = [...activeReminders, { date: dateStr, reason }];
      
      const nextDue = computeNextCadenceDue({
        ...targetCustomer,
        manualReminders: updatedReminders
      }, REMINDER_CONFIG);

      const patch = {
        manualReminders: updatedReminders,
        nextCadenceDue: nextDue
      };

      await updateCustomer(customerId, { ...targetCustomer, ...patch });

      if (currentCustomer.id === customerId) {
        setCurrentCustomer(prev => ({ ...prev, ...patch }));
      }
    } catch (error) {
      console.error('Failed to reschedule:', error);
      handleFirestoreError(error, OperationType.WRITE, `customers/${customerId}`);
    }
  };

  const updateCustomerState = (updates: Partial<Customer>) => {
    setCurrentCustomer(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
    setSaveStatus('idle');
  };

  const showTestDriveError = (msg: string) => {
    setTestDriveError(msg);
    setTimeout(() => setTestDriveError(null), 4000);
  };

  const showSoldError = (msg: string) => {
    setSoldError(msg);
    setTimeout(() => setSoldError(null), 4000);
  };

  const showValuationError = (msg: string) => {
    setValuationError(msg);
    setTimeout(() => setValuationError(null), 4000);
  };

  const handleAddNote = async () => {
    if (!user || !currentCustomer.id || !newNote.trim()) return;

    try {
      await createNote(currentCustomer.id, {
        content: newNote.trim(),
        type: 'manual',
        authorId: user.uid
      });
      setNewNote('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `customers/${currentCustomer.id}/notes`);
    }
  };

  const handleAddNoteForCustomer = async (customerId: string, content: string) => {
    if (!user) return;
    try {
      await createNote(customerId, {
        content,
        type: 'manual',
        authorId: user.uid
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `customers/${customerId}/notes`);
    }
  };

  const handleTestDrive = async () => {
    if (isGeneratingPacket) return;
    
    setIsGeneratingPacket(true);
    try {
      const [tda, interview] = await Promise.all([
        getFormFileMetadata('test-drive-agreement.pdf'),
        getFormFileMetadata('interview-sheet.pdf'),
      ]);
      const missing: string[] = [];
      if (!tda.exists) missing.push('Test Drive Agreement');
      if (!interview.exists) missing.push('Customer Interview Sheet');
      if (missing.length > 0) {
        showTestDriveError(`Upload ${missing.join(' and ')} in Settings → Forms.`);
        return;
      }
      const bytes = await buildTestDrivePacket(currentCustomer);
      downloadPdfBytes(bytes, packetFilename(currentCustomer));
    } catch (err) {
      console.error('Test Drive packet generation failed:', err);
      showTestDriveError('Could not generate packet. See console for details.');
    } finally {
      setIsGeneratingPacket(false);
    }
  };

  const handleSold = async () => {
    if (isGeneratingSoldPacket) return;
    
    setIsGeneratingSoldPacket(true);
    try {
      const neededSlots = selectSoldForms(currentCustomer);
      const metadatas = await Promise.all(
        neededSlots.map(id => {
          const slot = FORM_SLOTS.find(s => s.id === id);
          return getFormFileMetadata(slot?.filename ?? 'missing.pdf');
        })
      );
      
      const missingLabels: string[] = [];
      metadatas.forEach((m, i) => {
        if (!m.exists) {
          const slot = FORM_SLOTS.find(s => s.id === neededSlots[i]);
          if (slot) missingLabels.push(slot.label);
        }
      });

      if (missingLabels.length > 0) {
        let msg = '';
        if (missingLabels.length === 1) msg = missingLabels[0];
        else {
          const last = missingLabels.pop();
          msg = missingLabels.join(', ') + ' and ' + last;
        }
        showSoldError(`Upload ${msg} in Settings → Forms.`);
        return;
      }

      const bytes = await buildSoldPacket(currentCustomer);
      downloadPdfBytes(bytes, soldPacketFilename(currentCustomer));

      // Run the full Sold-flow patch (stamp purchaseDate to now, roll buyer
      // cadence, flip status='sold') whenever the customer is NOT already
      // marked sold. This re-stamps purchaseDate even if it was previously
      // populated (e.g. AI-extracted or manually typed) — clicking Sold
      // means "they're buying NOW", so today's date is the correct value.
      // Re-clicking Sold on an already-sold customer is idempotent: only
      // the PDF regenerates.
      if (currentCustomer.status !== 'sold') {
        try {
          const todayISO = new Date().toISOString();
          // Roll a buyer-mode cadence (3–6 months out) at sale time so
          // the customer enters standard-buyer mode on day 8 with a
          // sensible cadence in place, even if the dealer never hits
          // Texted during the 7-day fresh-buyer window. We deliberately
          // do NOT stamp lastContactedAt here — that would suppress the
          // day-1 followUp24h reminder (engine closes it when
          // lastContactedAt > purchaseDate).
          const nextCadence = rollNextCadence(new Date(), 'buyer', REMINDER_CONFIG);
          const patch: Partial<Customer> = {
            purchaseDate: todayISO,
            nextCadenceDue: nextCadence,
            status: 'sold'
          };
          await updateCustomer(currentCustomer.id!, { ...currentCustomer, ...patch });
          setCurrentCustomer(prev => ({ ...prev, ...patch }));
        } catch (stampErr) {
          console.error('Failed to stamp purchase date after sale:', stampErr);
        }
      }
    } catch (err) {
      console.error('Sold packet generation failed:', err);
      showSoldError('Could not generate packet. See console for details.');
    } finally {
      setIsGeneratingSoldPacket(false);
    }
  };

  const handleTradeEstimate = async (
    input: { 
      vin: string; 
      year: string; 
      make: string; 
      model: string; 
      trim: string; 
      mileage: string; 
    },
    options?: { skipCache?: boolean }
  ) => {
    const token = ++requestTokenRef.current;
    const capturedId = currentCustomer.id;
    setIsEstimatingTradeValue(true);

    try {
      const result = await getTradeValuation(input, options);
      
      // DISCARD if stale
      if (token !== requestTokenRef.current || currentCustomerIdRef.current !== capturedId) {
        return;
      }

      if (result) {
        updateCustomerState({ 
          tradeValueExcellentLow: result.excellent.low,
          tradeValueExcellentHigh: result.excellent.high,
          tradeValueVeryGoodLow: result.veryGood.low,
          tradeValueVeryGoodHigh: result.veryGood.high,
          tradeValueGoodLow: result.good.low,
          tradeValueGoodHigh: result.good.high,
          tradeValueFairLow: result.fair.low,
          tradeValueFairHigh: result.fair.high,
          tradeValueSource: result.source, 
          tradeValueAt: new Date().toISOString(),
          // Default condition if not set
          ...(!currentCustomer.tradeValueCondition ? { tradeValueCondition: 'good' as const } : {})
        });
      } else {
        showValuationError("No data found for this VIN. Enter manually if needed.");
      }
    } catch (err) {
      console.error('Trade estimate failed:', err);
      showValuationError('Estimate failed. Please try again.');
    } finally {
      if (token === requestTokenRef.current) {
        setIsEstimatingTradeValue(false);
      }
    }
  };

  const handleAIFieldsExtracted = (
    fields: Record<string, unknown>, 
    notesSummary?: string,
    image?: { type: 'license' | 'insurance', file: File }
  ) => {
    if (Object.keys(fields).length > 0) {
      updateCustomerState(fields);
    }
    
    if (notesSummary && user) {
      if (currentCustomer.id) {
        // Customer exists, write immediately
        createNote(currentCustomer.id, {
          content: notesSummary,
          type: 'ai',
          authorId: user.uid
        }).catch(err => handleFirestoreError(err, OperationType.WRITE, `customers/${currentCustomer.id}/notes`));
      } else {
        // BUG 5 FIX: Buffer the note for the pending customer
        setPendingAINotes(prev => [...prev, notesSummary]);
      }
    }

    if (image && user) {
      if (currentCustomer.id) {
        // Customer exists — upload immediately
        uploadCustomerImage(user.uid, currentCustomer.id, image.type, image.file)
          .then(url => {
            const patch = image.type === 'license' 
              ? { dlImageUrl: url } 
              : { insuranceImageUrl: url };
            updateCustomerState(patch);
          })
          .catch(err => handleFirestoreError(err, OperationType.WRITE, 
            `customer-images/${currentCustomer.id}`));
      } else {
        // Buffer until customer is created
        setPendingImages(prev => [...prev, image]);
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
          <NavItem 
            icon={<Bell size={20} />} 
            label="Today" 
            active={view === 'today'} 
            onClick={() => setView('today')}
          />
          <NavItem icon={<Users size={20} />} label="Customers" />
          <NavItem 
            icon={<Sparkles size={20} />} 
            label="Bulk Intake" 
            active={view === 'bulk-intake'}
            onClick={() => setView('bulk-intake')}
          />
          <NavItem 
            icon={<Settings size={20} />} 
            label="Settings" 
            active={view === 'settings'}
            onClick={() => setView('settings')}
          />
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
        {view === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <DashboardView 
              customers={customers}
              onNewCustomer={handleNewCustomer}
              onEditCustomer={handleEditCustomer}
            />
          </motion.div>
        )}
        {view === 'today' && (
          <motion.div
            key="today"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <TodayView 
              customers={customers}
              onTexted={handleTexted}
              onReschedule={handleReschedule}
              user={user}
              onAddNote={handleAddNoteForCustomer}
            />
          </motion.div>
        )}
        {view === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <CustomerProfileView 
              currentCustomer={currentCustomer}
              saveStatus={saveStatus}
              isDirty={isDirty}
              notes={notes}
              newNote={newNote}
              activeMenu={activeMenu}
              isGeneratingPacket={isGeneratingPacket}
              isGeneratingSoldPacket={isGeneratingSoldPacket}
              isEstimatingTradeValue={isEstimatingTradeValue}
              testDriveError={testDriveError}
              soldError={soldError}
              valuationError={valuationError}
              onBack={() => setView('dashboard')}
              onUpdateCustomer={updateCustomerState}
              onNewNoteChange={setNewNote}
              onAddNote={handleAddNote}
              onActiveMenuChange={setActiveMenu}
              onChat={() => setIsChatOpen(true)}
              onTestDrive={handleTestDrive}
              onSold={handleSold}
              onTradeEstimate={handleTradeEstimate}
              onReschedule={handleReschedule}
            />
          </motion.div>
        )}
        {view === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <SettingsView onBack={() => setView('dashboard')} />
          </motion.div>
        )}
        {view === 'bulk-intake' && (
          <motion.div
            key="bulk-intake"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <BulkIntakeView 
              customers={customers}
              user={user}
              onComplete={(dest) => setView(dest === 'today' ? 'today' : 'dashboard')}
            />
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
      {(view === 'dashboard' || view === 'settings' || view === 'bulk-intake' || view === 'today') && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-8 py-4 flex items-center justify-between z-40">
          <NavIconButton 
            icon={<LayoutDashboard size={24} />} 
            active={view === 'dashboard'} 
            onClick={() => setView('dashboard')}
          />
          <NavIconButton 
            icon={<Bell size={24} />} 
            active={view === 'today'} 
            onClick={() => setView('today')}
          />
          <NavIconButton 
            icon={<Sparkles size={24} />} 
            active={view === 'bulk-intake'}
            onClick={() => setView('bulk-intake')}
          />
          <NavIconButton 
            icon={<Settings size={24} />} 
            active={view === 'settings'}
            onClick={() => setView('settings')}
          />
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
