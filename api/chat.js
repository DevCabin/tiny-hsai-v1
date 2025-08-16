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

        // Get API base URL from environment variable
        const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:1234';
        console.log('Using API Base URL:', API_BASE_URL);

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

        // Custom axios instance with interceptors
        const instance = axios.create({
            baseURL: API_BASE_URL,
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' }
        });

        // Request interceptor
        instance.interceptors.request.use(config => {
            console.log('Axios Request Config:', JSON.stringify(config));
            return config;
        }, error => {
            console.error('Axios Request Error:', error);
            return Promise.reject(error);
        });

        // Response interceptor
        instance.interceptors.response.use(
            response => {
                console.log('Axios Raw Response:', JSON.stringify(response.data));
                return response;
            },
            error => {
                console.error('Axios Response Error:', error);
                
                // Log detailed error information
                if (error.response) {
                    console.error('Error Response Data:', error.response.data);
                    console.error('Error Response Status:', error.response.status);
                    console.error('Error Response Headers:', error.response.headers);
                }

                return Promise.reject(error);
            }
        );

        // Send request to local AI server
        const response = await instance.post('/v1/chat/completions', aiRequest);

        // Validate response structure with extensive logging
        if (!response.data) {
            console.error('No data in response');
            throw new Error('No data received from AI server');
        }

        if (!response.data.choices || !response.data.choices[0]) {
            console.error('Invalid response structure:', JSON.stringify(response.data));
            throw new Error('Unexpected API response format');
        }

        // Return the AI's response
        res.status(200).json({
            message: response.data.choices[0].message.content
        });

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
            errorDetails = 'No response received from server';
            statusCode = 503;
        } else {
            // Something happened in setting up the request
            errorDetails = error.message;
            statusCode = 500;
        }

        // Send error response
        res.status(statusCode).json({
            error: 'API Communication Error',
            details: errorDetails
        });
    }
}
