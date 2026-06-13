import https from 'https';

const postData = JSON.stringify({
  text_prompts: [{ text: "A cat" }],
});

const req = https.request('https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-3-medium', {
  method: 'POST',
  headers: { 
    'Authorization': 'Bearer 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',
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(res.statusCode, data.slice(0, 500));
  });
});
req.write(postData);
req.end();
