export interface FormSlot {
  id: string;
  filename: string;
  label: string;
  description: string;
}

// The Test Drive packet feature reads these by exact filename. Do 
// not rename without updating src/services/pdfService.ts.
export const FORM_SLOTS: FormSlot[] = [
  {
    id: 'test-drive-agreement',
    filename: 'test-drive-agreement.pdf',
    label: 'Test Drive Agreement',
    description: 'Used when generating a Test Drive packet.',
  },
  {
    id: 'interview-sheet',
    filename: 'interview-sheet.pdf',
    label: 'Customer Interview Sheet',
    description: 'Used when generating a Test Drive packet.',
  },
  { id: 'delivery-report', filename: 'delivery-report.pdf', label: 'Delivery Report', description: 'Used when generating a Sold packet.' },
  { id: 'deal-checklist', filename: 'deal-checklist.pdf', label: 'Deal Checklist', description: 'Used when generating a Sold packet.' },
  { id: 'privacy-policy', filename: 'privacy-policy.pdf', label: 'Privacy Policy', description: 'Used when generating a Sold packet.' },
  { id: 'payoff', filename: 'payoff.pdf', label: 'Pay Off', description: 'Used when generating a Sold packet (trade with balance owed).' },
  { id: 'three-liner', filename: 'three-liner.pdf', label: '3-Liner', description: 'Used when generating a Sold packet (cash deal).' },
];
