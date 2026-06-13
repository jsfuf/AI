
/**
 * Extracts learned insights using the backend Gemini proxy
 */
export const extractMemoryFromDialog = async (
  userText: string,
  aiText: string
): Promise<string | null> => {

  try {
    const response = await fetch('/api/gemini/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userText, aiText })
    });

    if (!response.ok) {
      console.error("Failed to extract cognitive memories via Gemini proxy:", await response.text());
      return null;
    }
    
    const data = await response.json();
    return data.memory || null;
  } catch (error) {
    console.error("Failed to extract cognitive memories via Gemini API proxy:", error);
    return null;
  }
};

