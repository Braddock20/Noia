import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Verify token - set this in your Render environment variables
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'your_verify_token_here';

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Instagram Webhook Server Running');
});

// Webhook verification (GET) - Meta sends this to verify your endpoint
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Check if mode and token are present
  if (mode && token) {
    // Verify the token matches your verify token
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook verified successfully');
      // Respond with challenge to complete verification
      res.status(200).send(challenge);
    } else {
      console.log('Verification failed - token mismatch');
      res.sendStatus(403);
    }
  } else {
    console.log('Verification failed - missing parameters');
    res.sendStatus(400);
  }
});

// Webhook events handler (POST) - Receives Instagram events
app.post('/webhook', (req, res) => {
  const body = req.body;

  // Immediately respond with 200 OK (required within 20 seconds)
  res.status(200).send('EVENT_RECEIVED');

  // Process the webhook event after responding
  if (body.object === 'instagram') {
    // Loop through each entry (can contain multiple)
    body.entry?.forEach((entry) => {
      // Get the webhook changes
      const changes = entry.changes || [];
      
      changes.forEach((change) => {
        console.log('Received change:', JSON.stringify(change, null, 2));
        
        // Handle different webhook fields
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
  } else {
    console.log('Not an Instagram webhook event');
  }
});

// Event handlers - implement your business logic here
function handleComment(value) {
  console.log('Comment event:', value);
  // Add your comment handling logic
}

function handleMention(value) {
  console.log('Mention event:', value);
  // Add your mention handling logic
}

function handleStoryInsights(value) {
  console.log('Story insights event:', value);
  // Add your insights handling logic
}

// Start server
app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});
