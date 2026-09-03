import { GoogleGenAI, Type } from "@google/genai";
import { Customer } from "../types";
import { toISODate } from '../lib/dateNormalizer';
import { CaptureIntent, INTENT_FIELDS, filterByIntent } from '../lib/captureIntent';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface ChatResponse {
  updatedFields: Record<string, unknown>;
  inventoryStockFound?: string;
  message: string;
  hasGoodNotes: boolean;
  notesSummary?: string;
  documentType?: 'license' | 'insurance' | 'window_sticker' | 'other';
  unreadFields?: string[];
  insuredVehicle?: { year?: string; make?: string; model?: string; vin?: string };
}

export interface ImageData {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

import { timed } from '../lib/timing';

type ScopedIntent = Exclude<CaptureIntent, 'other'>;

const INTENT_FIELD_DOCS: Record<ScopedIntent, string> = {
  trade: `    - tradeYear: Trade-in vehicle model year
    - tradeMake: Trade-in vehicle make
    - tradeModel: Trade-in vehicle model
    - tradeTrim: Trade-in vehicle trim level
    - tradeMileage: Trade-in vehicle mileage/odometer reading
    - tradeVin: Trade-in vehicle VIN
    - hasTradeIn: Set true when any trade-in detail is found`,
  vehicle: `    - vehicleStock: Dealer stock number
    - vehicleYear: Vehicle model year
    - vehicleMake: Vehicle make
    - vehicleModel: Vehicle model
    - vehicleVin: Vehicle VIN
    - vehicleMiles: Vehicle mileage/odometer reading`,
  insurance: `    - insuranceCompany: Insurance company name
    - agentName: Insurance agent name`,
  license: `    - firstName: First name
    - middleInitial: Middle initial (single character if possible)
    - lastName: Last name
    - dob: Date of birth (format: YYYY-MM-DD, ISO 8601)
    - address: Street address
    - city: City
    - state: State code (2-letter)
    - zip: Zip code
    - dlNumber: Driver's license number
    - dlState: License state (2-letter)
    - dlExpiration: License expiration date (format: YYYY-MM-DD, ISO 8601)`,
};

const INTENT_CONTEXT: Record<ScopedIntent, string> = {
  trade: "the customer's TRADE-IN vehicle (a VIN sticker, door jamb label, registration, odometer, or a description of the vehicle they are giving up)",
  vehicle: "the NEW VEHICLE the customer wants to buy (a window sticker, VIN sticker, stock tag, or a description of the vehicle of interest)",
  insurance: "the customer's INSURANCE CARD",
  license: "the customer's DRIVER'S LICENSE",
};

const INTENT_EXTRAS: Record<ScopedIntent, string> = {
  trade: '',
  vehicle: `    6. If a dealer stock number is found, also put it in 'inventoryStockFound'.`,
  insurance: `    6. The insured vehicle(s) printed on the card do NOT belong in updatedFields. Put the primary insured vehicle's year, make, model, and VIN into 'insuredVehicle' instead. If several vehicles are listed, use the first one.`,
  license: '',
};

function buildScopedSystemInstruction(intent: ScopedIntent): string {
  return `
    You are an expert data extraction assistant for a car dealership CRM.
    The user is capturing ${INTENT_CONTEXT[intent]} for a customer profile.
    Extract ONLY the fields listed below. Ignore every other detail in the input or image, even when it is clearly legible — names, other vehicles, policy numbers, and anything else outside this list must NOT be emitted.

    EXTRACT THESE FIELDS (use these exact keys):
${INTENT_FIELD_DOCS[intent]}

    RULES:
    1. Return your best reading even when you are not fully certain. Never invent data that is not present.
    2. DATA FORMATTING (CRITICAL):
       - Date fields: YYYY-MM-DD (ISO 8601). Do NOT use MM/DD/YYYY or any other format.
       - VIN & Stock Numbers: ALL UPPERCASE.
       - Name, Address & City fields: Proper Title Case.
       - State fields: 2-letter uppercase code.
    3. When an image is provided, perform full OCR and emit EVERY listed field you can read — do not stop after the first 2-3 fields.
    4. If a listed field is visible on the document but too blurry or damaged to read, add its human-readable name (e.g. "mileage") to 'unreadFields' instead of guessing.
    5. Always return a 'message' field summarizing what you extracted.
${INTENT_EXTRAS[intent]}
  `;
}

const BOOLEAN_INTENT_FIELDS = new Set(['hasTradeIn']);

function buildScopedResponseSchema(intent: ScopedIntent) {
  const fieldProps: Record<string, { type: Type }> = {};
  for (const f of INTENT_FIELDS[intent]) {
    fieldProps[f] = { type: BOOLEAN_INTENT_FIELDS.has(f) ? Type.BOOLEAN : Type.STRING };
  }

  const properties: Record<string, unknown> = {
    updatedFields: {
      type: Type.OBJECT,
      properties: fieldProps,
      propertyOrdering: [...INTENT_FIELDS[intent]],
    },
    message: { type: Type.STRING },
    unreadFields: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Human-readable names of listed fields that are visible but unreadable.",
    },
  };
  const propertyOrdering = ['updatedFields', 'message', 'unreadFields'];

  if (intent === 'vehicle') {
    properties.inventoryStockFound = {
      type: Type.STRING,
      description: "If a vehicle stock number is found in the text or image, put it here.",
    };
    propertyOrdering.push('inventoryStockFound');
  }
  if (intent === 'insurance') {
    properties.insuredVehicle = {
      type: Type.OBJECT,
      properties: {
        year: { type: Type.STRING },
        make: { type: Type.STRING },
        model: { type: Type.STRING },
        vin: { type: Type.STRING },
      },
      propertyOrdering: ['year', 'make', 'model', 'vin'],
    };
    propertyOrdering.push('insuredVehicle');
  }

  return {
    type: Type.OBJECT,
    properties,
    propertyOrdering,
    required: ['updatedFields', 'message'],
  };
}

export async function processCustomerChat(
  userInput: string,
  currentData: Partial<Customer>,
  chatHistory: { role: 'user' | 'model', parts: { text: string }[] }[],
  image?: ImageData,
  intent: CaptureIntent = 'other'
): Promise<ChatResponse> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const currentDataBlock = `\n\nCURRENT PROFILE STATE (for context — emit corrections and additions as needed):\n${JSON.stringify(currentData ?? {}, null, 2)}`;

  const systemInstruction = intent !== 'other' ? buildScopedSystemInstruction(intent) : `
    You are an expert data extraction assistant for a car dealership CRM.
    Your task is to take natural language input OR images (like driver's licenses, insurance cards, or vehicle VIN stickers) and map them to specific database fields.

    EXTRACT THESE FIELDS (use these exact keys):
    - firstName: First name
    - middleInitial: Middle initial (if present on license)
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
    - vehicleStock, vehicleYear, vehicleMake, vehicleModel, vehicleVin, vehicleMiles: Vehicle details
    - tradeYear, tradeMake, tradeModel, tradeTrim, tradeMileage, tradeVin: Trade-in details
    - insuranceCompany, agentName: Insurance details
    - stillOwe, lienholder, payoffAmount, monthlyPayment, monthsRemaining: Financial details
    - payingCash: true if the customer indicated they are paying cash for the new vehicle; false otherwise (financing or unspecified)
    - goalsMonthlyPayment, goalsMoneyDown, goalsCreditScore: Customer goals
    - customerDesiredTradeValue: Customer's desired trade-in value (what they're asking for the trade).
    - status: Customer funnel position. One of: "lead" (default — in the buying funnel; displayed to dealers as "Unsold"), "sold" (already bought), "inactive" (lead went cold). Default to "lead" if unclear.
    - leadSourceType: Structured source tag. ONLY emit one of: "walk-in" (customer walked into the dealership), "crm" (CRM lead / phone up), or "vep" (Vehicle Exchange Program / Service Customer). Do NOT emit other values — Dealer Wizard, FB Marketplace, and any other source require manual dealer entry via the profile chip. If the source is unclear, omit the field.
    - purchaseDate: Date the customer bought their vehicle (YYYY-MM-DD)
 
     VEHICLE CLASSIFICATION GUIDANCE (CRITICAL FOR ACCURATE EXTRACTION):
     - A vehicle the customer wants to BUY maps to vehicleYear, vehicleMake, vehicleModel, vehicleVin, vehicleStock, vehicleMiles.
     - A vehicle the customer currently owns or is giving up — including any vehicle shown under a 'Currently Owns', 'Garage', 'Current Vehicle', or 'Trade-In' heading, or described as a trade — maps to tradeYear, tradeMake, tradeModel, tradeTrim, tradeMileage, tradeVin, and you MUST set hasTradeIn = true.
     - If both a purchase vehicle and an owned/trade vehicle appear, fill BOTH sets. Never put the same vehicle in both.
     - If multiple owned vehicles appear, use the one with the newest model year for the trade fields.

     RULES:
     1. Extract EVERY field that appears in the input, including hard-to-read ones like VIN, ZIP, and phone. Return your best reading even when you are not fully certain. Never invent data that is not present, but never omit a field just because it is difficult to read.
     2. DATA FORMATTING (CRITICAL):
        - Name Fields: Proper Title Case. Middle Initial should be a single character if possible.
        - Date Fields (dob, dlExpiration, purchaseDate): Format as YYYY-MM-DD (ISO 8601). The form uses native HTML date inputs which require this exact format. Example: 1985-04-17. Do NOT use MM/DD/YYYY or any other format.
        - Phone: (XXX) XXX-XXXX.
        - State Fields: 2-letter uppercase code.
       - VIN & Stock Numbers: ALL UPPERCASE.
       - Email: lowercase.
       - Address & City: Proper Title Case.
    3. If an image is provided (like a Driver's License), prioritize extracting all legible facts from it (Name, DOB, Address, DL Number/State/Expiry).
    4. When an image is provided, perform full OCR and emit EVERY field you can read from it — do not stop after the first 2-3 fields.
    5. Always return a 'message' field summarizing what you did (e.g., "I've extracted John's info from his driver's license").
    6. Only set hasGoodNotes true for facts about the car-buying relationship — payment/budget goals, trade intentions, objections, timeline, vehicle preferences, or family/usage needs. Ignore incidental document text such as amounts paid, policy numbers, barcodes, or data already captured in a structured field. If nothing deal-relevant is present, omit the note.
    7. When an image is provided, set 'documentType' to one of: 'license' (driver's license), 'insurance' (insurance ID card), 'window_sticker' (vehicle Monroney sticker / dealer addendum), or 'other'. When no image is provided, omit documentType.
    ${currentDataBlock}
  `;

  try {
    const promptParts: ({ text: string } | ImageData)[] = [{ text: userInput }];
    if (image) {
      promptParts.push(image);
    }

    const response = await timed('aiService.processCustomerChat', async () => {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          ...chatHistory,
          { role: 'user', parts: promptParts }
        ],
        config: {
          systemInstruction,
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: intent !== 'other' ? buildScopedResponseSchema(intent) : {
            type: Type.OBJECT,
            properties: {
              updatedFields: { 
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
                  lienholder: { type: Type.STRING },
                  payoffAmount: { type: Type.STRING },
                  monthlyPayment: { type: Type.STRING },
                  monthsRemaining: { type: Type.STRING },
                  payingCash: { type: Type.BOOLEAN },
                  goalsMonthlyPayment: { type: Type.STRING },
                  goalsMoneyDown: { type: Type.STRING },
                  goalsCreditScore: { type: Type.STRING },
                  customerDesiredTradeValue: { type: Type.STRING },
                  status: { type: Type.STRING, enum: ["lead", "sold", "inactive"] },
                  leadSourceType: { type: Type.STRING, enum: ["walk-in", "crm", "vep"] },
                  purchaseDate: { type: Type.STRING }
                },
                propertyOrdering: [
                  "firstName", "middleInitial", "lastName", "dob", "phone", "email",
                  "address", "city", "state", "zip", "dlNumber", "dlState", "dlExpiration",
                  "vehicleStock", "vehicleYear", "vehicleMake", "vehicleModel", "vehicleVin", "vehicleMiles",
                  "insuranceCompany", "agentName", "hasTradeIn", "tradeYear", "tradeMake",
                  "tradeModel", "tradeTrim", "tradeMileage", "tradeVin", "stillOwe",
                  "lienholder", "payoffAmount", "monthlyPayment", "monthsRemaining", "payingCash",
                  "goalsMonthlyPayment", "goalsMoneyDown", "goalsCreditScore", "customerDesiredTradeValue", "status", "leadSourceType", "purchaseDate"
                ]
              },
              inventoryStockFound: { type: Type.STRING, description: "If a vehicle stock number is found in the text or image, put it here." },
              message: { type: Type.STRING },
              hasGoodNotes: { type: Type.BOOLEAN },
              notesSummary: { type: Type.STRING },
              documentType: { 
                type: Type.STRING, 
                enum: ['license', 'insurance', 'window_sticker', 'other'] 
              }
            },
            propertyOrdering: ["updatedFields", "inventoryStockFound", "message", "hasGoodNotes", "notesSummary", "documentType"],
            required: ["updatedFields", "message", "hasGoodNotes"]
          }
        }
      });
    });

    const resultText = response.text || '{}';
    const parsedResult = JSON.parse(resultText);

    if (intent !== 'other') {
      // Belt-and-braces guard: the scoped schema already limits what the model
      // can emit, but drop anything outside the intent's whitelist regardless.
      parsedResult.updatedFields = filterByIntent(parsedResult.updatedFields ?? {}, intent);
      parsedResult.hasGoodNotes = false;
      delete parsedResult.notesSummary;
      if (image && intent === 'license') parsedResult.documentType = 'license';
      if (image && intent === 'insurance') parsedResult.documentType = 'insurance';
    }

    if (parsedResult.updatedFields?.dob) {
      const iso = toISODate(parsedResult.updatedFields.dob);
      if (iso) parsedResult.updatedFields.dob = iso;
      else delete parsedResult.updatedFields.dob;
    }
    if (parsedResult.updatedFields?.dlExpiration) {
      const iso = toISODate(parsedResult.updatedFields.dlExpiration);
      if (iso) parsedResult.updatedFields.dlExpiration = iso;
      else delete parsedResult.updatedFields.dlExpiration;
    }
    if (parsedResult.updatedFields?.purchaseDate) {
      const iso = toISODate(parsedResult.updatedFields.purchaseDate);
      if (iso) parsedResult.updatedFields.purchaseDate = iso;
      else delete parsedResult.updatedFields.purchaseDate;
    }

    const uf = parsedResult.updatedFields as Record<string, unknown> | undefined;
    if (uf) {
      const hasValue = (k: string) => {
        const v = uf[k];
        return v !== null && v !== undefined && String(v).trim() !== '';
      };
      const hasTradeData = ['tradeYear', 'tradeMake', 'tradeModel', 'tradeTrim', 'tradeMileage', 'tradeVin'].some(hasValue);
      const hasFinancialData = ['lienholder', 'payoffAmount', 'monthlyPayment', 'monthsRemaining'].some(hasValue);
      if (hasTradeData || hasFinancialData) uf.hasTradeIn = true;
      if (hasFinancialData) uf.stillOwe = true;
    }

    if (
      parsedResult.documentType === 'license' ||
      parsedResult.documentType === 'insurance' ||
      parsedResult.documentType === 'window_sticker'
    ) {
      parsedResult.hasGoodNotes = false;
      delete parsedResult.notesSummary;
    }

    return parsedResult as ChatResponse;
  } catch (error) {
    console.error("AI Error:", error);
    return {
      updatedFields: {},
      message: "I'm sorry, I had trouble processing that. Could you try again?",
      hasGoodNotes: false
    };
  }
}
