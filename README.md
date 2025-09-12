# Arrow API

A Node.js API for checking Roblox group membership with MongoDB cookie storage, designed for deployment on Railway.

## Features

- **Roblox Group Membership**: Check if a user is in a specific Roblox group
- **API Key Authentication**: Secure endpoints with API key validation
- **MongoDB Integration**: Store cookies and API keys in MongoDB
- **Railway Ready**: Configured for easy deployment on Railway

## API Endpoints

### Health Check
```
GET /health
```
Returns the API status and timestamp.

### Group Membership Check
```
GET /{robloxuserid}/{groupid}
```

**Headers Required:**
- `api-key`: Your valid API key

**Response Format:**
```json
{
  "apiKey": "API Key is valid and exists",
  "membership": "In group",
  "rankName": "Member",
  "rankID": 1,
  "groupName": "Example Group",
  "groupID": 12345
}
```

If user is not in group:
```json
{
  "apiKey": "API Key is valid and exists",
  "membership": "Not in group"
}
```

If API key is invalid:
```json
{
  "error": "API Key is invalid or no longer exists"
}
```

## Environment Variables

Create a `.env` file with the following variables:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/arrow-api

# API Configuration
PORT=3000
API_KEYS=your-api-key-1,your-api-key-2,your-api-key-3

# Roblox Configuration
ROBLOX_COOKIE=your-roblox-cookie-here
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables in `.env`
4. Start the server:
   ```bash
   npm start
   ```

For development with auto-reload:
```bash
npm run dev
```

## Railway Deployment

1. Connect your GitHub repository to Railway
2. Set the environment variables in Railway dashboard:
   - `MONGODB_URI`: Your MongoDB connection string
   - `API_KEYS`: Comma-separated list of API keys
   - `ROBLOX_COOKIE`: Your Roblox authentication cookie
3. Deploy!

The API will automatically:
- Connect to MongoDB
- Initialize API keys from environment variables
- Start the server on Railway's assigned port

## Database Models

### API Keys
- Stored in MongoDB with usage tracking
- Automatically initialized from environment variables
- Can be managed through the database

### Cookies
- Roblox cookies stored securely in MongoDB
- Fallback to environment variable if no database cookie exists
- Support for multiple cookie management

## Security Notes

- Never commit your `.env` file
- Use strong, unique API keys
- Regularly rotate your Roblox cookies
- Monitor API key usage through the database
