export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { conversationSummary, lastUpdateTime } = req.body;

    if (!conversationSummary) {
      res.status(400).json({ error: 'Conversation summary is required' });
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'OpenAI API key not configured' });
      return;
    }

    // Check cooldown period (10 minutes)
    const now = Date.now();
    const cooldownPeriod = 10 * 60 * 1000; // 10 minutes in milliseconds
    
    if (lastUpdateTime && (now - lastUpdateTime) < cooldownPeriod) {
      res.status(200).json({
        success: true,
        shouldUpdate: false,
        reason: 'Cooldown period active',
        nextUpdateAllowed: new Date(lastUpdateTime + cooldownPeriod)
      });
      return;
    }

    // Fetch editing rules for context
    let editingRules = '';
    try {
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host || 'localhost:3000';
      const rulesResponse = await fetch(`${protocol}://${host}/editing-rules.md`);
      if (rulesResponse.ok) {
        editingRules = await rulesResponse.text();
      }
    } catch (error) {
      console.log('Could not fetch editing rules, using defaults');
      editingRules = `Default rules: Focus on workshops, talks, hikes, ceremonies, community activities, personal insights, learnings, and suggestions. Exclude logistics and trivial chatter.`;
    }

    const messages = [
      {
        role: 'system',
        content: `You are the Editing Decision Agent for Nomad Fest Switzerland community summary updates.

Your job is to decide whether a conversation summary contains enough valuable content to warrant updating the community summary (info.md).

Editing Rules:
${editingRules}

Decision Criteria:
1. Content substantiveness: Does it contain meaningful feedback about the festival experience?
2. Value threshold: Is it "medium" or "high" value content?
3. Uniqueness: Would this add new insights to the existing summary?
4. Community relevance: Does it help future participants or organizers?

You should recommend updating if:
- The conversation contains substantive feedback about festival activities
- Personal growth insights or meaningful learnings are shared
- Constructive suggestions for improvement are provided
- Community connection stories are meaningful
- The value_level is "medium" or "high"

You should NOT recommend updating if:
- The conversation is purely social/logistical
- The content is trivial or repetitive
- The value_level is "low" or "none"
- No actionable insights are provided

Respond with structured JSON indicating your decision and reasoning.`
      },
      {
        role: 'user',
        content: `Based on the editing rules and criteria, should this conversation summary trigger an update to the community summary?

Conversation Analysis:
${JSON.stringify(conversationSummary, null, 2)}

Please provide your decision with clear reasoning.`
      }
    ];

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 400,
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      res.status(500).json({ error: 'OpenAI API error', details: errorData });
      return;
    }

    const data = await response.json();
    let decision;
    
    try {
      decision = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      // Fallback if JSON parsing fails
      decision = {
        shouldUpdate: false,
        reason: "Could not parse decision response",
        confidence: "low",
        criteria_met: []
      };
    }

    // Ensure shouldUpdate is boolean
    if (typeof decision.shouldUpdate !== 'boolean') {
      decision.shouldUpdate = false;
    }

    res.status(200).json({
      success: true,
      ...decision,
      timestamp: now,
      cooldownUntil: now + cooldownPeriod
    });

  } catch (error) {
    console.error('Editing decision API error:', error);
    res.status(500).json({ 
      error: 'Failed to process editing decision request',
      details: error.message 
    });
  }
}