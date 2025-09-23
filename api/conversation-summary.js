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
    const { chatHistory } = req.body;

    if (!chatHistory || !Array.isArray(chatHistory)) {
      res.status(400).json({ error: 'Chat history is required' });
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'OpenAI API key not configured' });
      return;
    }

    // Take last 10 messages for context
    const recentHistory = chatHistory.slice(-10);
    
    if (recentHistory.length < 3) {
      // Not enough conversation to summarize
      res.status(200).json({
        success: true,
        summary: null,
        reason: 'Insufficient conversation length'
      });
      return;
    }

    const chatText = recentHistory.map(entry => 
      `${entry.type.toUpperCase()}: ${entry.message}`
    ).join('\n\n');

    const messages = [
      {
        role: 'system',
        content: `You are the Conversation Summary Agent for Nomad Fest Switzerland feedback collection.

Your job is to create concise summaries of ongoing chat conversations to help determine if they contain valuable feedback worth preserving.

Instructions:
- Analyze the conversation for substantive content about the festival experience
- Focus on: workshops, talks, hikes, ceremonies, community activities, personal insights, learnings, suggestions
- Ignore: logistics, trivial chatter, greetings, purely social conversation
- Return a brief summary (2-3 sentences) of the conversation's value and main topics
- If the conversation lacks substance, indicate that clearly

Output format:
- summary: Brief description of valuable content (or "No substantial content")
- topics: Array of main topics discussed (e.g. ["workshops", "networking", "suggestions"])
- value_level: "high", "medium", "low", or "none"
- reasoning: Why this conversation does/doesn't warrant preservation`
      },
      {
        role: 'user',
        content: `Please analyze this conversation for valuable festival feedback:\n\n${chatText}`
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
        max_tokens: 300,
        temperature: 0.3,
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
    let result;
    
    try {
      result = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      // Fallback if JSON parsing fails
      result = {
        summary: data.choices[0].message.content,
        topics: [],
        value_level: "low",
        reasoning: "Could not parse structured response"
      };
    }

    res.status(200).json({
      success: true,
      ...result,
      conversation_length: recentHistory.length
    });

  } catch (error) {
    console.error('Conversation summary API error:', error);
    res.status(500).json({ 
      error: 'Failed to process conversation summary request',
      details: error.message 
    });
  }
}