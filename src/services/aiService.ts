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

  const systemInstruction = `
    You are an expert data extraction assistant for a car dealership CRM.
    Your task is to take natural language input OR images (like driver's licenses, insurance cards, or vehicle VIN stickers) and map them to specific database fields.

    EXTRACT THESE FIELDS (use these exact keys):
    - firstName: First name
    - middleInitial: Middle initial (if present on license)
    - lastName: Last name (split from full name if provided)
    - dob: Date of birth (format: YYYY-MM-DD or readable)
    - phone: Phone number
    - email: Email address
    - address: Street address
    - city: City
    - state: State code (2-letter)
    - zip: Zip code
    - dlNumber: Driver's license number
    - dlState: License state
    - dlExpiration: License expiration date
    - vehicleYear, vehicleMake, vehicleModel, vehicleVin: Vehicle details
    - tradeYear, tradeMake, tradeModel, tradeVin: Trade-in details
    - insuranceCompany: Insurance provider
    - agentName: Insurance agent name

    RULES:
    1. ONLY return the fields you are confident about.
    2. DATA FORMATTING (CRITICAL):
       - Name Fields: Proper Title Case. Middle Initial should be a single character if possible.
       - Date Fields: Format as MM-DD-YYYY.
       - Phone: (XXX) XXX-XXXX.
       - State Fields: 2-letter uppercase code.
       - VIN & Stock Numbers: ALL UPPERCASE.
       - Email: lowercase.
       - Address & City: Proper Title Case.
    3. If an image is provided (like a Driver's License), prioritize extracting all legible facts from it (Name, DOB, Address, DL Number/State/Expiry).
    4. Always return a 'message' field summarizing what you did (e.g., "I've extracted John's info from his driver's license").
    5. 'hasGoodNotes' should be true if you found extra context not in the fields.
  `;

  try {
    const promptParts: any[] = [{ text: userInput }];
    if (image) {
      promptParts.push(image);
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
                insuranceCompany: { type: Type.STRING },
                agentName: { type: Type.STRING },
                hasTradeIn: { type: Type.BOOLEAN },
                tradeYear: { type: Type.STRING },
                tradeMake: { type: Type.STRING },
                tradeModel: { type: Type.STRING },
                tradeVin: { type: Type.STRING }
              }
            },
            inventoryStockFound: { type: Type.STRING, description: "If a vehicle stock number is found in the text or image, put it here." },
            message: { type: Type.STRING },
            hasGoodNotes: { type: Type.BOOLEAN },
            notesSummary: { type: Type.STRING }
          },
          required: ["updatedFields", "message", "hasGoodNotes"]
        }
      }
    });

    const resultText = response.text || '{}';
    const parsedResult = JSON.parse(resultText);
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
