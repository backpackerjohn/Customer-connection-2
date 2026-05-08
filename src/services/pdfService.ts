import { PDFDocument } from 'pdf-lib';
import { Customer } from '../types';
import { getBlankFormUrl } from './imagesService';
import { 
  INTERVIEW_SHEET_FIELDS, TEST_DRIVE_AGREEMENT_FIELDS 
} from '../lib/pdfFieldMappings';
import { timed } from '../lib/timing';

export async function fillTestDriveAgreement(customer: Customer): Promise<Uint8Array> {
  const url = await getBlankFormUrl('test-drive-agreement.pdf');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch blank form: ${response.status}`);
  }
  const blankBytes = await response.arrayBuffer();
  const pdfDoc = await PDFDocument.load(blankBytes);
  const form = pdfDoc.getForm();

  for (const mapping of TEST_DRIVE_AGREEMENT_FIELDS) {
    try {
      const field = form.getTextField(mapping.pdfFieldName);
      field.setText(mapping.getValue(customer));
    } catch (err) {
      console.warn(`PDF field "${mapping.pdfFieldName}" not found:`, err);
    }
  }

  return await pdfDoc.save();
}

export async function fillInterviewSheet(customer: Customer): Promise<Uint8Array> {
  const url = await getBlankFormUrl('interview-sheet.pdf');
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch interview sheet: ${response.status}`);
  }
  const blankBytes = await response.arrayBuffer();
  const pdfDoc = await PDFDocument.load(blankBytes);
  const form = pdfDoc.getForm();

  for (const mapping of INTERVIEW_SHEET_FIELDS) {
    try {
      const field = form.getTextField(mapping.pdfFieldName);
      field.setText(mapping.getValue(customer));
    } catch (err) {
      console.warn(`Interview Sheet text field "${mapping.pdfFieldName}" not found:`, err);
    }
  }

  // Trade-in checkbox PAIR — independent, must enforce mutex.
  try {
    const yesBox = form.getCheckBox('Yes to Trading In');
    const noBox = form.getCheckBox('No to Trading In');
    yesBox.uncheck();
    noBox.uncheck();
    if (customer.hasTradeIn === true) yesBox.check();
    else if (customer.hasTradeIn === false) noBox.check();
  } catch (err) {
    console.warn('Trade-in checkbox pair handling failed:', err);
  }

  // "Do you owe a balance" radio — kid values are Yes_3/No_3.
  try {
    const radio = form.getRadioGroup('undefined_2');
    if (customer.stillOwe === true) radio.select('Yes_3');
    else if (customer.stillOwe === false) radio.select('No_3');
  } catch (err) {
    console.warn('undefined_2 radio handling failed:', err);
  }

  return await pdfDoc.save();
}

async function addImagePage(
  pdfDoc: PDFDocument, 
  imageUrl: string, 
  label: string
): Promise<void> {
  const response = await fetch(imageUrl);
  if (!response.ok) return;
  const imageBytes = await response.arrayBuffer();
  const isJpg = imageUrl.includes('.jpg') || imageUrl.includes('.jpeg');
  const image = isJpg 
    ? await pdfDoc.embedJpg(imageBytes) 
    : await pdfDoc.embedPng(imageBytes);

  const page = pdfDoc.addPage([612, 792]);
  const { width: pageW, height: pageH } = page.getSize();

  const targetWidth = pageW * 0.75;
  const scale = targetWidth / image.width;
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const x = (pageW - drawWidth) / 2;
  const y = pageH - 100 - drawHeight;
  page.drawImage(image, { 
    x, y: Math.max(50, y), 
    width: drawWidth, height: drawHeight 
  });

  page.drawText(label, { x: 50, y: pageH - 60, size: 14 });
}

export async function buildTestDrivePacket(customer: Customer): Promise<Uint8Array> {
  return await timed('pdfService.buildTestDrivePacket', async () => {
    const tdaBytes = await fillTestDriveAgreement(customer);
    const interviewBytes = await fillInterviewSheet(customer);

    const merged = await PDFDocument.create();

    const tdaDoc = await PDFDocument.load(tdaBytes);
    const tdaPages = await merged.copyPages(tdaDoc, tdaDoc.getPageIndices());
    tdaPages.forEach(p => merged.addPage(p));

    const interviewDoc = await PDFDocument.load(interviewBytes);
    const interviewPages = await merged.copyPages(interviewDoc, interviewDoc.getPageIndices());
    interviewPages.forEach(p => merged.addPage(p));

    if (customer.dlImageUrl) {
      try {
        await addImagePage(merged, customer.dlImageUrl, 
          `Driver's License — ${customer.firstName} ${customer.lastName}`);
      } catch (err) {
        console.warn('DL image page failed, skipping:', err);
      }
    }
    if (customer.insuranceImageUrl) {
      try {
        await addImagePage(merged, customer.insuranceImageUrl, 
          `Insurance Card — ${customer.firstName} ${customer.lastName}`);
      } catch (err) {
        console.warn('Insurance image page failed, skipping:', err);
      }
    }

    return await merged.save();
  });
}

export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function packetFilename(customer: Customer): string {
  const slug = `${customer.firstName ?? ''}_${customer.lastName ?? ''}`
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'Customer';
  const today = new Date().toISOString().slice(0, 10);
  return `${slug}_TestDrive_${today}.pdf`;
}
