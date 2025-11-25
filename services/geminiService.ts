import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateMedicalResponse = async (query: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: {
        systemInstruction: `You are a specialized medical AI assistant focusing on Nephrology and Blood Purification (Hemodialysis, CRRT, Plasma Exchange). 
        
        Your goal is to explain complex medical mechanics clearly to patients, students, or medical staff.
        
        Context: The user is asking about "clogging" or "coagulation" in blood purification circuits.
        
        Tone: Professional, informative, empathetic, and scientifically accurate but accessible.
        
        Formatting:
        - Use Markdown.
        - Use bolding for key terms.
        - Use bullet points for lists of factors.
        - Structure your answer with clear sections (e.g., "核心原因" (Core Causes), "生理机制" (Physiological Mechanisms), "预防措施" (Prevention)).
        
        Language: Please respond in Chinese (Simplified) as requested by the user context, unless they switch languages.
        `,
        temperature: 0.3, // Lower temperature for more factual responses
      }
    });

    return response.text || "I apologize, I couldn't generate a response at this time.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to fetch response from AI.");
  }
};
