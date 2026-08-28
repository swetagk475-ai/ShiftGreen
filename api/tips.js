export default async function handler(req, res) {
  // 1. Set CORS headers to allow requests from any origin
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // 2. Handle HTTP OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 3. Validate request method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 4. Execute Gemini API Call inside handler block
  try {
    const { transport, energy, food, goal } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("GEMINI_API_KEY environment variable is missing.");
      return res.status(500).json({ error: 'API key not configured' });
    }

    const prompt = `Act as an eco-coach for ShiftGreen. A user has the following carbon footprint profile:
    - Transport: ${transport} km/day
    - Energy: ${energy} kWh/month
    - Food: ${food} meals/week
    - Primary Goal: ${goal}

    Provide 3 short, actionable eco-friendly tips to lower their carbon footprint. Format as clean HTML list items (<li>...</li>) with bold titles, but do not use markdown code blocks or outer tags.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    const tipsHtml = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!tipsHtml) {
      console.error("Gemini response missing text:", data);
      return res.status(500).json({ error: 'Invalid response from AI' });
    }

    return res.status(200).json({ tips: tipsHtml });
  } catch (err) {
    console.error("API Route Error:", err);
    return res.status(500).json({ error: 'Failed to generate tips' });
  }
}