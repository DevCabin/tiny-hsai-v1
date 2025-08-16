import axios from 'axios';

export default async function handler(req, res) {
    // Global error logging function
    const logError = (message, details = {}) => {
        console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            message,
            ...details
        }));
    };

    try {
        // Extensive request logging
        logError('Incoming Request', {
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
            'https://c83e2baa5243.ngrok-free.app',  // Explicit ngrok URL
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

        logError('Prepared AI Request', { request: aiRequest });
        logError('Attempting URLs', { urls: POTENTIAL_URLS });

        // Try each potential URL
        let lastError = null;
        for (const baseURL of POTENTIAL_URLS) {
            try {
                logError(`Trying URL: ${baseURL}`);

                // Custom axios instance with extreme error handling
                const instance = axios.create({
                    baseURL,
                    timeout: 15000,  // Increased timeout
                    transformResponse: [function (data) {
                        // Log raw response data
                        logError('Raw Response Data', { 
                            dataType: typeof data,
                            dataLength: data ? data.length : 'N/A',
                            dataStart: data ? data.substring(0, 200) : 'N/A'
                        });

                        // Attempt to parse with extensive error handling
                        if (typeof data === 'string') {
                            try {
                                return JSON.parse(data);
                            } catch (parseError) {
                                logError('JSON Parsing Error', {
                                    originalData: data,
                                    parseErrorMessage: parseError.message
                                });
                                
                                // If parsing fails, try to clean or modify the data
                                const cleanedData = data.trim()
                                    .replace(/^[^{[]*/, '')  // Remove any leading non-JSON characters
                                    .replace(/[^}\]]*$/, '');  // Remove any trailing non-JSON characters
                                
                                try {
                                    return JSON.parse(cleanedData);
                                } catch (secondParseError) {
                                    logError('Cleaned Data Parsing Error', {
                                        cleanedData,
                                        parseErrorMessage: secondParseError.message
                                    });
                                    throw parseError;
                                }
                            }
                        }
                        return data;
                    }],
                    headers: { 
                        'Content-Type': 'application/json',
                        'ngrok-skip-browser-warning': '1',
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36'
                    }
                });

                // Send request to local AI server
                const response = await instance.post('/v1/chat/completions', aiRequest);

                logError('Response Received', { 
                    status: response.status, 
                    data: JSON.stringify(response.data).substring(0, 500) 
                });

                // Validate response structure
                if (!response.data) {
                    logError('No data in response', { baseURL });
                    continue;
                }

                if (!response.data.choices || !response.data.choices[0]) {
                    logError('Invalid response structure', { 
                        baseURL, 
                        responseData: JSON.stringify(response.data) 
                    });
                    continue;
                }

                // Return the AI's response
                res.status(200).json({
                    message: response.data.choices[0].message.content
                });

                return;  // Successfully sent response, exit function
            } catch (error) {
                logError(`Error with URL ${baseURL}`, {
                    errorMessage: error.message,
                    errorStack: error.stack,
                    errorResponse: error.response ? JSON.stringify(error.response.data) : 'No response'
                });
                lastError = error;
            }
        }

        // If no URL worked
        throw lastError || new Error('Could not connect to any AI server');

    } catch (error) {
        // Comprehensive error logging
        logError('Unhandled Error', {
            errorMessage: error.message,
            errorStack: error.stack
        });

        // Attempt to extract meaningful error information
        let errorDetails = 'Unknown error occurred';
        let statusCode = 500;

        if (error.response) {
            // Server responded with an error
            logError('Response Error', {
                errorData: error.response.data,
                errorStatus: error.response.status
            });
            
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
            potentialUrls: POTENTIAL_URLS
        });
    }
}
