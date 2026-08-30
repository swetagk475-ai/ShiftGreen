export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { transport, energy, food, goal } = req.body || {};
  const apiKey = process.env.GROQ_API_KEY;

  const fallbackTips = `
    <li><b>Switch to LEDs:</b> Replace incandescent bulbs to cut energy use.</li>
    <li><b>Public Transit:</b> Swap one car commute weekly for bus or train.</li>
    <li><b>Meatless Meals:</b> Reduce meat intake to lower food footprint.</li>
  `;

  if (!apiKey) {
    return res.status(200).json({ tips: fallbackTips, isAI: false });
  }

  try {
    const prompt = `Act as an eco-coach for ShiftGreen. A user has: Transport ${transport} km/day, Energy ${energy} kWh/month, Food ${food} meals/week, Goal: ${goal}. Give 3 short eco tips as HTML list items only.`;

    // Try multiple models in order (Groq's model names change)
    const models = [
      'mixtral-8x7b-32768',      // Most reliable Groq model
      'llama-2-70b-chat',        // Fallback Llama
      'gemma-7b-it',             // Another option
    ];

    let lastError = null;

    for (const model of models) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,  // Try this model
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 300
          })
        });

        const data = await response.json();

        if (response.ok && data?.choices?.[0]?.message?.content) {
          return res.status(200).json({ 
            tips: data.choices[0].message.content,
            isAI: true
          });
        }

        // If model not found, try next one
        if (data?.error?.message?.includes('model')) {
          lastError = `Model ${model} not found, trying next...`;
          continue;
        }

        // Other error
        lastError = data?.error?.message || 'API error';
        continue;

      } catch (err) {
        lastError = err.message;
        continue;
      }
    }

    // All models failed, return fallback
    return res.status(200).json({ tips: fallbackTips, isAI: false });

  } catch (err) {
    return res.status(200).json({ tips: fallbackTips, isAI: false });
  }
}

