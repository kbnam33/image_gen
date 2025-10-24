import { GoogleGenAI, Modality, Part } from "@google/genai";
import type { Base64Image } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fileToBase64 = (file: File): Promise<Base64Image> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      if (!base64Data) {
        reject(new Error("Failed to extract base64 data from file."));
        return;
      }
      resolve({ data: base64Data, mimeType: file.type });
    };
    reader.onerror = (error) => reject(error);
  });
};

export const generatePrompt = async (
  productImage: Base64Image,
  userIntent: string,
  aspectRatio: string,
  lighting: string,
  perspective: string,
  referenceImage?: Base64Image,
  previousPrompt?: string
): Promise<string> => {
  try {
    const contextInstruction = previousPrompt
      ? `The previous creative prompt was: "${previousPrompt}". Use this as context. The user's new goal should modify or build upon this, unless they ask for something completely different.`
      : 'Your task is to generate a detailed, creative, and descriptive prompt for an AI image generator to create a professional e-commerce product showcase image of that exact product.';
      
    const textPrompt = `Analyze the main product in the first image provided. ${contextInstruction}

The user's specific goal is: "${userIntent || 'Create a beautiful product shot.'}"

Incorporate the following characteristics into the prompt:
- Aspect Ratio: ${aspectRatio}
- Lighting Style: ${lighting}
- Camera Perspective: ${perspective}
${referenceImage ? '\n- Style Reference: The style, mood, color palette, and composition should be inspired by the second provided image (the style reference). Analyze it and incorporate its aesthetic into the final prompt.' : ''}

The output should ONLY be the prompt text itself, without any introductory phrases like "Here is a prompt:". The prompt must describe the original product (its colors, texture, type, etc.) accurately within the new scene you create.`;

    const parts: Part[] = [{ inlineData: productImage }];
    if (referenceImage) {
      parts.push({ inlineData: referenceImage });
    }
    parts.push({ text: textPrompt });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts }
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error generating prompt:", error);
    throw new Error("Failed to call the Gemini API. Please try again.");
  }
};

export const generateImage = async (
  productImage: Base64Image,
  sceneDescription: string,
  isHDUpscaleMode: boolean,
  preserveProduct: boolean,
): Promise<string> => {
  let finalPrompt = sceneDescription;

  if (isHDUpscaleMode) {
      const preservationRule = preserveProduct
          ? "1.  **Preserve the Product:** The product from the input image must be perfectly recreated in the new photo. All its details—color, texture, design, pattern, fabric—must be preserved with extreme fidelity. DO NOT change the product itself."
          : "1.  **Reference the Product:** Use the product from the input image as a clear reference. Recreate it with high fidelity, but you have creative freedom to change its angle, drape, or condition to better fit the new scene. The core design, color, and material must remain consistent.";
      
      finalPrompt = `**Primary Instruction:** Your task is to generate a new, ultra-realistic product photograph based on the input image. You MUST adhere to the following rules:
${preservationRule}
2.  **Create a New Scene:** Place the product in a completely new environment as described in the 'Scene Description' below. The original background and composition must be replaced entirely.
3.  **Emulate Professional Photography:** The final image must have the quality of a shot from a high-end Sony Alpha camera with a G Master lens, ensuring it is tack-sharp, crystal clear, and free of any digital artifacts.

**Scene Description:**
${sceneDescription}`;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: finalPrompt },
          { inlineData: productImage },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data found in the API response.");
  } catch (error) {
    console.error("Error generating image:", error);
    throw new Error("Failed to generate the image. The model may have refused the request. Please check your prompt and try again.");
  }
};

export const editImageWithAnnotation = async (
  originalImage: Base64Image,
  maskImage: Base64Image,
  editText: string
): Promise<string> => {
  try {
    const finalPrompt = `You are an expert photo editor. Use the second image as a mask to identify the region of interest in the first image. Edit ONLY the masked region based on the following instruction: "${editText}". The rest of the image must remain unchanged, preserving the original quality and details outside the masked area.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: finalPrompt },
          { inlineData: originalImage },
          { inlineData: maskImage },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data found in the API response.");
  } catch (error) {
    console.error("Error editing image:", error);
    throw new Error("Failed to edit the image. The model may have refused the request. Please check your instruction and try again.");
  }
};