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
    const prompt = `You are an expert eco-coach for ShiftGreen carbon tracking.

    User's Carbon Profile:
    - Transport: ${transport} km/day (${(transport * 365 * 0.21).toFixed(0)} kg CO₂/year)
    - Energy: ${energy} kWh/month (${(energy * 12 * 0.4).toFixed(0)} kg CO₂/year)
    - Food: ${food} meals/week (${(food * 52 * 2.5).toFixed(0)} kg CO₂/year)
    - Goal: ${goal}

    Biggest emission source: ${biggestSource}

    Generate 5-7 HIGHLY PERSONALIZED, specific, actionable eco tips:
    1. Address their BIGGEST emission source first
    2. Tie to their specific numbers (e.g., "Your ${food} meals/week suggests...")
    3. Estimate impact in kg CO₂/year saved
    4. Make each tip unique (not generic "use less energy")

    Example: "You eat ${food} meals/week. Swapping 3 meat meals for plant-based saves ~450kg CO₂/year."

    Format as HTML list items only.`;
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 300
        // ✅ REMOVED: reasoning_effort (was causing empty content)
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(200).json({ tips: fallbackTips, isAI: false });
    }

    const tips = data?.choices?.[0]?.message?.content;
    
    if (!tips || tips.trim() === '') {
      // If still empty, return fallback
      return res.status(200).json({ tips: fallbackTips, isAI: false });
    }

    // SUCCESS - Return AI tips
    return res.status(200).json({ tips, isAI: true });

  } catch (err) {
    return res.status(200).json({ tips: fallbackTips, isAI: false });
  }
}