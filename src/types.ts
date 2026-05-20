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
  tradeValueLow?: string;
  tradeValueHigh?: string;
  tradeValueExcellentLow?: string;
  tradeValueExcellentHigh?: string;
  tradeValueVeryGoodLow?: string;
  tradeValueVeryGoodHigh?: string;
  tradeValueGoodLow?: string;
  tradeValueGoodHigh?: string;
  tradeValueFairLow?: string;
  tradeValueFairHigh?: string;
  tradeValueSource?: string;
  tradeValueCondition?: 'excellent' | 'very_good' | 'good' | 'fair';
  tradeValueAt?: string;
  customerDesiredTradeValue?: string;
  stillOwe: boolean;
  payingCash: boolean;
  lienholder?: string;
  payoffAmount?: string;
  monthlyPayment?: string;
  monthsRemaining?: string;
  goalsMonthlyPayment?: string;
  goalsMoneyDown?: string;
  goalsCreditScore?: string;
  status: 'active' | 'inactive' | 'lead';
  lastContactedAt?: string;
  nextCadenceDue?: string;
  manualReminders?: { date: string; reason: string }[];
  purchaseDate?: string;         // ISO date, set by Sold button
  referralAskedAt?: string;      // ISO date, set when the referral reminder is checked off
  leadSource?: string;           // free-text source label captured by Bulk Intake
  leadGeneratedDate?: string;    // ISO date YYYY-MM-DD, captured by Bulk Intake
  pendingInterestNotes?: string; // free text holding secondary vehicle interests dropped at intake
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
  createdBy?: string;
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
  payingCash: false,
};
