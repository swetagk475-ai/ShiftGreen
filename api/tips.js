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
    const prompt = `Act as an eco-coach for ShiftGreen. A user has: Transport ${transport} km/day, Energy ${energy} kWh/month, Food ${food} meals/week, Goal: ${goal}. Give 3 short, actionable eco-friendly tips as HTML list items only. Format strictly as <li>...</li> tags with bold titles.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',  // ✅ CURRENT WORKING MODEL
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 300
      })
    });

    const data = await response.json();

    // Check if API returned an error
    if (!response.ok || !data?.choices?.[0]?.message?.content) {
      return res.status(200).json({ 
        tips: fallbackTips, 
        isAI: false,
        debug: data?.error?.message || 'API error'
      });
    }

    // SUCCESS - Return AI-generated tips
    return res.status(200).json({ 
      tips: data.choices[0].message.content,
      isAI: true
    });

  } catch (err) {
    // Network error or other exception - return fallback
    return res.status(200).json({ 
      tips: fallbackTips, 
      isAI: false,
      error: err.message
    });
  }
}

