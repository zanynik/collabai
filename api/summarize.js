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
    const { conversationSummary, currentContent, type, userName } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'OpenAI API key not configured' });
      return;
    }

    let messages;

    if (type === 'integrate_content') {
      // Integrate conversation summary into existing content
      if (!currentContent || !conversationSummary) {
        res.status(400).json({ error: 'Current content and conversation summary are required for integration' });
        return;
      }

      messages = [
        {
          role: 'system',
          content: `You are the summarizer for Nomad Fest Switzerland.
Your job is to maintain a living community summary in Markdown format (info.md). 
You receive new chat transcripts from the feedback chatbot and must update the summary incrementally.

Instructions:
- Keep the summary clear, concise, and community-oriented.
- Focus on what participants found meaningful: workshops, talks, hikes, ceremonies, community dinners, networking, insights, personal growth.
- Discard trivial or logistical info (number of participants, meal times, bus schedules, maps).
- Group similar feedback together under short headings (e.g. "Workshops & Talks", "Community & Networking", "Suggestions for Next Year").
- Maintain a narrative style: not just a list of events, but what people actually experienced and learned.
- Always output the full updated Markdown document, not just incremental changes.

Required Format:
# Community Summary – Nomad Fest Switzerland 2025
[short welcoming sentence]

## Highlights
[bullet points or short paragraphs summarizing positive experiences]

## Learnings & Takeaways
[what participants said they learned]

## Suggestions
[constructive feedback or ideas for future editions]`
        },
        {
          role: 'user',
          content: `Current summary:\n${currentContent}\n\nConversation insights to incorporate:\n${JSON.stringify(conversationSummary, null, 2)}\n\nPlease create an updated community summary that incorporates the new insights while maintaining the required format.`
        }
      ];

    } else {
      res.status(400).json({ error: 'Invalid type. Use "integrate_content"' });
      return;
    }

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
        max_tokens: 800,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      res.status(500).json({ error: 'OpenAI API error', details: errorData });
      return;
    }

    const data = await response.json();
    const result = data.choices[0].message.content;

    res.status(200).json({
      success: true,
      result: result
    });

  } catch (error) {
    console.error('Content integration API error:', error);
    res.status(500).json({ 
      error: 'Failed to process content integration request',
      details: error.message 
    });
  }
}