export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const fallbackTips = `
    <li><b>Switch to LEDs:</b> Replace incandescent bulbs to cut energy use.</li>
    <li><b>Public Transit:</b> Swap one car commute weekly for bus or train.</li>
    <li><b>Meatless Meals:</b> Reduce meat intake to lower food footprint.</li>
  `;

  try {
    const { transport, energy, food, goal } = req.body || {};
    const apiKey = process.env.GROQ_API_KEY;

    // ===== DIAGNOSTIC LOG #1: Is the key even present? =====
    if (!apiKey) {
      console.error('[tips.js] GROQ_API_KEY is MISSING from process.env. Check Vercel → Settings → Environment Variables → make sure it is enabled for "Production" and you redeployed after adding it.');
      return res.status(200).json({ tips: fallbackTips, debugReason: 'missing_api_key' });
    }

    // Log key length only (never log the actual key) to confirm it's non-empty/well-formed
    console.log(`[tips.js] GROQ_API_KEY present, length: ${apiKey.length}, starts with: ${apiKey.slice(0, 4)}...`);

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

    // ===== DIAGNOSTIC LOG #2: What did Groq actually say? =====
    if (!response.ok) {
      console.error(`[tips.js] Groq API returned HTTP ${response.status}. Full body:`, JSON.stringify(data));
      return res.status(200).json({ tips: fallbackTips, debugReason: `groq_http_${response.status}`, debugDetail: data?.error?.message || null });
    }

    const tipsHtml = data?.choices?.[0]?.message?.content;

    if (!tipsHtml) {
      console.error('[tips.js] Groq responded 200 OK but no content found. Full body:', JSON.stringify(data));
      return res.status(200).json({ tips: fallbackTips, debugReason: 'empty_content' });
    }

    console.log('[tips.js] SUCCESS — Groq returned real tips.');
    return res.status(200).json({ tips: tipsHtml });

  } catch (err) {
    // ===== DIAGNOSTIC LOG #3: Did something throw (network error, JSON parse, etc)? =====
    console.error('[tips.js] EXCEPTION caught:', err.message, err.stack);
    return res.status(200).json({ tips: fallbackTips, debugReason: 'exception', debugDetail: err.message });
  }
}