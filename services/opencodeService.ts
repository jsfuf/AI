import { ChatMessage, MessageSender, UserProfile, LearnedMemory } from '../types';

export interface OpenCodeConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  systemInstruction: string;
}

export const getOpenCodeStream = async (
  messages: ChatMessage[],
  config: OpenCodeConfig,
  userProfile: UserProfile | null,
  memories: LearnedMemory[],
  onChunk: (text: string) => void
): Promise<void> => {
  const response = await fetch('/api/opencode/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model || 'opencode', // we will use config.model from provider
      systemInstruction: config.systemInstruction,
      userProfile: userProfile || undefined,
      memories: memories || []
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenCode API error (${response.status}): ${errorText || response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');

    // Keep the last partial line in the buffer
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      if (trimmedLine.startsWith('data: ')) {
        const dataStr = trimmedLine.slice(6);
        if (dataStr === '[DONE]') {
          return;
        }

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed && parsed.error) {
            // Ensure error is a string for the Error constructor
            const errorMessage = typeof parsed.error === 'string' 
              ? parsed.error 
              : JSON.stringify(parsed.error);
            throw new Error(errorMessage);
          }
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            onChunk(delta);
          }
        } catch (e: any) {
          // If the error was explicitly thrown above, bubble it up.
          if (e.message && e.message !== "[object Object]") {
            throw e;
          }
          // Otherwise ignore parse errors from heartbeats/empty chunks
          console.debug('Failed to parse SSE line or error line:', trimmedLine, e);
        }
      }
    }
  }
};
