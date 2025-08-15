# GPT-OSS Chat Web Wrapper

## Overview
This project provides a web-based chat interface for interacting with a local GPT-OSS-20B model, deployed on Vercel.

## Prerequisites
- Node.js (v18 or later)
- Vercel CLI
- Local GPT-OSS-20B API running at `api.devcabin.com`

## Setup

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/gpt-oss-chat-wrapper.git
cd gpt-oss-chat-wrapper
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
If your local API requires authentication, set the Vercel secret:
```bash
# Only needed if your API requires authentication
vercel secrets add gpt_oss_api_key your_api_key_here
```

Set the API URL:
```bash
vercel secrets add gpt_oss_api_url https://api.devcabin.com/v1/chat/completions
```

### 4. Local Development
```bash
npm start
```

### 5. Deployment to Vercel
```bash
npm run deploy
```

## Configuration

### API Endpoint
- The chat API is located at `/api/chat`
- Expects a POST request with JSON body: `{ "message": "Your message here" }`

### Environment Variables
- `GPT_OSS_API_URL`: URL of the local GPT-OSS-20B API
- `GPT_OSS_API_KEY` (Optional): Authentication key for the API, if required

## Troubleshooting
- Ensure your local GPT-OSS-20B API is running and accessible
- Check Vercel logs for any deployment or runtime errors
- Verify environment variables are correctly set

## Security Considerations
- Use HTTPS for all API communications
- Keep API keys confidential if used
- Implement rate limiting on your local API

## License
[Your License Here]
