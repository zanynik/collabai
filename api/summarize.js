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
    const { chatHistory, currentContent, type } = req.body;

    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'OpenAI API key not configured' });
      return;
    }

    let prompt, messages;

    if (type === 'summarize_chat') {
      // Generate summary from chat history
      if (!chatHistory || !Array.isArray(chatHistory)) {
        res.status(400).json({ error: 'Chat history is required for summarization' });
        return;
      }

      const chatText = chatHistory.map(entry => 
        `${entry.type.toUpperCase()}: ${entry.message}`
      ).join('\n\n');

      messages = [
        {
          role: 'system',
          content: `You are the summarizer for Nomad Fest Switzerland community feedback.
Your job is to create concise summaries from participant feedback conversations.

Instructions:
- Focus on what participants found meaningful: workshops, talks, hikes, ceremonies, community dinners, networking, insights, personal growth.
- Discard trivial or logistical info (number of participants, meal times, bus schedules, maps).
- Extract key experiences, learnings, and constructive suggestions.
- Format as clear, community-oriented markdown with bullet points.
- Keep it concise but capture the essence of what made the experience meaningful.`
        },
        {
          role: 'user',
          content: `Please summarize this participant feedback conversation:\n\n${chatText}`
        }
      ];

    } else if (type === 'combine_summaries') {
      // Combine existing content with new summary
      if (!currentContent || !req.body.newSummary) {
        res.status(400).json({ error: 'Current content and new summary are required for combining' });
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

Required Format - Generate ONLY the content inside the <div id="content"> tags:
<h1>Community Summary – Nomad Fest Switzerland 2025</h1>

<p>[short welcoming sentence]</p>

<h2>🌟 Highlights</h2>
<div class="section-content">
[bullet points or paragraphs with positive experiences - use <ul><li> for lists]
</div>

<h2>💡 Learnings & Takeaways</h2>
<div class="section-content">
[what participants said they learned - use <ul><li> for lists]
</div>

<h2>💭 Suggestions</h2>
<div class="section-content">
[constructive feedback or ideas for future editions - use <ul><li> for lists]
</div>

<hr>

<div class="footer">
<em>This page is automatically updated when participants submit their feedback through our anonymous chat.</em>
</div>

IMPORTANT: Only output the HTML content that goes inside the content div, not the full HTML page structure.`
        },
        {
          role: 'user',
          content: `Current summary:\n${currentContent}\n\nNew feedback to incorporate:\n${req.body.newSummary}\n\nPlease create an updated community summary that incorporates the new feedback while maintaining the required format.`
        }
      ];

    } else {
      res.status(400).json({ error: 'Invalid type. Use "summarize_chat" or "combine_summaries"' });
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
        max_tokens: type === 'summarize_chat' ? 300 : 800,
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
    console.error('Summarize API error:', error);
    res.status(500).json({ 
      error: 'Failed to process summarization request',
      details: error.message 
    });
  }
}