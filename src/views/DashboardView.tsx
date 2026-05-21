import React from 'react';
import { Plus, Users, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Customer } from '../types';
import { StatusBadge } from '../components/StatusBadge';

interface Props {
  customers: Customer[];
  onNewCustomer: () => void;
  onEditCustomer: (customer: Customer) => void;
}

export function DashboardView({ customers, onNewCustomer, onEditCustomer }: Props) {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-gray-500">You have {customers.length} total customers.</p>
        </div>
        <button 
          onClick={onNewCustomer}
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
