import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'your_verify_token_here';
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Initialize Gemini AI
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    service: 'Instagram Webhook with Gemini AI',
    gemini_enabled: !!GEMINI_API_KEY,
    instagram_enabled: !!INSTAGRAM_ACCESS_TOKEN
  });
});

// Webhook verification (GET)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✓ Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      console.log('✗ Verification failed - token mismatch');
      res.sendStatus(403);
    }
  } else {
    console.log('✗ Verification failed - missing parameters');
    res.sendStatus(400);
  }
});

// Webhook events handler (POST)
app.post('/webhook', (req, res) => {
  const body = req.body;

  // Immediately respond with 200 OK (required within 20 seconds)
  res.status(200).send('EVENT_RECEIVED');

  // Process the webhook event after responding
  if (body.object === 'instagram') {
    body.entry?.forEach((entry) => {
      const changes = entry.changes || [];
      
      changes.forEach((change) => {
        console.log('Received change:', JSON.stringify(change, null, 2));
        
        switch (change.field) {
          case 'comments':
            handleComment(change.value);
            break;
          case 'mentions':
            handleMention(change.value);
            break;
          case 'story_insights':
            handleStoryInsights(change.value);
            break;
          default:
            console.log(`Unhandled field: ${change.field}`);
        }
      });
    });
  }
});

// Generate AI response using Gemini
async function generateGeminiResponse(commentText, context = {}) {
  if (!genAI) {
    console.log('Gemini API not configured');
    return null;
  }

  try {
    // Use Gemini 2.0 Flash model (latest)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // Create context-aware prompt
    const prompt = `You are a helpful Instagram assistant for a business account. 
A user commented: "${commentText}"

Respond in a friendly, professional, and concise way (max 50 words). 
${context.username ? `The user's name is ${context.username}.` : ''}
${context.businessInfo ? `Business info: ${context.businessInfo}` : ''}

Guidelines:
- Be warm and engaging
- If asked about prices, mention checking bio/DM for details
- If it's a question, answer helpfully
- If it's praise, thank them genuinely
- Keep it brief and natural
- Use 1 emoji max

Response:`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✓ Gemini generated response:', text);
    return text.trim();

  } catch (error) {
    console.error('✗ Gemini API error:', error.message);
    return null;
  }
}

// Handle comment events with AI auto-reply
async function handleComment(value) {
  console.log('Comment event:', value);

  if (!INSTAGRAM_ACCESS_TOKEN) {
    console.log('No Instagram access token - skipping reply');
    return;
  }

  try {
    const commentText = value.text || '';
    const commentId = value.id;
    const username = value.from?.username || 'there';

    // Skip if no text
    if (!commentText.trim()) {
      console.log('Empty comment - skipping');
      return;
    }

    // Filter spam/bot comments
    if (isSpamComment(commentText)) {
      console.log('Spam detected - hiding comment');
      await hideComment(commentId);
      return;
    }

    // Generate AI response with context
    const aiResponse = await generateGeminiResponse(commentText, {
      username: username,
      businessInfo: 'We sell premium products and offer great customer service'
    });

    // Send AI-generated reply
    if (aiResponse) {
      await replyToComment(commentId, aiResponse);
      console.log('✓ Auto-reply sent');
    } else {
      // Fallback to basic reply if Gemini fails
      console.log('Using fallback reply');
      await replyToComment(commentId, `Thanks for your comment! 😊`);
    }

  } catch (error) {
    console.error('Error handling comment:', error.message);
  }
}

// Handle mention events
async function handleMention(value) {
  console.log('Mention event:', value);

  try {
    const mediaId = value.media_id;
    
    // Get media details if needed
    if (INSTAGRAM_ACCESS_TOKEN && mediaId) {
      const details = await getMediaDetails(mediaId);
      console.log('Media details:', details);
      
      // You could use Gemini to analyze the mention context
      // and decide how to respond or what action to take
    }

  } catch (error) {
    console.error('Error handling mention:', error.message);
  }
}

// Handle story insights
async function handleStoryInsights(value) {
  console.log('Story insights event:', value);
  // Add your insights processing logic here
}

// Check if comment is spam
function isSpamComment(text) {
  const spamKeywords = [
    'click here',
    'buy followers',
    'free followers',
    'check my bio',
    'dm for promotion',
    'get rich',
    'make money fast',
    'weight loss',
    'crypto'
  ];

  const lowerText = text.toLowerCase();
  return spamKeywords.some(keyword => lowerText.includes(keyword));
}

// Instagram API: Reply to comment
async function replyToComment(commentId, message) {
  const url = `https://graph.instagram.com/v21.0/${commentId}/replies`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message,
      access_token: INSTAGRAM_ACCESS_TOKEN
    })
  });

  const result = await response.json();

  if (result.error) {
    throw new Error(`Instagram API error: ${result.error.message}`);
  }

  return result;
}

// Instagram API: Hide comment
async function hideComment(commentId) {
  const url = `https://graph.instagram.com/v21.0/${commentId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hide: true,
      access_token: INSTAGRAM_ACCESS_TOKEN
    })
  });

  const result = await response.json();

  if (result.error) {
    throw new Error(`Instagram API error: ${result.error.message}`);
  }

  return result;
}

// Instagram API: Get media details
async function getMediaDetails(mediaId) {
  const fields = 'id,caption,media_type,media_url,timestamp,username';
  const url = `https://graph.instagram.com/v21.0/${mediaId}?fields=${fields}&access_token=${INSTAGRAM_ACCESS_TOKEN}`;

  const response = await fetch(url);
  const result = await response.json();

  if (result.error) {
    throw new Error(`Instagram API error: ${result.error.message}`);
  }

  return result;
}

// Start server
app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Gemini AI: ${GEMINI_API_KEY ? 'Enabled' : 'Disabled'}`);
  console.log(`✓ Instagram API: ${INSTAGRAM_ACCESS_TOKEN ? 'Enabled' : 'Disabled'}`);
});
