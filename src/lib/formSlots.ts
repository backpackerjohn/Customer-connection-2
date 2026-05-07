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
];
