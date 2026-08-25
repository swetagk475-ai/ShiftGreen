export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { transport, energy, food, goal } = req.body;
        const apiKey = process.env.GEMINI_API_KEY; // Reads securely from your Vercel Environment Variables

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
        const tipsHtml = data.candidates[0].content.parts[0].text;

        return res.status(200).json({ tips: tipsHtml });
    } catch (err) {
        console.error("API Error:", err);
        return res.status(500).json({ error: 'Failed to generate tips' });
    }
}