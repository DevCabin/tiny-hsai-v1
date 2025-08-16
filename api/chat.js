import axios from 'axios';

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow POST
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    try {
        // Extract message from request
        const { message } = req.body;

        if (!message) {
            res.status(400).json({ error: 'No message provided' });
            return;
        }

        // Prepare request to local AI API
        const aiRequest = {
            messages: [
                { role: 'system', content: 'You are a helpful AI assistant.' },
                { role: 'user', content: message }
            ],
            stream: false  // Simplified to non-streaming for reliability
        };

        // Send request to local AI server
        const response = await axios.post('http://localhost:1234/v1/chat/completions', aiRequest, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000  // 10-second timeout
        });

        // Return the AI's response
        res.status(200).json({
            message: response.data.choices[0].message.content
        });

    } catch (error) {
        console.error('Chat API Error:', error.message);

        // Detailed error response
        if (error.response) {
            // The request was made and the server responded with a status code
            res.status(error.response.status).json({
                error: 'AI API Error',
                details: error.response.data
            });
        } else if (error.request) {
            // The request was made but no response was received
            res.status(503).json({
                error: 'No response from AI server',
                details: 'The local AI server might be down or unreachable'
            });
        } else {
            // Something happened in setting up the request
            res.status(500).json({
                error: 'Internal server error',
                details: error.message
            });
        }
    }
}
