import { GoogleGenAI, Type } from "@google/genai";
import { Customer } from "../types";
import { toISODate } from '../lib/dateNormalizer';

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export interface BulkExtractedRow extends Partial<Customer> {
  lastActionType?: 'note' | 'text' | 'task';
  lastActionDate?: string;
}

export async function extractBulkCustomers(image: { inlineData: { data: string; mimeType: string } }): Promise<BulkExtractedRow[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const systemInstruction = `
    You are an expert OCR and data extraction assistant for a car dealership CRM.
    Your task is to take a screenshot containing a list of customers/prospects from other CRMs or spreadsheets, extract EVERY customer visible, and format them into structured JSON.
    
    EXTRACT THESE FIELDS for each customer:
    - firstName: First name
    - middleInitial: Middle initial (if present)
    - lastName: Last name
    - dob: Date of birth (format: YYYY-MM-DD, ISO 8601)
    - phone: Phone number
    - email: Email address
    - address: Street address
    - city: City
    - state: State code (2-letter)
    - zip: Zip code
    - dlNumber: Driver's license number
    - dlState: License state
    - dlExpiration: License expiration date (format: YYYY-MM-DD, ISO 8601)
    - vehicleStock, vehicleYear, vehicleMake, vehicleModel, vehicleVin, vehicleMiles: Vehicle of interest (i.e. the vehicle the customer wants to buy). A vehicle tagged "(New)" or "(Used)" in the source MUST map to these fields, NEVER to trade-in fields. A vehicle described as "interested in" or "lead vehicle" MUST also map here.
    - hasTradeIn (boolean) + tradeYear, tradeMake, tradeModel, tradeTrim, tradeMileage, tradeVin: Trade-In (i.e. the vehicle the customer is giving up). A vehicle tagged "(Trade-In)" in the source MUST map here and you MUST set hasTradeIn=true. A vehicle described as "trade", "trade-in", or "giving up" MUST also map here.
    - leadSource: The lead source string from the source row. Extract from text like "- Source: Showroom Floor / Manual / Walk-In" → "Showroom Floor / Manual / Walk-In". Preserve casing and separators exactly as shown.
    - leadGeneratedDate: The "Generated a Lead" date for this customer, formatted as YYYY-MM-DD. Extract from text like "Generated a Lead: 05/31/2025" → "2025-05-31".
    - pendingInterestNotes: If a customer has MORE THAN ONE vehicle of interest (multiple vehicles tagged "(New)" or "(Used)" — NOT the trade-in), put the FIRST one into the vehicleXxx fields, and put any additional ones into this field as human-readable lines joined by "; ". Example: "Also interested: 2017 Ram 1500 (Used); 2014 Honda Civic (Used)". If there is only one vehicle of interest, omit this field.
    - insuranceCompany, agentName: Insurance details
    - stillOwe, lienholder, payoffAmount, monthlyPayment, monthsRemaining: Financial details
    - payingCash: true if the customer indicated they are paying cash for the new vehicle; false otherwise (financing or unspecified)
    - goalsMonthlyPayment, goalsMoneyDown, goalsCreditScore: Customer goals
    - customerDesiredTradeValue: Customer's desired trade value
    - status: Customer funnel position. Default to "lead" unless the source clearly indicates another value. One of: "lead", "sold", "inactive". (Bulk-imported customers should almost always be "lead".)
    - lastActionType: The type of the most recent dealer action shown in the "Last Action" column, if present. ONLY emit one of: "note" (e.g. "New Note"), "text" (e.g. "Text Message", "New Text"), or "task" (e.g. "New Task"). If the Last Action is anything else (Voicemail, Email, Call, etc.) OR the column is empty, OMIT this field.
    - lastActionDate: The date of the most recent Last Action, formatted as YYYY-MM-DD. Extract from text like "New Note (05/20/2026 05:30 AM)" → "2026-05-20". If no Last Action date is present, omit this field.

    RULES:
    1. Extract ALL customers visible in the screenshot. Do not stop at the first few.
    2. DATA FORMATTING (CRITICAL):
       - Name Fields: Proper Title Case. Middle Initial should be a single character if possible.
       - Date Fields (dob, dlExpiration): Format as YYYY-MM-DD (ISO 8601). Example: 1985-04-17. Do NOT use MM/DD/YYYY or MM-DD-YYYY in the final field.
       - Phone: (XXX) XXX-XXXX.
       - State Fields: 2-letter uppercase code.
       - VIN & Stock Numbers: ALL UPPERCASE.
       - Email: lowercase.
       - Address & City: Proper Title Case.
    3. If any fields are blank or not present for a customer, omit them or set them appropriately (do not invent information).
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        image,
        { text: "Extract all customers from this screenshot." }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            customers: {
              type: Type.ARRAY,
              description: "The list of extracted customers from the screenshot.",
              items: {
                type: Type.OBJECT,
                properties: {
                  firstName: { type: Type.STRING },
                  middleInitial: { type: Type.STRING },
                  lastName: { type: Type.STRING },
                  dob: { type: Type.STRING },
                  phone: { type: Type.STRING },
                  email: { type: Type.STRING },
                  address: { type: Type.STRING },
                  city: { type: Type.STRING },
                  state: { type: Type.STRING },
                  zip: { type: Type.STRING },
                  dlNumber: { type: Type.STRING },
                  dlState: { type: Type.STRING },
                  dlExpiration: { type: Type.STRING },
                  vehicleStock: { type: Type.STRING },
                  vehicleYear: { type: Type.STRING },
                  vehicleMake: { type: Type.STRING },
                  vehicleModel: { type: Type.STRING },
                  vehicleVin: { type: Type.STRING },
                  vehicleMiles: { type: Type.STRING },
                  insuranceCompany: { type: Type.STRING },
                  agentName: { type: Type.STRING },
                  hasTradeIn: { type: Type.BOOLEAN },
                  tradeYear: { type: Type.STRING },
                  tradeMake: { type: Type.STRING },
                  tradeModel: { type: Type.STRING },
                  tradeTrim: { type: Type.STRING },
                  tradeMileage: { type: Type.STRING },
                  tradeVin: { type: Type.STRING },
                  stillOwe: { type: Type.BOOLEAN },
                  payingCash: { type: Type.BOOLEAN },
                  lienholder: { type: Type.STRING },
                  payoffAmount: { type: Type.STRING },
                  monthlyPayment: { type: Type.STRING },
                  monthsRemaining: { type: Type.STRING },
                  goalsMonthlyPayment: { type: Type.STRING },
                  goalsMoneyDown: { type: Type.STRING },
                  goalsCreditScore: { type: Type.STRING },
                  customerDesiredTradeValue: { type: Type.STRING },
                  status: { type: Type.STRING, enum: ["lead", "sold", "inactive"] },
                  leadSource: { type: Type.STRING },
                  leadGeneratedDate: { type: Type.STRING },
                  pendingInterestNotes: { type: Type.STRING },
                  lastActionType: { type: Type.STRING, enum: ["note", "text", "task"] },
                  lastActionDate: { type: Type.STRING }
                },
                propertyOrdering: [
                  "firstName", "middleInitial", "lastName", "dob", "phone", "email",
                  "address", "city", "state", "zip", "dlNumber", "dlState", "dlExpiration",
                  "vehicleStock", "vehicleYear", "vehicleMake", "vehicleModel", "vehicleVin", "vehicleMiles",
                  "insuranceCompany", "agentName", "hasTradeIn", "tradeYear", "tradeMake",
                  "tradeModel", "tradeTrim", "tradeMileage", "tradeVin", "stillOwe",
                  "lienholder", "payoffAmount", "monthlyPayment", "monthsRemaining", "payingCash",
                  "goalsMonthlyPayment", "goalsMoneyDown", "goalsCreditScore", "customerDesiredTradeValue", "status",
                  "leadSource", "leadGeneratedDate", "pendingInterestNotes", "lastActionType", "lastActionDate"
                ]
              }
            }
          },
          required: ["customers"],
          propertyOrdering: ["customers"]
        }
      }
    });

    const text = response.text || "{}";
    const parsed = JSON.parse(text);
    const customersArray = parsed.customers || [];

    // Normalize date fields for any returned row
    for (const c of customersArray) {
      if (c.dob) {
        const iso = toISODate(c.dob);
        if (iso) c.dob = iso;
        else delete c.dob;
      }
      if (c.dlExpiration) {
        const iso = toISODate(c.dlExpiration);
        if (iso) c.dlExpiration = iso;
        else delete c.dlExpiration;
      }
      if (c.leadGeneratedDate) {
        const iso = toISODate(c.leadGeneratedDate);
        if (iso) c.leadGeneratedDate = iso;
        else delete c.leadGeneratedDate;
      }
      if (c.lastActionDate) {
        const iso = toISODate(c.lastActionDate);
        if (iso) c.lastActionDate = iso;
        else delete c.lastActionDate;
      }
    }

    return customersArray;
  } catch (error) {
    console.error("Bulk extraction error:", error);
    return [];
  }
}
