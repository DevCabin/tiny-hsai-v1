import axios from 'axios';

// Configuration for the local GPT-OSS-20B API
const GPT_OSS_API_URL = process.env.GPT_OSS_API_URL || 'https://api.devcabin.com/v1/chat/completions';
const API_KEY = process.env.GPT_OSS_API_KEY;

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    try {
        // Extract user message from request
        const { message } = req.body;

        if (!message) {
            res.status(400).json({ error: 'No message provided' });
            return;
        }

        // Prepare request to local GPT-OSS-20B API
        const gptRequest = {
            model: 'gpt-oss-20b',
            messages: [
                { role: 'system', content: 'You are a helpful AI assistant.' },
                { role: 'user', content: message }
            ],
            stream: true  // Enable streaming responses
        };

        // Prepare headers for the request
        const headers = {
            'Content-Type': 'application/json'
        };

        // Conditionally add Authorization header if API_KEY is set
        if (API_KEY) {
            headers['Authorization'] = `Bearer ${API_KEY}`;
        }

        // Forward request to local GPT-OSS-20B API
        const response = await axios({
            method: 'post',
            url: GPT_OSS_API_URL,
            headers: headers,
            data: gptRequest,
            responseType: 'stream'
        });

        // Set headers for streaming response
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Transfer-Encoding', 'chunked');

        // Stream the response back to the client
        response.data.on('data', (chunk) => {
            try {
                const parsedChunk = JSON.parse(chunk.toString());
                if (parsedChunk.choices && parsedChunk.choices[0].delta.content) {
                    res.write(parsedChunk.choices[0].delta.content);
                }
            } catch (parseError) {
                console.error('Error parsing chunk:', parseError);
            }
        });

        response.data.on('end', () => {
            res.end();
        });

    } catch (error) {
        console.error('Chat API Error:', error);
        
        // More detailed error handling
        if (error.response) {
            // The request was made and the server responded with a status code
            res.status(error.response.status).json({
                error: 'External API error',
                details: error.response.data
            });
        } else if (error.request) {
            // The request was made but no response was received
            res.status(503).json({
                error: 'No response from GPT-OSS API',
                details: 'The API might be down or unreachable'
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
