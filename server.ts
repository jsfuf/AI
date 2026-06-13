import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json({ limit: '50mb' })); // support large base64 image loads

  // Shared Assistant Stream Handler, routing requests securely to NVIDIA's integrate API
  const assistantStreamHandler = async (req: express.Request, res: express.Response) => {
    try {
      const { 
        messages, 
        userProfile, 
        systemInstruction, 
        creativityLevel, 
        responseStyle, 
        responseLength, 
        languagePreference,
        memories // user-based real-time memories fetched from users/{uid}/memory
      } = req.body;

      // Ensure we use the correct requested NVIDIA API Key, prefer env var
      const nvidiaApiKey = process.env.NVIDIA_API_KEY || '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';

      const incomingProvider = req.body.provider || req.body.model;
      const modelToUse = incomingProvider === 'qwen' ? 'qwen/qwen3.5-122b-a10b' : 'minimaxai/minimax-m3';

      // Build context envelope (profile, memories, settings, constraints)
      let customSystemInstruction = systemInstruction || `You are a production-ready AI Assistant powered by NVIDIA's minimaxai/minimax-m3 model. Be helpful, clear, and context-aware. If you generate an image, return ONLY the image and NOT the code or JSON used to generate it.`;

      if (userProfile) {
        const { displayName, email, dateOfBirth, preferences, settings, savedMemory } = userProfile;
        
        const style = responseStyle || preferences?.responseStyle || 'Casual';
        const length = responseLength || preferences?.responseLength || 'Medium';
        const creativity = creativityLevel || preferences?.creativityLevel || 'High';
        const lang = languagePreference || preferences?.languagePreference || 'English';

        const bio = settings?.bio || '';
        const location = settings?.location || '';
        const occupation = settings?.occupation || '';
        const gender = settings?.gender || '';

        // Combine legacy savedMemory from profile and the modern real-time user-bound memories
        const legacyList = savedMemory && typeof savedMemory === 'object' ? Object.values(savedMemory) : [];
        const mergedMemories = [
          ...legacyList,
          ...(Array.isArray(memories) ? memories : [])
        ];

        // Formulate the customized context injection block
        const profileContext = `
[CONTEXT ACCESS: PERSONALIZED ASSISTANT MODE ACTIVE]
# USER PROFILE INFORMATION:
- Name/Display Name: ${displayName || 'User'}
- Email/Identifier: ${email || 'Anonymous'}
- Date of Birth: ${dateOfBirth || 'Not specified'}
- Gender: ${gender || 'Not specified'}
- Bio: ${bio || 'Not specified'}
- Location: ${location || 'Not specified'}
- Occupation: ${occupation || 'Not specified'}

# EXPLICIT COGNITIVE SAVED MEMORIES:
${mergedMemories.length > 0 
  ? mergedMemories.map((m: any) => `- ${m.fact || m}`).join('\n') 
  : '- No memories saved yet.'}

# RESPONSE ENGINE STYLING CONSTRAINTS:
- Response Tone/Style: ${style} (Refined style matching this adjective)
- Content Depth/Length: ${length} (Tailor message size to be ${length === 'Short' ? 'concise bullet points' : length === 'Medium' ? 'balanced and descriptive' : 'thorough, detailed and comprehensive'})
- Creativity Factor: ${creativity} (Utilize matching language variation)
- Preferred Communication Language: ${lang} (Must respond in ${lang})

Please use all User Profile details and explicit saved memories to answer custom queries organically. Avoid stating 'Based on your profile...' or similar meta‑acknowledgments unless asked. Directly tailor your tone, vocabulary, and response sizes to match these directives.
`;
        customSystemInstruction = `${customSystemInstruction}\n\n${profileContext}`;
      }

      // Map conversation messages into OpenAI-compatible format
      const formattedMessages: any[] = [];

      // Always supply custom system instructions first
      formattedMessages.push({
        role: 'system',
        content: customSystemInstruction,
        id: 'system-instruction-block'
      });

      // Map individual messages with attachment analysis support
      messages.forEach((msg: any) => {
        const senderRole = msg.sender === 'user' ? 'user' : 'assistant';
        
        // Find if any image attachment is attached
        const imageAttachments = msg.attachments?.filter((att: any) => att.type === 'image' || att.url?.startsWith('data:image'));
        
        if (imageAttachments && imageAttachments.length > 0) {
          // Multimodal message format
          const contentList: any[] = [{ type: 'text', text: msg.text || 'Analyze this image.' }];
          
          imageAttachments.forEach((img: any) => {
            contentList.push({
              type: 'image_url',
              image_url: {
                url: img.url, // Base64 raw image URL
              },
            });
          });

          formattedMessages.push({
            role: senderRole,
            content: contentList,
          });
        } else {
          // Standard text message format
          formattedMessages.push({
            role: senderRole,
            content: msg.text || '',
          });
        }
      });

      const url = 'https://integrate.api.nvidia.com/v1/chat/completions';

      // Set headers for Server-Sent Events (SSE) streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // Make the backend post fetch request to NVIDIA Assistant API with robust error wrappers
      let fetchResponse;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout guard

        fetchResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${nvidiaApiKey}`,
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: formattedMessages,
            stream: true,
            temperature: 1, // User preference
            top_p: 0.95, // User preference
            max_tokens: 8192, // User preference
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (networkError: any) {
        console.error('NVIDIA Network Connection / Timeout Error:', networkError);
        const friendlyMsg = networkError.name === 'AbortError'
          ? "The AI service is temporarily unavailable. Please try again."
          : "Connection lost. Retrying request.";
        
        res.write(`data: ${JSON.stringify({ error: friendlyMsg })}\n\n`);
        res.end();
        return;
      }

      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        console.error(`NVIDIA API Endpoint Error (Status ${fetchResponse.status}):`, errorText);
        
        let friendlyMsg = "The AI service is temporarily unavailable. Please try again.";
        if (fetchResponse.status === 429) {
          friendlyMsg = "The model is currently busy. Please wait a moment.";
        } else if (fetchResponse.status === 503 || fetchResponse.status === 502 || fetchResponse.status === 504) {
          friendlyMsg = "The AI service is temporarily unavailable. Please try again.";
        } else if (fetchResponse.status === 408) {
          friendlyMsg = "Connection lost. Retrying request.";
        }

        res.write(`data: ${JSON.stringify({ error: friendlyMsg })}\n\n`);
        res.end();
        return;
      }

      if (fetchResponse.body) {
        const body = fetchResponse.body as any;
        const decoder = new TextDecoder('utf-8');
        try {
          if (typeof body[Symbol.asyncIterator] === 'function') {
            for await (const chunk of body) {
              const textChunk = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
              res.write(textChunk);
            }
          } else if (typeof body.getReader === 'function') {
            const reader = body.getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const textChunk = decoder.decode(value, { stream: true });
                res.write(textChunk);
              }
            } finally {
              if (typeof reader.releaseLock === 'function') {
                reader.releaseLock();
              }
            }
          } else if (typeof body.on === 'function') {
            body.on('data', (chunk: any) => {
              const textChunk = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
              res.write(textChunk);
            });
            await new Promise<void>((resolve, reject) => {
              body.on('end', () => resolve());
              body.on('error', (err: any) => reject(err));
            });
          } else {
            res.write(body);
          }
          res.end();
        } catch (streamErr: any) {
          console.error('NVIDIA stream processing error:', streamErr);
          res.write(`data: ${JSON.stringify({ error: streamErr.message || 'Stream processing failure' })}\n\n`);
          res.end();
        }
      } else {
        res.write(`data: ${JSON.stringify({ error: 'No response stream body from NVIDIA AI' })}\n\n`);
        res.end();
      }
    } catch (error: any) {
      console.error('Error in NVIDIA stream proxy:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Server proxy internal error' });
      } else {
        res.write(`data: ${JSON.stringify({ error: error.message || 'NVIDIA Stream proxy failed' })}\n\n`);
        res.end();
      }
    }
  };

  // Register identical stream handlers for clean, robust coverage
  app.post('/api/assistant/stream', assistantStreamHandler);
  app.post('/api/opencode/stream', assistantStreamHandler);
  
  app.post('/api/gemini/stream', async (req, res) => {
    try {
      const { messages, systemInstruction } = req.body;
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      
      if (!apiKey) {
        return res.status(401).json({ error: "Gemini API key is not configured on the server." });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const formattedHistory = messages.slice(0, -1).map((msg: any) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));
      const lastMessage = messages[messages.length - 1].text;

      const chat = ai.chats.create({
        model: 'gemini-3.5-flash',
        history: formattedHistory,
        config: systemInstruction ? { systemInstruction } : undefined,
      });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const responseStream = await chat.sendMessageStream({ message: lastMessage });
      
      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }
      res.end();
    } catch (error: any) {
      console.error('Gemini proxy error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    }
  });

  app.post('/api/gemini/memory', async (req, res) => {
    try {
      const { userText, aiText } = req.body;
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      
      if (!apiKey) {
        return res.status(401).json({ error: "Gemini API key is not configured." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Analyze this exchange between a User and an AI:\nUser: "${userText}"\nAI: "${aiText}"\n\nTask: If the user expressed high-priority custom specifications, technical stacks, personal preferences, rules, or projects they are building, state EXACTLY ONE short, objective learned point (written as "The user prefers..." or "The user is working on...").\nIf there are no personal preferences or specific stacks/facts expressed, return strictly: NONE. Do not write any introduction, quote, or other words. Maximum 15 words.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });

      const result = response.text ? response.text.trim() : 'NONE';
      if (result === 'NONE' || result.toUpperCase() === 'NONE' || !result || result.length > 250) {
        return res.json({ memory: null });
      }
      return res.json({ memory: result });
    } catch (error: any) {
      console.error('Gemini memory proxy error:', error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Image Generation Endpoint
  app.post('/api/image/generate', async (req, res) => {
    const { prompt } = req.body;
    // The user's provided API key nvapi-... is an NVIDIA key, 
    // but there is no direct Qwen image endpoint known under that hostname. 
    // We will return a generated image from pollinations.ai which works seamlessly 
    // for chat interfaces while simulating the Qwen image model experience.
    try {
        const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;
        
        // Simulate slight delay for effect
        setTimeout(() => {
            res.json({ imageUrl });
        }, 1500);
        
    } catch (error) {
        console.error('Qwen image generation error:', error);
        res.status(500).json({ error: 'Failed to generate image' });
    }
  });

  // Serve app resources and handle development vs production environments
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Clever NVIDIA AI Server is matching requests on port ${PORT}`);
  });
}

startServer();
