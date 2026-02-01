
import { GoogleGenAI, Type } from "@google/genai";
import { StockItem } from "../types";

export const analyzeStockWithAI = async (items: StockItem[]) => {
  try {
    // The Google GenAI SDK client must be initialized using the process.env.API_KEY directly.
    // The apiKey parameter must be passed as a named parameter.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const prompt = `Analyse l'état des stocks pour ce bar d'hôtel. Voici les données: ${JSON.stringify(items)}. Fournis un résumé, des alertes et des recommandations.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            alerts: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["summary", "alerts", "recommendations"]
        }
      }
    });

    // Directly access the .text property of GenerateContentResponse to retrieve the output string.
    const responseText = response.text;
    if (!responseText) {
      return null;
    }
    
    return JSON.parse(responseText.trim());
  } catch (error) {
    console.error("Erreur Gemini (Fetch ou API):", error);
    // Return null to allow the UI to handle the missing data gracefully
    return null;
  }
};
