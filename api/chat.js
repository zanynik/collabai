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
    const { message, chatHistory, userName } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'OpenAI API key not configured' });
      return;
    }

    // Prepare messages for OpenAI
    const systemPrompt = `You are the Anonymous AI Chatbot for the Nomad Fest Switzerland community feedback page.
Your job is to ask participants about their experiences, learnings, highlights, and suggestions from the event.

Important:
- Keep ALL responses very short (max 15 words)
- Be friendly, curious, and non-judgmental
- Ask follow-up questions based on what they share
- Focus on workshops, talks, hikes, ceremonies, community moments
- Ignore logistics (meals, schedules, maps, participant counts)
${userName ? `- User's name is "${userName}" - use it naturally in responses` : '- User chose to remain anonymous'}

Conversation style:
- Respond to what they say, then ask a relevant follow-up
- Vary your questions: "Which workshop was best?", "Any memorable moments?", "What would you improve?", "Favorite connection?"
- After 4-5 exchanges, say "Thanks! Your feedback helps our community."`;

    const messages = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];

    // Add chat history (last 10 messages)
    if (chatHistory && Array.isArray(chatHistory)) {
      const recentHistory = chatHistory.slice(-10);
      recentHistory.forEach(entry => {
        messages.push({
          role: entry.type === 'user' ? 'user' : 'assistant',
          content: entry.message
        });
      });
    }

    // Add current message
    messages.push({
      role: 'user',
      content: message
    });

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
        max_tokens: 500,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      res.status(500).json({ error: 'OpenAI API error', details: errorData });
      return;
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    res.status(200).json({
      success: true,
      response: aiResponse
    });

  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ 
      error: 'Failed to process chat request',
      details: error.message 
    });
  }
}