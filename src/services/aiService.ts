import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface ChatResponse {
  updatedFields: Record<string, any>;
  inventoryStockFound?: string;
  message: string;
  hasGoodNotes: boolean;
  notesSummary?: string;
}

const customerSchemaDescription = `
- firstName: string
- lastName: string
- dob: string (date)
- phone: string
- email: string (email)
- address: string
- city: string
- state: string
- zip: string
- dlNumber: string
- dlState: string
- dlExpiration: string (date)
- vehicleStock: string
- vehicleYear: string
- vehicleMake: string
- vehicleModel: string
- vehicleVin: string
- vehicleMiles: string
- insuranceCompany: string
- agentName: string
- hasTradeIn: boolean
- tradeYear: string
- tradeMake: string
- tradeModel: string
- tradeTrim: string
- tradeMileage: string
- tradeVin: string
- stillOwe: boolean
- lienholder: string
- payoffAmount: string
- monthlyPayment: string
- monthsRemaining: string
- goalsMonthlyPayment: string
- goalsMoneyDown: string
- goalsCreditScore: string
`;

export interface ImageData {
  inlineData: {
    data: string;
    mimeType: string;
  };
}

export async function processCustomerChat(
  userInput: string,
  currentData: any,
  chatHistory: { role: 'user' | 'model', parts: { text: string }[] }[],
  image?: ImageData
): Promise<ChatResponse> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const currentDataBlock = `\n\nCURRENT PROFILE STATE (for context — do not re-emit values that are already correct, but DO emit corrections or additions):\n${JSON.stringify(currentData ?? {}, null, 2)}`;

  const systemInstruction = `
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
    - goalsMonthlyPayment, goalsMoneyDown, goalsCreditScore: Customer goals
    - status: Customer status ("active", "inactive", "lead")
 
     RULES:
     1. ONLY return the fields you are confident about.
     2. DATA FORMATTING (CRITICAL):
        - Name Fields: Proper Title Case. Middle Initial should be a single character if possible.
        - Date Fields (dob, dlExpiration): Format as YYYY-MM-DD (ISO 8601). The form uses native HTML date inputs which require this exact format. Example: 1985-04-17. Do NOT use MM/DD/YYYY or any other format.
        - Phone: (XXX) XXX-XXXX.
        - State Fields: 2-letter uppercase code.
       - VIN & Stock Numbers: ALL UPPERCASE.
       - Email: lowercase.
       - Address & City: Proper Title Case.
    3. If an image is provided (like a Driver's License), prioritize extracting all legible facts from it (Name, DOB, Address, DL Number/State/Expiry).
    4. When an image is provided, perform full OCR and emit EVERY field you can read from it — do not stop after the first 2-3 fields.
    5. Always return a 'message' field summarizing what you did (e.g., "I've extracted John's info from his driver's license").
    6. 'hasGoodNotes' should be true if you found extra context not in the fields.
    ${currentDataBlock}
  `;

  try {
    const promptParts: any[] = [{ text: userInput }];
    if (image) {
      promptParts.push(image);
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        ...chatHistory,
        { role: 'user', parts: promptParts }
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
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
                goalsMonthlyPayment: { type: Type.STRING },
                goalsMoneyDown: { type: Type.STRING },
                goalsCreditScore: { type: Type.STRING },
                status: { type: Type.STRING, enum: ["active", "inactive", "lead"] }
              },
              propertyOrdering: [
                "firstName", "middleInitial", "lastName", "dob", "phone", "email",
                "address", "city", "state", "zip", "dlNumber", "dlState", "dlExpiration",
                "vehicleStock", "vehicleYear", "vehicleMake", "vehicleModel", "vehicleVin", "vehicleMiles",
                "insuranceCompany", "agentName", "hasTradeIn", "tradeYear", "tradeMake",
                "tradeModel", "tradeTrim", "tradeMileage", "tradeVin", "stillOwe",
                "lienholder", "payoffAmount", "monthlyPayment", "monthsRemaining",
                "goalsMonthlyPayment", "goalsMoneyDown", "goalsCreditScore", "status"
              ]
            },
            inventoryStockFound: { type: Type.STRING, description: "If a vehicle stock number is found in the text or image, put it here." },
            message: { type: Type.STRING },
            hasGoodNotes: { type: Type.BOOLEAN },
            notesSummary: { type: Type.STRING }
          },
          propertyOrdering: ["updatedFields", "inventoryStockFound", "message", "hasGoodNotes", "notesSummary"],
          required: ["updatedFields", "message", "hasGoodNotes"]
        }
      }
    });

    const resultText = response.text || '{}';
    const parsedResult = JSON.parse(resultText);

    // Defensive normalization: Ensure date fields are ISO YYYY-MM-DD
    const toISODate = (input: any): string | undefined => {
      if (typeof input !== 'string' || !input.trim()) return undefined;
      const s = input.trim();
      // Already ISO
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      // MM-DD-YYYY or MM/DD/YYYY
      const m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
      if (m) {
        const [, mm, dd, yyyy] = m;
        return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
      }
      // Fallback: try Date.parse
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, 10);
      }
      return undefined;
    };

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
