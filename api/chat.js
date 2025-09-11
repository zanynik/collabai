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
    const { message, chatHistory } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'OpenAI API key not configured' });
      return;
    }

    // Prepare messages for OpenAI
    const messages = [
      {
        role: 'system',
        content: `You are the Anonymous AI Chatbot for the Nomad Fest Switzerland community feedback page.
Your job is to ask participants about their experiences, learnings, highlights, and suggestions from the event.

Important:
- Keep the tone friendly, curious, and non-judgmental.
- Guide users to reflect on specific sessions, workshops, or moments they enjoyed (or didn't).
- Ignore logistical details such as number of participants, lunch menus, time slots, or maps.
- Collect feedback in a way that can later be summarized for the public info page.

Conversation guidelines:
1. Start with a warm welcome: "Hi! I'd love to hear about your experience at Nomad Fest Switzerland. What stood out for you?"
2. Encourage participants to mention workshops, talks, hikes, ceremonies, or community moments that inspired them.
3. Ask what could be improved next time.
4. Wrap up by thanking them and letting them know their input will be shared in a community summary.`
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