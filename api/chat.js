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

        // Prepare request to local AI API via Cloudflare tunnel
        const aiRequest = {
            messages: [
                { role: 'system', content: 'You are a helpful AI assistant.' },
                { role: 'user', content: message }
            ],
            stream: false  // Non-streaming for reliability
        };

        console.log('Sending request to API with payload:', JSON.stringify(aiRequest));

        // Send request to Cloudflare-exposed AI server
        const response = await axios.post('https://api.devcabin.com/v1/chat/completions', aiRequest, {
            headers: { 
                'Content-Type': 'application/json'
            },
            timeout: 30000,  // 30-second timeout
            transformResponse: [function (data) {
                // Log raw response for debugging
                console.log('Raw API response:', data);
                return data;
            }]
        });

        // Log full response for debugging
        console.log('Full API response:', JSON.stringify(response.data));

        // Validate response structure
        if (!response.data || !response.data.choices || !response.data.choices[0]) {
            throw new Error('Unexpected API response format');
        }

        // Return the AI's response
        res.status(200).json({
            message: response.data.choices[0].message.content
        });

    } catch (error) {
        // Log full error details
        console.error('Full error object:', error);

        // Log specific error message and any response data
        if (error.response) {
            console.error('Response error data:', error.response.data);
            console.error('Response error status:', error.response.status);
        }

        // Detailed error response
        if (error.response) {
            // The request was made and the server responded with a status code
            res.status(error.response.status).json({
                error: 'AI API Error',
                details: error.response.data ? JSON.stringify(error.response.data) : 'Unknown error'
            });
        } else if (error.request) {
            // The request was made but no response was received
            res.status(503).json({
                error: 'No response from AI server',
                details: 'The AI server might be down or unreachable'
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
