const https = require('https');

https.get('https://integrate.api.nvidia.com/v1/models', {
  headers: { 'Authorization': 'Bearer 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' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
        const parsed = JSON.parse(data);
        const models = parsed.data.map(m => m.id);
        console.log(models.filter(m => m.toLowerCase().includes('qwen') || m.toLowerCase().includes('image')));
    } catch (e) {
        console.log(data.slice(0, 500));
    }
  });
});
