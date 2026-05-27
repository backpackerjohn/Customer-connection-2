import type { Customer } from '../types';

export type LeadSourceValue = NonNullable<Customer['leadSourceType']>;

export interface LeadSourceNode {
  value: LeadSourceValue;
  label: string;
}

export interface LeadSourceGroup extends LeadSourceNode {
  children: LeadSourceNode[];
}

// Parent order = display order. Parents are themselves selectable (a bare parent is a
// valid value). Children render in a sub-row when the parent group is selected.
export const LEAD_SOURCE_TAXONOMY: LeadSourceGroup[] = [
  { value: 'walk-in', label: 'Walk-In', children: [] },
  {
    value: 'crm',
    label: 'CRM',
    children: [
      { value: 'vep', label: 'VEP' },
      { value: 'dealer-wizard', label: 'DW' },
      { value: 'orphan', label: 'OL' },
    ],
  },
  {
    value: 'referral',
    label: 'Referral',
    children: [
      { value: 'referral-sold-customer', label: 'Sold Customer' },
      { value: 'referral-friend', label: 'Friend' },
      { value: 'referral-family', label: 'Family' },
    ],
  },
  {
    value: 'social',
    label: 'Social',
    children: [
      { value: 'fb-marketplace', label: 'FB Marketplace' },
      { value: 'snap', label: 'Snap' },
      { value: 'fb-ads', label: 'FB Ads' },
      { value: 'tiktok', label: 'TikTok' },
    ],
  },
];

// Returns the parent group a value belongs to (the group itself if value is a parent).
export function findLeadSourceGroup(value?: string): LeadSourceGroup | undefined {
  if (!value) return undefined;
  return LEAD_SOURCE_TAXONOMY.find(
    g => g.value === value || g.children.some(c => c.value === value),
  );
}

export interface LeadSourceFlatOption {
  value: LeadSourceValue;
  label: string;
}

// Flattened single-select list for COMPACT dropdowns (e.g. Bulk Intake rows): each parent
// followed by its children, children labeled with the parent for context ("CRM › VEP").
export const LEAD_SOURCE_FLAT_OPTIONS: LeadSourceFlatOption[] = LEAD_SOURCE_TAXONOMY.flatMap(g => [
  { value: g.value, label: g.label },
  ...g.children.map(c => ({ value: c.value, label: `${g.label} › ${c.label}` })),
]);

