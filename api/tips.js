export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const fallbackTips = `
    <li>🌱 <b>Switch to LEDs:</b> Replace incandescent bulbs to cut energy use.</li>
    <li>🌱 <b>Public Transit:</b> Swap one car commute weekly for bus or train.</li>
    <li>🌱 <b>Meatless Meals:</b> Reduce meat intake to lower food footprint.</li>
  `;

  try {
    const { transport, energy, food, goal } = req.body || {};
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(200).json({ tips: fallbackTips });
    }

    const prompt = `Act as an eco-coach for ShiftGreen. A user has the following carbon footprint profile:
    - Transport: ${transport} km/day
    - Energy: ${energy} kWh/month
    - Food: ${food} meals/week
    - Goal: ${goal}

    Provide 3 short, actionable eco-friendly tips. Format strictly as clean HTML list items (<li>...</li>) with bold titles. Do not use markdown code blocks.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });

    const data = await response.json();
    const tipsHtml = data?.choices?.[0]?.message?.content;

    if (response.ok && tipsHtml) {
      return res.status(200).json({ tips: tipsHtml });
    }

    return res.status(200).json({ tips: fallbackTips });
  } catch (err) {
    return res.status(200).json({ tips: fallbackTips });
  }
}