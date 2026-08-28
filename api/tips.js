export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { transport, energy, food, goal } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

    const prompt = `Act as an eco-coach for ShiftGreen. A user has the following carbon footprint profile:
    - Transport: ${transport} km/day
    - Energy: ${energy} kWh/month
    - Food: ${food} meals/week
    - Primary Goal: ${goal}

    Provide 3 short, actionable eco-friendly tips to lower their carbon footprint. Format as clean HTML list items (<li>...</li>) with bold titles, but do not use markdown code blocks or outer tags.`;

    // Updated model path to gemini-2.0-flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    return res.status(200).json({ tips: data?.candidates?.[0]?.content?.parts?.[0]?.text });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate tips' });
  }
}