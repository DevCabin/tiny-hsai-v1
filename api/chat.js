import axios from 'axios';

export default async function handler(req, res) {
    // Global error logging function with enhanced details
    const logError = (message, details = {}) => {
        const errorLog = {
            timestamp: new Date().toISOString(),
            message,
            requestMethod: req.method,
            requestBody: req.body,
            requestHeaders: req.headers,
            ...details
        };
        console.error(JSON.stringify(errorLog));
    };

    // Catch-all error handler with comprehensive logging
    try {
        logError('API Route Accessed', {
            method: req.method,
            body: req.body,
            headers: req.headers
        });

        // CORS headers with more permissive settings
        res.setHeader('Access-Control-Allow-Credentials', 'true');
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

        // Validate request method
        if (req.method !== 'POST') {
            logError('Invalid Request Method', { 
                allowedMethods: ['POST'], 
                receivedMethod: req.method 
            });
            res.status(405).json({ 
                error: 'Method Not Allowed', 
                allowedMethods: ['POST'] 
            });
            return;
        }

        // Validate request body
        if (!req.body || Object.keys(req.body).length === 0) {
            logError('Empty Request Body');
            res.status(400).json({ 
                error: 'Bad Request', 
                details: 'Request body is empty' 
            });
            return;
        }

        // Extract message from request with robust parsing
        const message = req.body.message || 
            (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

        if (!message) {
            logError('No Message Provided', { requestBody: req.body });
            res.status(400).json({ 
                error: 'No message provided', 
                details: 'Message is required in the request body' 
            });
            return;
        }

        // Potential API base URLs with explicit ngrok URL
        const POTENTIAL_URLS = [
            process.env.API_BASE_URL,  // User-defined URL
            'https://c83e2baa5243.ngrok-free.app',  // Explicit ngrok URL
            'http://localhost:1234',   // Default LM Studio
            'http://127.0.0.1:1234',   // Alternate localhost
            'http://host.docker.internal:1234'  // Docker host networking
        ].filter(Boolean);  // Remove any undefined values

        logError('Potential API URLs', { urls: POTENTIAL_URLS });

        // Prepare request to local AI API
        const aiRequest = {
            messages: [
                { role: 'system', content: 'You are a helpful AI assistant.' },
                { role: 'user', content: message }
            ],
            stream: false  // Non-streaming for reliability
        };

        logError('Prepared AI Request', { request: aiRequest });

        // Try each potential URL
        let lastError = null;
        for (const baseURL of POTENTIAL_URLS) {
            try {
                logError(`Attempting URL: ${baseURL}`);

                // Custom axios instance with extreme error handling
                const instance = axios.create({
                    baseURL,
                    timeout: 15000,  // Increased timeout
                    transformResponse: [function (data) {
                        logError('Raw Response Data', { 
                            dataType: typeof data,
                            dataLength: data ? data.length : 'N/A',
                            dataStart: data ? data.substring(0, 200) : 'N/A'
                        });

                        // Attempt to parse with extensive error handling
                        if (typeof data === 'string') {
                            try {
                                // Trim and remove any leading non-JSON characters
                                const cleanedData = data.trim()
                                    .replace(/^[^{[]*/, '')   // Remove leading non-JSON
                                    .replace(/[^}\]]*$/, ''); // Remove trailing non-JSON

                                return JSON.parse(cleanedData);
                            } catch (parseError) {
                                logError('JSON Parsing Error', {
                                    originalData: data,
                                    parseErrorMessage: parseError.message
                                });
                                throw parseError;
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
        // Final catch-all error handling
        logError('Unhandled Error in API Route', {
            errorMessage: error.message,
            errorStack: error.stack,
            requestBody: req.body
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
