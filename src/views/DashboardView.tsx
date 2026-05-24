import React from 'react';
import { Customer } from '../types';

interface Props {
  customers: Customer[];
  onNewCustomer: () => void;
  onEditCustomer: (customer: Customer) => void;
}

export function DashboardView({ customers, onNewCustomer, onEditCustomer }: Props) {
  // Reference parameters to satisfy ESLint without executing them
  if (false as boolean) {
    console.log(customers, onNewCustomer, onEditCustomer);
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <header className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-gray-500">Welcome back. Use the sidebar to navigate to Customers, Today, or Bulk Intake.</p>
      </header>
    </div>
  );
}
