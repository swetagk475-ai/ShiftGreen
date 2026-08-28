/**
 * ShiftGreen Eco Tips API
 * Vercel Serverless Function for /api/tips
 * 
 * Purpose: Generate personalized eco tips using Google Gemini AI
 * with comprehensive error handling, retries, and fallbacks
 * 
 * Environment Variables Required:
 * - GEMINI_API_KEY: Your Google AI Studio API key
 */

export default async function handler(req, res) {
    // ===== CORS Configuration =====
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle OPTIONS requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Method Not Allowed',
            tips: getFallbackTips('general')
        });
    }

    try {
        // ===== Input Validation =====
        const { transport, energy, food, goal } = req.body || {};

        if (!transport || !energy || !food || !goal) {
            console.warn('Missing required fields:', { transport, energy, food, goal });
            return res.status(400).json({
                error: 'Missing required fields: transport, energy, food, goal',
                tips: getFallbackTips(goal || 'general')
            });
        }

        // ===== API Key Validation =====
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey.trim() === '') {
            console.error('GEMINI_API_KEY environment variable is not configured');
            return res.status(500).json({
                error: 'API configuration error',
                tips: getFallbackTips(goal)
            });
        }

        // ===== AI Tips Generation (with Retry Logic) =====
        const tips = await generateAITips(transport, energy, food, goal, apiKey);

        return res.status(200).json({ 
            tips: tips,
            success: true 
        });

    } catch (err) {
        // ===== Graceful Error Handling =====
        console.error('API Error:', {
            message: err.message,
            stack: err.stack,
            timestamp: new Date().toISOString()
        });

        // Extract goal from request if possible
        const goal = req.body?.goal || 'general';

        // Return fallback tips instead of 500 error
        return res.status(200).json({
            tips: getFallbackTips(goal),
            fallback: true,
            error: 'Using fallback tips due to API unavailability'
        });
    }
}

/**
 * Generate AI tips with retry logic and model fallback
 * 
 * @param {number} transport - km/day
 * @param {number} energy - kWh/month
 * @param {number} food - meals/week
 * @param {string} goal - sustainability goal
 * @param {string} apiKey - Gemini API key
 * @returns {string} HTML formatted eco tips
 */
async function generateAITips(transport, energy, food, goal, apiKey) {
    // Calculate carbon footprint for context
    const transportCarbon = transport * 365 * 0.21;
    const energyCarbon = energy * 12 * 0.4;
    const foodCarbon = food * 52 * 2.5;
    const totalCarbonKg = (transportCarbon + energyCarbon + foodCarbon).toFixed(0);

    // Determine biggest emission source for targeted advice
    const emissions = {
        transport: transportCarbon,
        energy: energyCarbon,
        food: foodCarbon
    };
    const biggestSource = Object.keys(emissions).reduce((a, b) => 
        emissions[a] > emissions[b] ? a : b
    );

    // Build focused prompt
    const prompt = `You are an eco-coach for ShiftGreen. A user has these carbon emissions:
- Transport: ${transport} km/day (${transportCarbon.toFixed(0)} kg CO₂/year)
- Energy: ${energy} kWh/month (${energyCarbon.toFixed(0)} kg CO₂/year)  
- Food: ${food} meals/week (${foodCarbon.toFixed(0)} kg CO₂/year)
- Total Annual: ${totalCarbonKg} kg CO₂
- Biggest Source: ${biggestSource}
- Their Goal: ${goal}

Provide 4 SHORT, ACTIONABLE personalized eco tips. Each tip should:
1. Be specific to their data (not generic)
2. Include estimated impact where possible
3. Focus on their biggest emission source first
4. Align with their stated goal

Format as plain text with each tip on a new line starting with a bullet (•) or dash (-).
Do NOT use markdown, code blocks, or HTML tags.`;

    // Model options (in order of preference)
    // Model options (in order of preference)
    const models = [
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite'
    ];

    let lastError = null;

    // Try each model with retries
    for (const model of models) {
        try {
            console.log(`Attempting to generate tips with model: ${model}`);
            
            const tipsText = await callGeminiAPI(
                model,
                prompt,
                apiKey,
                3 // Number of retries
            );

            if (tipsText) {
                console.log(`✓ Successfully generated tips with ${model}`);
                // Convert plain text tips to HTML
                return formatTipsAsHTML(tipsText);
            }

        } catch (err) {
            lastError = err;
            console.warn(`Model ${model} failed:`, err.message);
            
            // Check if it's a 404 (unsupported model) - try next one
            if (err.message.includes('404') || err.message.includes('not found')) {
                console.log(`Retrying with next model...`);
                continue;
            }
            
            // For 503 or 429, we'll retry with same model
            if (err.message.includes('429') || err.message.includes('503')) {
                console.log(`Rate limited/high demand. Retrying...`);
                continue;
            }
        }
    }

    // All models failed, return fallback
    console.error('All models failed. Using fallback tips.', lastError);
    throw lastError || new Error('Failed to generate AI tips');
}

/**
 * Call Gemini API with retry logic
 * 
 * @param {string} model - Model name
 * @param {string} prompt - Prompt text
 * @param {string} apiKey - Gemini API key
 * @param {number} maxRetries - Max retry attempts
 * @returns {string} Generated tips text
 */
async function callGeminiAPI(model, prompt, apiKey, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

            console.log(`API Call - Attempt ${attempt}/${maxRetries} for model ${model}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    // Safety settings to reduce blocks
                    safetySettings: [
                        {
                            category: 'HARM_CATEGORY_HARASSMENT',
                            threshold: 'BLOCK_NONE'
                        },
                        {
                            category: 'HARM_CATEGORY_HATE_SPEECH',
                            threshold: 'BLOCK_NONE'
                        },
                        {
                            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                            threshold: 'BLOCK_NONE'
                        },
                        {
                            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                            threshold: 'BLOCK_NONE'
                        }
                    ]
                })
            });

            // Handle different response statuses
            if (response.status === 404) {
                throw new Error(`404: Model ${model} not found or unsupported in API version`);
            }

            if (response.status === 429) {
                console.warn(`429: Rate limited. Waiting before retry...`);
                await delay(Math.pow(2, attempt) * 1000); // Exponential backoff
                continue;
            }

            if (response.status === 503) {
                console.warn(`503: Service unavailable (high demand). Waiting before retry...`);
                await delay(Math.pow(2, attempt) * 1000); // Exponential backoff
                continue;
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
            }

            // Parse successful response
            const data = await response.json();

            // Check for blocked content
            if (data.promptFeedback?.blockReason) {
                console.warn(`Content blocked: ${data.promptFeedback.blockReason}`);
                throw new Error(`Content blocked: ${data.promptFeedback.blockReason}`);
            }

            // Extract text from response
            const tipsText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!tipsText) {
                console.warn('No text in Gemini response:', data);
                throw new Error('Empty response from Gemini API');
            }

            return tipsText;

        } catch (err) {
            lastError = err;
            console.error(`Attempt ${attempt} failed:`, err.message);

            // For 404, fail immediately (wrong model)
            if (err.message.includes('404')) {
                throw err;
            }

            // For rate limiting, retry with backoff
            if (err.message.includes('429') || err.message.includes('503')) {
                if (attempt < maxRetries) {
                    const backoffMs = Math.pow(2, attempt) * 1000;
                    console.log(`Retrying in ${backoffMs}ms...`);
                    await delay(backoffMs);
                    continue;
                }
            }

            // For other errors, fail if last attempt
            if (attempt === maxRetries) {
                throw err;
            }
        }
    }

    throw lastError || new Error('Failed after all retries');
}

/**
 * Convert plain text tips to HTML list format
 * 
 * @param {string} tipsText - Plain text with tips
 * @returns {string} HTML formatted tips
 */
function formatTipsAsHTML(tipsText) {
    // Split by newlines and filter out empty lines
    const lines = tipsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    // Convert each line to a list item if it looks like a tip
    const htmlTips = lines
        .map(line => {
            // Remove bullet points or numbers
            const cleaned = line
                .replace(/^[•\-*]\s*/, '')
                .replace(/^\d+\.\s*/, '');
            
            return `<li>${cleaned}</li>`;
        })
        .join('');

    return htmlTips || '';
}

/**
 * Get fallback static tips by goal
 * These are used when API is unavailable
 * 
 * @param {string} goal - Sustainability goal
 * @returns {string} HTML formatted tips
 */
function getFallbackTips(goal = '') {
    const g = goal.toLowerCase();

    const tips = {
        reduce_energy: `
            <li><b>Switch to LED Bulbs:</b> Replace incandescent with LEDs (saves 75% energy).</li>
            <li><b>Smart Thermostat:</b> Auto-adjust temperature when away (saves 10-15% on heating/cooling).</li>
            <li><b>Unplug Phantom Devices:</b> Stop devices from draining standby power.</li>
            <li><b>Energy Audit:</b> Seal windows and doors to prevent air leaks.</li>
        `,
        sustainable_transport: `
            <li><b>Carpool 2x/Week:</b> Cuts transport emissions by 50% and splits fuel costs.</li>
            <li><b>Public Transit:</b> One bus trip generates significantly less CO₂ than driving alone.</li>
            <li><b>Bike for Nearby Trips:</b> Zero emissions and free daily exercise.</li>
            <li><b>Maintain Tire Pressure:</b> Properly inflated tires improve fuel efficiency by up to 3%.</li>
        `,
        plant_based: `
            <li><b>Meatless Mondays:</b> Swapping meat once a week significantly reduces your footprint.</li>
            <li><b>Switch to Plant Milk:</b> Oat milk uses 80% less water than dairy milk.</li>
            <li><b>Buy Local Produce:</b> Local seasonal food reduces transport emissions.</li>
            <li><b>Reduce Food Waste:</b> Meal planning prevents food from ending up in landfills.</li>
        `,
        general: `
            <li><b>Track Your Impact Weekly:</b> Awareness leads to a natural reduction in footprint.</li>
            <li><b>Share Your Goals:</b> Social accountability increases habit consistency.</li>
            <li><b>One Change Per Month:</b> Small sustainable habits stick better than major overhauls.</li>
        `
    };

    if (g.includes('energy')) return tips.reduce_energy;
    if (g.includes('transport') || g.includes('transit')) return tips.sustainable_transport;
    if (g.includes('plant') || g.includes('food') || g.includes('eat')) return tips.plant_based;
    
    return tips.general;
}

/**
 * Simple delay utility for backoff
 * 
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}