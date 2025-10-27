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
  userIntent: string,
  aspectRatio: string,
  lighting: string,
  perspective: string,
  preserveBackground: boolean,
  productImage?: Base64Image,
  referenceImage?: Base64Image,
  previousPrompt?: string
): Promise<string> => {
  try {
    let textPrompt = '';
    const isIterative = !!previousPrompt;

    if (isIterative && previousPrompt) {
        if (preserveBackground) {
            // Iterative prompt, PRESERVING background
            const referenceImageInstruction = referenceImage ? `*   **Style Reference Image:** (The second image provided). This is the new source of truth for the scene.` : '';
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
            if (referenceImage) {
                textPrompt = `You are a master prompt re-writer. Your critical task is to take a product description from an old prompt and place it into a brand new scene defined by a reference image, completely erasing the old scene.

**Previous Prompt:** "${previousPrompt}"
**User's Goal:** "${userIntent || 'Create a new scene based on the reference.'}"
**Style Reference Image (Image 1):** This image defines the ONLY valid background, lighting, and mood.

**MANDATORY INSTRUCTIONS:**

1.  **EXTRACT Product ONLY:** Read the "Previous Prompt". Your first and only action is to meticulously copy the description of the main product.
2.  **DISCARD Old Scene:** You must then completely discard ALL other parts of the "Previous Prompt". Any words describing the old background, floor, surface, lighting, or mood are now forbidden.
3.  **ANALYZE New Scene:** Look at the Style Reference Image (Image 1). Describe its environment in photorealistic detail. IGNORE any product in this image; focus only on the background, surface, and lighting. This is the new, authoritative scene.
4.  **COMBINE:** Create a new, single-paragraph prompt. It must start with the extracted product description from Step 1, followed by the new scene description from Step 3.
5.  **Incorporate Parameters:** Ensure the final prompt text includes: Aspect Ratio: ${aspectRatio}, Lighting Style: ${lighting}, Camera Perspective: ${perspective}.

**ABSOLUTE, UNBREAKABLE RULE:** The new prompt must be completely free of the old scene. There must be ZERO descriptive words or concepts from the background of the "Previous Prompt".

**CRITICAL:** Output ONLY the final, rewritten prompt text.`;
            } else {
                const sceneInstruction = `2.  **Create New Scene:** Invent a new, professional e-commerce scene based on the "User's Goal".`;
                textPrompt = `You are a master prompt writer for an AI image generator. Your task is to create a new prompt by combining a product description from a previous prompt with a brand new scene.

**Previous Prompt:** "${previousPrompt}"
**User's Goal:** "${userIntent || 'Create a new scene based on the reference.'}"

**Instructions:**
1.  **Extract Product:** Read the "Previous Prompt" and copy **ONLY** the description of the main product (e.g., "a vibrant mustard yellow saree with green borders..."). Discard all other parts of the previous prompt, especially descriptions of the old background, floor, or lighting.
${sceneInstruction}
3.  **Combine:** Create a new, single-paragraph prompt. Start with the extracted product description, then seamlessly integrate the new scene description.
4.  **Incorporate Parameters:** Ensure the final prompt text includes: Aspect Ratio: ${aspectRatio}, Lighting Style: ${lighting}, Camera Perspective: ${perspective}.

**ABSOLUTE RULE:** The new prompt must contain **NO** descriptive words or concepts about the scene or background from the "Previous Prompt". The old scene must be completely replaced.

**CRITICAL:** Your output must be ONLY the final, rewritten prompt text. Do not include your reasoning or any extra text.`;
            }
        }
    } else {
       // Initial prompt generation
       if (productImage) {
           if (preserveBackground) {
                textPrompt = `Act as a professional photo analyst. Your task is to describe the provided image (product and background) in photorealistic detail. Then, subtly modify that description to incorporate the user's goal, enhancing the existing photo rather than creating a new scene.

User's Goal: "${userIntent || 'Subtly enhance the photo.'}"

Ensure your final prompt reflects:
- Aspect Ratio: ${aspectRatio}
- Lighting Style: ${lighting}
- Camera Perspective: ${perspective}
${referenceImage ? '\n- Style Reference: The style, mood, and color palette should be subtly shifted to be more like the second provided image (the style reference).' : ''}

Output ONLY the final, detailed prompt text.`;
           } else { // This is the REPLACE BACKGROUND path.
                if (referenceImage) {
                    // THIS IS THE CRITICAL FIREWALL LOGIC
                    textPrompt = `You are a master visual AI. Your task is to look at two images and synthesize a single, new scene description.

**Image 1:** This is your **SCENE**. It contains the background, the surface, the lighting, and the mood. IGNORE any product in this image.
**Image 2:** This is your **PRODUCT**. It contains the object you must place into the SCENE.

**Your Goal:**

Imagine you have already successfully photoshopped the PRODUCT from Image 2 into the SCENE from Image 1. Now, describe that final, combined result in one single, photorealistic paragraph.

**CRITICAL INSTRUCTIONS:**

*   When describing the final scene, your description of the background, surface, and lighting MUST be based **ENTIRELY** on Image 1.
*   The original background from Image 2 is **IRRELEVANT and MUST be completely ignored**. Do not mention any part of it. Your description must be free from any contamination from the product's original environment.

**Incorporate these parameters into your final description:**
*   **User Goal for Scene:** "${userIntent || 'Create a beautiful product shot.'}"
*   **Aspect Ratio:** ${aspectRatio}
*   **Lighting Style:** ${lighting}
*   **Camera Perspective:** ${perspective}

Output ONLY the single-paragraph description of the final, imagined scene.`;
                } else {
                    // This is the initial replace WITHOUT a reference image. It only gets one image (the product).
                    textPrompt = `You are an expert photorealistic prompt writer. Your task is to describe the product in the provided image and then invent a completely new scene for it.

**Image 1 (Product Image):** Contains the product to be described. Its background must be ignored.
**User Goal:** Creative direction for the new scene.

**Instructions:**
1.  **Analyze the Product:** Describe the product in the provided image in photorealistic detail.
2.  **Invent a New Scene:** Create a new, professional e-commerce scene based on the "User Goal".
3.  **Combine:** Synthesize your analyses into a single, cohesive paragraph, starting with the product.
4.  **Incorporate Parameters:** Ensure the final prompt text includes: Aspect Ratio: ${aspectRatio}, Lighting Style: ${lighting}, Camera Perspective: ${perspective}.

**User Goal:** "${userIntent || 'Create a beautiful product shot.'}"

**CRITICAL:** Your output must be ONLY the final prompt text.`;
                }
          }
       } else {
        // NEW: Initial prompt generation from TEXT ONLY
        const referenceInstruction = referenceImage
            ? `Use the provided Style Reference image as the primary inspiration for the scene's mood, lighting, and environment.`
            : `Invent a new, professional e--commerce scene.`;
        textPrompt = `You are an expert photorealistic prompt writer for an AI image generator. Your task is to create a detailed prompt from scratch based on a user's goal.

**User Goal:** "${userIntent || 'A beautiful product shot.'}"

**Instructions:**
1.  **Invent a Product and Scene:** Based on the "User Goal," imagine a compelling product and place it in a suitable, photorealistic environment.
2.  **Incorporate Style:** ${referenceInstruction}
3.  **Synthesize:** Combine your ideas into a single, cohesive paragraph that vividly describes the entire scene.
4.  **Add Parameters:** Ensure the final prompt text includes these required parameters: Aspect Ratio: ${aspectRatio}, Lighting Style: ${lighting}, Camera Perspective: ${perspective}.

**CRITICAL:** Your output must be ONLY the final prompt text. Do not include your reasoning or any extra text.`;
       }
    }

    const parts: Part[] = [{ text: textPrompt }]; // Text is always first.

    // Determine the correct image order based on the prompt's instructions.
    const isInitialReplaceWithReference = !isIterative && !preserveBackground && !!productImage && !!referenceImage;
    const isIterativeReplaceWithReference = isIterative && !preserveBackground && !!referenceImage;

    if (isInitialReplaceWithReference) {
        // For this specific "firewall" case, the reference image (new scene) must be sent first
        // to align with the prompt's procedural instructions.
        parts.push({ inlineData: referenceImage });
        parts.push({ inlineData: productImage });
    } else {
        // For all other cases, maintain the standard order.
        // Crucially, DO NOT send the `productImage` (which is the previous generation)
        // on an iterative background replacement, as it contaminates the context.
        if (productImage && !isIterativeReplaceWithReference) {
          parts.push({ inlineData: productImage });
        }
        if (referenceImage) {
          parts.push({ inlineData: referenceImage });
        }
    }
    
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

export const removeBackground = async (
  productImage: Base64Image
): Promise<string> => {
  try {
    const prompt = `Your task is to create a photorealistic cutout of the main product in the provided image.
- Isolate the primary subject from its background.
- The output image MUST have a transparent background.
- Preserve every detail of the product, including its lighting, shadows, and textures.
- Do not add any new background or effects. The result should be a clean, professional product cutout.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: prompt },
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
    throw new Error("No image data found in the background removal response.");
  } catch (error) {
    console.error("Error removing background:", error);
    throw new Error("Failed to remove the background from the image. The model may have refused the request.");
  }
};

export const generateImage = async (
  sceneDescription: string,
  isHDUpscaleMode: boolean,
  preserveProduct: boolean,
  preserveBackground: boolean,
  productImage?: Base64Image,
  referenceImage?: Base64Image
): Promise<string> => {
  let finalPrompt = sceneDescription;

  if (productImage) {
    if (preserveBackground) {
        // --- PRESERVE BACKGROUND LOGIC ---
        if (isHDUpscaleMode) {
            const preservationRule = preserveProduct
                ? `1.  **Product Preservation Mandate:** This is the most critical rule. The product shown in the input image must be extracted and placed into the new scene without any modifications. Treat the product as a fixed, unchangeable asset. Every single detail—the exact pattern, weave of the fabric, color saturation, texture, and any imperfections—must be replicated with 1:1 accuracy. Do not reinterpret, improve, or alter the product in any way. The final output should look as if the original product was expertly photoshopped into the new scene.`
                : "1.  **Reference the Product:** Use the product from the input image as a clear reference. Recreate it with high fidelity, but you have creative freedom to change its angle, drape, or condition to better fit the new scene. The core design, color, and material must remain consistent.";
            const sceneRule = "2.  **Preserve the Scene:** The original background and composition must be used as the base for the new image. You should only make modifications as described in the 'Scene Description'.";

            finalPrompt = `**Primary Instruction:** Your task is to generate a new, ultra-realistic product photograph based on the input image. You MUST adhere to the following rules:
${preservationRule}
${sceneRule}
3.  **Emulate Professional Photography:** The final image must have the quality of a shot from a high-end Sony Alpha camera with a G Master lens, ensuring it is tack-sharp, crystal clear, and free of any digital artifacts.

**Scene Description:**
${sceneDescription}`;
        } else { // Non-HD, Preserve Background
            finalPrompt = `An e-commerce product photo. CRITICAL INSTRUCTION: Your primary task is to use the product from the provided input image and place it into its original scene, enhanced by the following description: ${sceneDescription}`;
        }
    } else {
        // --- REPLACE BACKGROUND LOGIC ---
        const productRule = preserveProduct
            ? `The product itself, however, MUST be preserved with 1:1 accuracy. Do not alter its shape, texture, or color.`
            : `The product in the input image is a reference. Recreate it with high fidelity, but you have freedom to adjust its angle or drape to fit the scene.`;
        
        const referenceInstruction = referenceImage
            ? `*   The **second input image** is a **STYLE REFERENCE**. The new scene's lighting, mood, and background surface MUST be copied from this style reference image.`
            : '';

        if (isHDUpscaleMode) {
            finalPrompt = `**Primary Goal:** Generate a photorealistic image based on the **Scene Description** below.
**Input Images:**
*   The **first input image** contains the **PRODUCT** to be used.
${referenceInstruction}

**CRITICAL RULE:** The background, lighting, and shadows of the **first input image (the product shot)** are **WRONG** and **MUST BE COMPLETELY IGNORED AND REPLACED**. You must perform a virtual re-shoot of the product in the new scene. This requires re-lighting the product to perfectly match the new environment. ${productRule}

**Scene Description:**
${sceneDescription}

**Photography Style:**
The final image must have the quality of a shot from a high-end Sony Alpha camera with a G Master lens, ensuring it is tack-sharp, crystal clear, and free of any digital artifacts.`;
        } else { // Non-HD, Replace Background
            finalPrompt = `**Primary Goal:** Generate an e-commerce photo based on the **New Scene Description** below.
**Input Images:**
*   The **first input image** contains the **PRODUCT** to be used.
${referenceInstruction}

**CRITICAL RULE:** The background and lighting of the **first input image (the product shot)** are **INCORRECT** and **MUST BE IGNORED**. You must perform a virtual re-shoot of the product. ${productRule} This includes re-lighting it to match the new environment's shadows and highlights.

**New Scene Description:**
${sceneDescription}`;
        }
    }
  } else {
    // No product image.
    if (isHDUpscaleMode) {
        finalPrompt = `**Primary Instruction:** Your task is to generate a new, ultra-realistic photograph based on the scene description. You MUST adhere to the following rule:
1.  **Emulate Professional Photography:** The final image must have the quality of a shot from a high-end Sony Alpha camera with a G Master lens, ensuring it is tack-sharp, crystal clear, and free of any digital artifacts.

**Scene Description:**
${sceneDescription}`;
    }
    // If not HD upscale, the raw prompt (`sceneDescription`) is used directly.
  }

  try {
    const parts: Part[] = [];
    parts.push({ text: finalPrompt }); // Always send the prompt first.

    // The order must match the prompt's instructions.
    if (productImage) {
        parts.push({ inlineData: productImage }); // First image
    }
    if (referenceImage && !preserveBackground) {
        parts.push({ inlineData: referenceImage }); // Second image
    }
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
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