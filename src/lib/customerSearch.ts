import { Customer } from '../types';

export interface VehicleRef {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
}

export interface FilterCriteria {
  status?: Array<'lead' | 'sold' | 'inactive'>;
  leadSourceType?: string[];
  vehicleScope?: 'owns' | 'wants' | 'either';
  make?: string[];
  model?: string[];
  carAgeMin?: number;
  carAgeMax?: number;
  purchasedWithinDaysMin?: number;
  purchasedWithinDaysMax?: number;
  purchaseDateStart?: string; // YYYY-MM-DD
  purchaseDateEnd?: string; // YYYY-MM-DD
  recencyField?: 'createdAt' | 'lastContactedAt' | 'leadGeneratedDate';
  recencyMin?: string; // YYYY-MM-DD
  recencyMax?: string; // YYYY-MM-DD
  recall?: string;
}

export function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateString(s: string): Date {
  const dateStr = s.includes('T') ? s.split('T')[0] : s;
  const parts = dateStr.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

export function getDaysDiff(s1: string, s2: string): number {
  const d1 = parseDateString(s1);
  const d2 = parseDateString(s2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function resolveVehicles(customer: Customer): { owns: VehicleRef[]; wants: VehicleRef[] } {
  const owns: VehicleRef[] = [];
  const wants: VehicleRef[] = [];

  const hasVehicle = !!(customer.vehicleYear || customer.vehicleMake || customer.vehicleModel);

  if (customer.status === 'lead' || customer.status === 'inactive') {
    if (customer.hasTradeIn) {
      owns.push({
        year: customer.tradeYear,
        make: customer.tradeMake,
        model: customer.tradeModel,
        trim: customer.tradeTrim,
      });
    }
    if (hasVehicle) {
      wants.push({
        year: customer.vehicleYear,
        make: customer.vehicleMake,
        model: customer.vehicleModel,
      });
    }
  } else if (customer.status === 'sold') {
    if (hasVehicle) {
      owns.push({
        year: customer.vehicleYear,
        make: customer.vehicleMake,
        model: customer.vehicleModel,
      });
    }
  }

  return { owns, wants };
}

function getFieldDateString(customer: Customer, field: 'createdAt' | 'lastContactedAt' | 'leadGeneratedDate'): string | undefined {
  if (field === 'createdAt') {
    if (!customer.createdAt) return undefined;
    const seconds = customer.createdAt.seconds;
    if (typeof seconds === 'number') {
      const d = new Date(seconds * 1000);
      return formatDateISO(d);
    }
    return undefined;
  }
  if (field === 'lastContactedAt') {
    if (!customer.lastContactedAt) return undefined;
    return customer.lastContactedAt.split('T')[0];
  }
  if (field === 'leadGeneratedDate') {
    if (!customer.leadGeneratedDate) return undefined;
    return customer.leadGeneratedDate.split('T')[0];
  }
  return undefined;
}

const recallFields: Array<keyof Customer> = [
  'firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state', 'zip',
  'vehicleMake', 'vehicleModel', 'vehicleYear',
  'tradeMake', 'tradeModel', 'tradeTrim', 'tradeYear',
  'leadSource', 'pendingInterestNotes', 'lienholder', 'agentName', 'insuranceCompany'
];

export function applyFilters(
  customers: Customer[],
  criteria: FilterCriteria,
  today: Date,
  notesByCustomer?: Record<string, string[]>
): { matched: Customer[]; unclassified: Customer[] } {
  const matched: Customer[] = [];
  const unclassified: Customer[] = [];

  const isStatusActive = !!(criteria.status && criteria.status.length > 0);
  const isLeadSourceTypeActive = !!(criteria.leadSourceType && criteria.leadSourceType.length > 0);
  const isPurchasedWithinDaysActive = criteria.purchasedWithinDaysMin !== undefined || criteria.purchasedWithinDaysMax !== undefined;
  const isPurchaseDateRangeActive = !!(criteria.purchaseDateStart || criteria.purchaseDateEnd);
  const isRecencyActive = !!(criteria.recencyField && (criteria.recencyMin || criteria.recencyMax));
  const isRecallActive = !!(criteria.recall && criteria.recall.trim().length > 0);

  const isMakeActive = !!(criteria.make && criteria.make.length > 0);
  const isModelActive = !!(criteria.model && criteria.model.length > 0);
  const isCarAgeActive = criteria.carAgeMin !== undefined || criteria.carAgeMax !== undefined;
  const isVehicleFacetActive = isMakeActive || isModelActive || isCarAgeActive;

  for (const customer of customers) {
    // 1. Status Facet
    if (isStatusActive && criteria.status) {
      if (!criteria.status.includes(customer.status)) {
        continue;
      }
    }

    // 2. LeadSourceType Facet
    if (isLeadSourceTypeActive && criteria.leadSourceType) {
      if (!customer.leadSourceType || !criteria.leadSourceType.includes(customer.leadSourceType)) {
        continue;
      }
    }

    // 3. Time Since Purchase Facet
    const hasPurchaseDate = !!customer.purchaseDate;
    if ((isPurchasedWithinDaysActive || isPurchaseDateRangeActive) && hasPurchaseDate) {
      const purchaseDateStr = customer.purchaseDate!;
      if (isPurchasedWithinDaysActive) {
        const todayStr = formatDateISO(today);
        const daysSince = getDaysDiff(purchaseDateStr, todayStr);
        if (criteria.purchasedWithinDaysMin !== undefined && daysSince < criteria.purchasedWithinDaysMin) {
          continue;
        }
        if (criteria.purchasedWithinDaysMax !== undefined && daysSince > criteria.purchasedWithinDaysMax) {
          continue;
        }
      }
      if (isPurchaseDateRangeActive) {
        const rawDatePart = purchaseDateStr.split('T')[0];
        if (criteria.purchaseDateStart && rawDatePart < criteria.purchaseDateStart) {
          continue;
        }
        if (criteria.purchaseDateEnd && rawDatePart > criteria.purchaseDateEnd) {
          continue;
        }
      }
    }

    // 4. Recency Facet
    if (isRecencyActive && criteria.recencyField) {
      const fileDateStr = getFieldDateString(customer, criteria.recencyField);
      if (!fileDateStr) {
        continue;
      }
      if (criteria.recencyMin && fileDateStr < criteria.recencyMin) {
        continue;
      }
      if (criteria.recencyMax && fileDateStr > criteria.recencyMax) {
        continue;
      }
    }

    // 5. Recall Facet
    if (isRecallActive && criteria.recall) {
      const query = criteria.recall.trim().toLowerCase();
      let match = recallFields.some(field => {
        const val = customer[field];
        if (typeof val === 'string') {
          return val.toLowerCase().includes(query);
        }
        return false;
      });

      if (!match && notesByCustomer && customer.id) {
        const notes = notesByCustomer[customer.id];
        if (notes && notes.length > 0) {
          match = notes.some(note => note.toLowerCase().includes(query));
        }
      }

      if (!match) {
        continue;
      }
    }

    // 6. Vehicle Facet
    if (isVehicleFacetActive) {
      const scope = criteria.vehicleScope || 'either';
      const resolved = resolveVehicles(customer);
      const candidateVehicles = scope === 'owns'
        ? resolved.owns
        : scope === 'wants'
          ? resolved.wants
          : [...resolved.owns, ...resolved.wants];

      if (candidateVehicles.length === 0) {
        unclassified.push(customer);
      } else {
        let anyDefiniteMatch = false;
        let anyUnknown = false;

        for (const v of candidateVehicles) {
          let isVehicleMatch = true;
          let isVehicleUnknown = false;

          // Make check
          if (isMakeActive && criteria.make) {
            if (!v.make) {
              isVehicleUnknown = true;
            } else {
              const matchMake = criteria.make.some(m => m.toLowerCase() === v.make!.toLowerCase());
              if (!matchMake) {
                isVehicleMatch = false;
              }
            }
          }

          // Model check
          if (isModelActive && criteria.model) {
            if (!v.model) {
              isVehicleUnknown = true;
            } else {
              const matchModel = criteria.model.some(m => m.toLowerCase() === v.model!.toLowerCase());
              if (!matchModel) {
                isVehicleMatch = false;
              }
            }
          }

          // Car age/year check
          if (isCarAgeActive) {
            if (!v.year) {
              isVehicleUnknown = true;
            } else {
              const yearNum = Number(v.year);
              const age = today.getFullYear() - yearNum;
              if (isNaN(age)) {
                isVehicleUnknown = true;
              } else {
                let ageMatch = true;
                if (criteria.carAgeMin !== undefined && age < criteria.carAgeMin) {
                  ageMatch = false;
                }
                if (criteria.carAgeMax !== undefined && age > criteria.carAgeMax) {
                  ageMatch = false;
                }
                if (!ageMatch) {
                  isVehicleMatch = false;
                }
              }
            }
          }

          if (isVehicleMatch && !isVehicleUnknown) {
            anyDefiniteMatch = true;
          } else if (!isVehicleMatch) {
            // Definite mismatch, moves to next vehicle in list
          } else {
            // It is unknown (has no mismatches, but lacks info on active fields)
            anyUnknown = true;
          }
        }

        if (anyDefiniteMatch) {
          matched.push(customer);
        } else if (anyUnknown) {
          unclassified.push(customer);
        } else {
          // Definite mismatch for all vehicles
        }
      }
    } else {
      matched.push(customer);
    }
  }

  return { matched, unclassified };
}
