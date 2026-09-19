export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}

/**
 * What prints on the Trade Check-In Sheet beyond the vehicle identity.
 * `equipment` holds the EXACT checkbox names from the template that are ticked;
 * `unsure` holds boxes the lookup called optional for the trim (shown flagged,
 * not ticked, for the associate to confirm at the car).
 */
export interface TradeCheckIn {
  equipment: string[];
  unsure: string[];
  engine?: string;
  cylinders?: string;
  transmissionSpeeds?: string;
  extColor?: string;
  intColor?: string;
  premiumAudioBrand?: string;
  smartphoneAppName?: string;
  /** Trim the lookup was run for (from the VIN decode). */
  trim?: string;
  /** Source domains the grounded lookup cited, comma-separated. */
  sources?: string;
  /** ISO timestamp of the last lookup. */
  lookedUpAt?: string;
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
  status: 'lead' | 'sold' | 'inactive';
  lastContactedAt?: string;
  nextCadenceDue?: string;
  manualReminders?: { date: string; reason: string }[];
  purchaseDate?: string;         // ISO date, set by Sold button
  referralAskedAt?: string;      // ISO date, set when the referral reminder is checked off
  leadSource?: string;           // free-text source label captured by Bulk Intake
  leadSourceType?:
    | 'walk-in'
    | 'crm' | 'vep' | 'dealer-wizard' | 'orphan'
    | 'referral' | 'referral-sold-customer' | 'referral-friend' | 'referral-family'
    | 'social' | 'fb-marketplace' | 'snap' | 'fb-ads' | 'tiktok'
    | 'showroom' | 'phone' | 'web' | 'other';
  contactChannel?: 'text' | 'crm-text' | 'email' | 'snapchat' | 'facebook';
  working?: boolean;
  /** Trade check-in: B-line trades get a Buyers Guide only, no Check-In Sheet. Dealer-only, never AI-extracted. */
  tradeIsBLine?: boolean;
  /** Trade check-in: dealer override of the derived trade stock number (see lib/tradeStockNumber.ts). Dealer-only. */
  tradeStockNumber?: string;
  /** Trade Check-In Sheet contents (see lib/tradeCheckInSheet.ts). One map so it costs the rules budget one field. */
  tradeCheckIn?: TradeCheckIn;
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

export interface Todo {
  id?: string;
  text: string;
  done: boolean;
  customerId?: string;
  customerName?: string;
  createdBy?: string;
  createdAt?: FirestoreTimestamp;
  completedAt?: FirestoreTimestamp | null;
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
