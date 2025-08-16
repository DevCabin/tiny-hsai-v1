import axios from 'axios';

export default async function handler(req, res) {
    // Catch-all error handler
    try {
        // Detailed request logging
        console.log('Full request object:', {
            method: req.method,
            body: req.body,
            headers: req.headers
        });

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

        // Potential API base URLs to try
        const POTENTIAL_URLS = [
            process.env.API_BASE_URL,  // User-defined URL
            'http://localhost:1234',   // Default LM Studio
            'http://127.0.0.1:1234',   // Alternate localhost
            'http://host.docker.internal:1234'  // Docker host networking
        ].filter(Boolean);  // Remove any undefined values

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
            stream: false  // Non-streaming for reliability
        };

        console.log('Prepared AI Request:', JSON.stringify(aiRequest));
        console.log('Attempting URLs:', POTENTIAL_URLS);

        // Try each potential URL
        let lastError = null;
        for (const baseURL of POTENTIAL_URLS) {
            try {
                console.log(`Trying URL: ${baseURL}`);

                // Custom axios instance with interceptors
                const instance = axios.create({
                    baseURL,
                    timeout: 10000,  // Reduced timeout for faster failover
                    headers: { 
                        'Content-Type': 'application/json',
                        // Add ngrok-specific headers to bypass warning
                        'ngrok-skip-browser-warning': '1',
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
                    }
                });

                // Send request to local AI server
                const response = await instance.post('/v1/chat/completions', aiRequest);

                // Validate response structure
                if (!response.data) {
                    console.error('No data in response from', baseURL);
                    continue;
                }

                if (!response.data.choices || !response.data.choices[0]) {
                    console.error('Invalid response structure from', baseURL);
                    continue;
                }

                // Return the AI's response
                res.status(200).json({
                    message: response.data.choices[0].message.content
                });

                return;  // Successfully sent response, exit function
            } catch (error) {
                console.error(`Error with URL ${baseURL}:`, error.message);
                lastError = error;
            }
        }

        // If no URL worked
        throw lastError || new Error('Could not connect to any AI server');

    } catch (error) {
        // Comprehensive error logging
        console.error('Unhandled Error:', error);

        // Attempt to extract meaningful error information
        let errorDetails = 'Unknown error occurred';
        let statusCode = 500;

        if (error.response) {
            // Server responded with an error
            console.error('Response Error Data:', error.response.data);
            console.error('Response Error Status:', error.response.status);
            
            // Try to parse error response
            try {
                errorDetails = JSON.stringify(error.response.data);
            } catch {
                errorDetails = error.response.data.toString();
            }
            
            statusCode = error.response.status;
        } else if (error.request) {
            // Request was made but no response received
            errorDetails = 'No response received from server. Check server status and network.';
            statusCode = 503;
        } else {
            // Something happened in setting up the request
            errorDetails = error.message;
            statusCode = 500;
        }

        // Send error response
        res.status(statusCode).json({
            error: 'API Communication Error',
            details: errorDetails,
            potentialUrls: process.env.API_BASE_URL ? [process.env.API_BASE_URL] : []
        });
    }
}
