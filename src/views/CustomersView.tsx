import React from 'react';
import { Plus, Users, ChevronRight, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { Customer } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface Props {
  customers: Customer[];
  onNewCustomer: () => void;
  onEditCustomer: (customer: Customer) => void;
}

export function CustomersView({ customers, onNewCustomer, onEditCustomer }: Props) {
  const [searchQuery, setSearchQuery] = React.useState('');

  const sortedCustomers = [...customers].sort((a, b) => {
    const aTime = a.updatedAt?.seconds ?? a.createdAt?.seconds ?? Infinity;
    const bTime = b.updatedAt?.seconds ?? b.createdAt?.seconds ?? Infinity;
    return bTime - aTime;
  });

  const filteredCustomers = sortedCustomers.filter((customer) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const first = (customer.firstName || '').toLowerCase();
    const last = (customer.lastName || '').toLowerCase();
    const phone = (customer.phone || '').toLowerCase();
    const email = (customer.email || '').toLowerCase();
    return first.includes(q) || last.includes(q) || phone.includes(q) || email.includes(q);
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Customers</h2>
          <p className="text-gray-500">
            {searchQuery.trim() 
              ? `Found ${filteredCustomers.length} matching of ${customers.length}`
              : `All ${customers.length} customers.`}
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-950 transition-shadow bg-white"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-medium text-xs"
              >
                Clear
              </button>
            )}
          </div>
          <button 
            onClick={onNewCustomer}
            className="bg-gray-950 text-white p-4 md:px-6 md:py-3 rounded-full md:rounded-2xl flex items-center gap-2 shadow-lg shadow-gray-900/20 active:scale-95 transition-transform"
          >
            <Plus size={20} />
            <span className="hidden md:inline font-semibold">New Customer</span>
          </button>
        </div>
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
        ) : filteredCustomers.length === 0 ? (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
              <Search className="text-gray-400 animate-pulse" />
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-lg">No matches</p>
              <p className="text-gray-500 text-sm max-w-xs mx-auto">No customers found matching "{searchQuery}". Try a different name, phone, or email.</p>
            </div>
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <motion.div 
              layoutId={customer.id}
              key={customer.id} 
              onClick={() => onEditCustomer(customer)}
              className="card p-6 flex flex-col justify-between hover:shadow-md transition-shadow group cursor-pointer"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-lg leading-tight">
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
    </div>
  );
}
