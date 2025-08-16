import axios from 'axios';

export default async function handler(req, res) {
    // Enable detailed logging
    console.log('Incoming request body:', JSON.stringify(req.body));
    console.log('Request headers:', JSON.stringify(req.headers));

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

        console.log('Prepared AI Request:', JSON.stringify(aiRequest));

        // Send request to Cloudflare-exposed AI server
        const axiosConfig = {
            headers: { 
                'Content-Type': 'application/json'
            },
            timeout: 30000,
            // Add raw response handling
            transformResponse: [function (data) {
                console.log('Raw response data:', data);
                console.log('Response type:', typeof data);
                
                // Attempt to parse, with extensive logging
                try {
                    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                    console.log('Parsed response:', JSON.stringify(parsed));
                    return parsed;
                } catch (error) {
                    console.error('Parsing error:', error);
                    console.error('Unparseable data:', data);
                    throw new Error(`Unable to parse response: ${data}`);
                }
            }]
        };

        const response = await axios.post('https://api.devcabin.com/v1/chat/completions', aiRequest, axiosConfig);

        console.log('Full response data:', JSON.stringify(response.data));

        // Validate response structure
        if (!response.data || !response.data.choices || !response.data.choices[0]) {
            console.error('Invalid response structure:', JSON.stringify(response.data));
            throw new Error('Unexpected API response format');
        }

        // Return the AI's response
        res.status(200).json({
            message: response.data.choices[0].message.content
        });

    } catch (error) {
        // Extensive error logging
        console.error('Full error object:', error);

        if (error.response) {
            console.error('Response error data:', error.response.data);
            console.error('Response error status:', error.response.status);
            console.error('Response error headers:', error.response.headers);
        }

        // Detailed error response
        if (error.response) {
            res.status(error.response.status).json({
                error: 'AI API Error',
                details: error.response.data ? JSON.stringify(error.response.data) : 'Unknown error'
            });
        } else if (error.request) {
            res.status(503).json({
                error: 'No response from AI server',
                details: 'The AI server might be down or unreachable'
            });
        } else {
            res.status(500).json({
                error: 'Internal server error',
                details: error.message
            });
        }
    }
}
