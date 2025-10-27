import { GoogleGenAI, Modality, Part } from "@google/genai";
import type { Base64Image } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fileToBase64 = (file: File): Promise<Base64Image> => {
  // FIX: Swapped `reject` and `resolve` to match the Promise constructor signature.
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
  preserveBackground: boolean,
  referenceImage?: Base64Image,
  previousPrompt?: string
): Promise<string> => {
  try {
     let textPrompt = '';

    if (previousPrompt) {
      const referenceImageInstruction = referenceImage
        ? `*   **Style Reference Image:** (The second image provided). This is an important input for guiding the style.`
        : '';
        
      if (preserveBackground) {
         // Iterative prompt, PRESERVING background
        textPrompt = `You are an expert visual prompt engineer. Your task is to subtly modify an existing prompt to achieve a new user goal while preserving the core background scene.

**PROCESS:**

1.  **Analyze Inputs:**
    *   **Previous Prompt:** "${previousPrompt}"
    *   **User's Goal:** "${userIntent || 'Make a subtle improvement.'}"
    ${referenceImageInstruction}

2.  **Rewrite Procedure:**
    *   **Step A: Identify Core Scene:** Read the "Previous Prompt" and understand the main product and its surrounding scene (background, floor, lighting).
    *   **Step B: Apply Modifications:** Intelligently modify the scene description based *only* on the "User's Goal". For example, if the goal is "make the lighting warmer," you should only adjust words related to light and color temperature, leaving the floor and background descriptions intact. If a reference image is provided, use it as inspiration for the *changes*, not as a replacement for the whole scene.
    *   **Step C: Synthesize Final Prompt:** Create a new, cohesive prompt that incorporates the requested changes while maintaining the original, unchanged elements of the scene. Ensure it includes: Aspect Ratio: ${aspectRatio}, Lighting Style: ${lighting}, Camera Perspective: ${perspective}.

**CRITICAL:** Your output must be ONLY the final, rewritten prompt text.`;
      } else {
        // Iterative prompt, REPLACING background
        const sceneInstruction = referenceImage
            ? `The new scene **must** be a detailed, photorealistic description of the environment in the **Style Reference Image** (the second image provided). Analyze its materials, textures, colors, lighting, and shadow patterns.`
            : `You must create a completely new scene based on the "User's Goal".`;

        textPrompt = `You are a master prompt writer for an AI image generator. Your task is to create a new prompt by combining the product description from a previous prompt with a brand new scene.

**Previous Prompt:** "${previousPrompt}"
**User's Goal:** "${userIntent || 'Create a new scene based on the reference.'}"
${referenceImage ? '**Style Reference Image:** The second image provided. It defines the NEW background, lighting, and mood.' : ''}

**Instructions:**
1.  **Extract Product:** Read the "Previous Prompt" and copy ONLY the description of the main product (e.g., "a vibrant mustard yellow saree with green borders...").
2.  **Create New Scene:** ${sceneInstruction} This new scene description MUST completely replace the old scene from the "Previous Prompt".
3.  **Combine:** Create a new, single-paragraph prompt. Start with the product description you extracted, then seamlessly integrate the new scene description you created.
4.  **Incorporate Parameters:** Ensure the final prompt text includes: Aspect Ratio: ${aspectRatio}, Lighting Style: ${lighting}, Camera Perspective: ${perspective}.

**Example Logic:** If the old prompt was "A red ball on a wooden table" and the User's Goal is "put it on a beach", your new prompt should describe "A red ball on a sandy beach," with rich detail about the sand and sun. You MUST NOT mention the wooden table.

**CRITICAL:** Your output must be ONLY the final, rewritten prompt text. Do not include your reasoning or any extra text.`;
      }
    } else {
       if (preserveBackground) {
        // Initial prompt generation (Preserve Background mode): AI describes the current scene and enhances it.
        textPrompt = `Act as a professional photo analyst. Your task is to describe the provided image (product and background) in photorealistic detail. Then, subtly modify that description to incorporate the user's goal, enhancing the existing photo rather than creating a new scene.

User's Goal: "${userIntent || 'Subtly enhance the photo.'}"

Ensure your final prompt reflects:
- Aspect Ratio: ${aspectRatio}
- Lighting Style: ${lighting}
- Camera Perspective: ${perspective}
${referenceImage ? '\n- Style Reference: The style, mood, and color palette should be subtly shifted to be more like the second provided image (the style reference).' : ''}

Output ONLY the final, detailed prompt text.`;
       } else {
        // Initial prompt generation (New Scene mode).
        const sceneInstruction = referenceImage
            ? `
**Instructions:**
1.  **Analyze the Product (Image 1):** Describe the product in the first image in photorealistic detail. Note its material, color, pattern, texture, and how it is arranged.
2.  **Analyze the Scene (Image 2):** Describe the environment in the second image in photorealistic detail. Note the floor/surface material, color, texture, background walls, lighting (source, quality, direction), and shadows (sharpness, color).
3.  **Combine:** Synthesize your analyses into a single, cohesive paragraph. The prompt must create a photorealistic image of the product from Image 1 existing naturally within the scene from Image 2.

**CRITICAL:** Do NOT describe the background from Image 1. The new scene MUST be based entirely on Image 2.`
            : `
**Instructions:**
1.  **Analyze the Product (Image 1):** Describe the product in the first image in photorealistic detail.
2.  **Create a New Scene:** Invent a new, professional e-commerce scene based on the "User Goal for guidance".
3.  **Combine:** Synthesize your analyses into a single, cohesive paragraph.`;

        textPrompt = `You are an expert photorealistic prompt writer. You will be given one or two images.
- **Image 1 (Product Image):** Always provided. Contains the product to be photographed.
- **Image 2 (Style Reference):** Optional. If provided, it contains the scene (background, lighting, mood) for the photograph.

Your task is to write a single, detailed prompt to generate a new image.

${sceneInstruction}

**User Goal for guidance:** "${userIntent || 'Create a beautiful product shot.'}"

Finally, incorporate these required parameters into the prompt text:
- Aspect Ratio: ${aspectRatio}
- Lighting Style: ${lighting}
- Camera Perspective: ${perspective}

Your output must be ONLY the final prompt text.`;
      }
    }

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
  preserveBackground: boolean,
): Promise<string> => {
  let finalPrompt = sceneDescription;

  if (isHDUpscaleMode) {
      const preservationRule = preserveProduct
          ? `1.  **Product Preservation Mandate:** This is the most critical rule. The product shown in the input image must be extracted and placed into the new scene without any modifications. Treat the product as a fixed, unchangeable asset. Every single detail—the exact pattern, weave of the fabric, color saturation, texture, and any imperfections—must be replicated with 1:1 accuracy. Do not reinterpret, improve, or alter the product in any way. The final output should look as if the original product was expertly photoshopped into the new scene.`
          : "1.  **Reference the Product:** Use the product from the input image as a clear reference. Recreate it with high fidelity, but you have creative freedom to change its angle, drape, or condition to better fit the new scene. The core design, color, and material must remain consistent.";
      
      const sceneRule = preserveBackground
        ? "2.  **Preserve the Scene:** The original background and composition must be used as the base for the new image. Do not replace it entirely. You should only make modifications as described in the 'Scene Description'."
        : "2.  **Create a New Scene:** Place the product in a completely new environment as described in the 'Scene Description' below. The original background and composition must be replaced entirely.";

      finalPrompt = `**Primary Instruction:** Your task is to generate a new, ultra-realistic product photograph based on the input image. You MUST adhere to the following rules:
${preservationRule}
${sceneRule}
3.  **Emulate Professional Photography:** The final image must have the quality of a shot from a high-end Sony Alpha camera with a G Master lens, ensuring it is tack-sharp, crystal clear, and free of any digital artifacts.

**Scene Description:**
${sceneDescription}`;
  } else if (preserveProduct) {
    const sceneInstruction = preserveBackground
      ? "into its original scene, enhanced by the following description:"
      : "into a new scene described here:";
    finalPrompt = `An e-commerce product photo. CRITICAL INSTRUCTION: Your primary task is to place the exact product from the input image ${sceneInstruction} ${sceneDescription}`;
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
  destinationMask: Base64Image,
  referenceImage: Base64Image,
  sourceMask: Base64Image,
  editText: string
): Promise<string> => {
  try {
    const finalPrompt = `You are an expert photo editor. Your task is to perform a highly specific texture and pattern replacement.

You are provided with four images in this order:
1.  **The Original Image:** The base image that needs to be edited.
2.  **A Destination Mask:** A mask (in red) highlighting an area on the Original Image. This is the DESTINATION area where the new pattern must be applied.
3.  **The Reference Image:** This image contains the desired source pattern or texture.
4.  **A Source Mask:** A mask (in blue) highlighting an area on the Reference Image. This is the SOURCE pattern/texture you must intelligently copy and adapt.

Your instruction is: "${editText}"

Follow these steps with extreme precision:
1.  Analyze the DESTINATION area in the Original Image identified by the Destination Mask.
2.  Analyze the SOURCE pattern/texture in the Reference Image identified by the Source Mask.
3.  Inpaint the DESTINATION area of the Original Image using the SOURCE pattern. You must seamlessly blend the new pattern, matching the lighting, shadows, perspective, and contours of the original object. The result should look photorealistic and completely natural.
4.  The rest of the Original Image, outside the masked destination area, must remain absolutely unchanged. Preserve all original details and quality outside the edit zone.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: finalPrompt },
          { inlineData: originalImage },
          { inlineData: destinationMask },
          { inlineData: referenceImage },
          { inlineData: sourceMask },
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
    console.error("Error editing image with reference:", error);
    throw new Error("Failed to edit the image. The model may have refused the request. Please check your instruction and try again.");
  }
};