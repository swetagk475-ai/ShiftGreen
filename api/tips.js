export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { transport, energy, food, goal } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY environment variable missing in Vercel' });
    }

    const prompt = `Act as an eco-coach for ShiftGreen. A user has the following carbon footprint profile:
    - Transport: ${transport} km/day
    - Energy: ${energy} kWh/month
    - Food: ${food} meals/week
    - Primary Goal: ${goal}

    Provide 3 short, actionable eco-friendly tips to lower their carbon footprint. Format as clean HTML list items (<li>...</li>) with bold titles, but do not use markdown code blocks or outer tags.`;

    // Array of fallback models to cycle through if one experiences high demand
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite'];
    let lastError = null;

    for (const model of models) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();

        if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          return res.status(200).json({ tips: data.candidates[0].content.parts[0].text });
        }

        lastError = data.error?.message || 'Model call failed';
      } catch (e) {
        lastError = e.message;
      }
    }

    return res.status(503).json({ error: `High demand on all endpoints: ${lastError}` });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}