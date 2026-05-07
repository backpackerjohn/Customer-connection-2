export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}

export interface Customer {
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
  dlImageUrl?: string;
  vehicleStock?: string;
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleVin?: string;
  vehicleMiles?: string;
  insuranceCompany?: string;
  insuranceImageUrl?: string;
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
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
}

export interface Note {
  id?: string;
  content: string;
  type: 'manual' | 'ai' | 'transcript';
  authorId: string;
  createdAt: FirestoreTimestamp;
}

export const emptyCustomer: Customer = {
  firstName: '',
  middleInitial: '',
  lastName: '',
  status: 'lead',
  hasTradeIn: false,
  stillOwe: false,
};
