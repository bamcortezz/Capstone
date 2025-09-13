# Twitch Sentiment Analysis API - FastAPI Version

A modern, high-performance API for real-time Twitch chat sentiment analysis using FastAPI and WebSockets.

## Features

- **FastAPI**: Modern, fast web framework for building APIs
- **WebSocket Support**: Real-time bidirectional communication
- **JWT Authentication**: Secure token-based authentication
- **Async MongoDB**: High-performance database operations with Motor
- **Real-time Chat Analysis**: Live sentiment analysis of Twitch chat messages
- **Production Ready**: Optimized for deployment with proper error handling

## Architecture Changes from Flask

### Backend Migration

- **Flask → FastAPI**: Modern async framework with automatic API documentation
- **SSE → WebSocket**: Bidirectional real-time communication
- **Sessions → JWT**: Stateless authentication with tokens
- **PyMongo → Motor**: Async MongoDB driver for better performance
- **Gunicorn → Uvicorn**: ASGI server optimized for FastAPI

### Frontend Updates

- **SSE Hooks → WebSocket Hooks**: Real-time communication with better reliability
- **Session Auth → JWT Auth**: Token-based authentication
- **Improved Error Handling**: Better connection management and reconnection logic

## Installation

1. **Install Dependencies**

   ```bash
   pip install -r requirements.txt
   ```

2. **Environment Variables**
   Create a `.env` file with:

   ```env
   SECRET_KEY=your-secret-key-here
   MONGO_URI=mongodb://localhost:27017/twitch_sentiment
   MONGO_DBNAME=twitch_sentiment
   EMAIL_SENDER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password
   FRONTEND_URL=http://localhost:5173
   ENVIRONMENT=development
   ```

3. **Run the Application**

   ```bash
   # Development
   python main.py

   # Production
   python start.py
   ```

## API Endpoints

### Authentication

- `POST /api/register` - User registration
- `POST /api/login` - User login (returns JWT token)
- `GET /api/authenticate` - Verify JWT token
- `POST /api/logout` - User logout

### WebSocket

- `WS /ws/chat/{channel}` - Real-time chat messages for a channel

### Twitch Integration

- `POST /api/twitch/connect` - Connect to Twitch chat
- `POST /api/twitch/disconnect` - Disconnect from Twitch chat

### Analysis

- `POST /api/history/save` - Save analysis results
- `GET /api/history` - Get user's analysis history
- `GET /api/history/{id}` - Get specific analysis
- `DELETE /api/history/{id}` - Delete analysis

### User Management

- `PUT /api/user/profile` - Update user profile
- `PUT /api/user/profile-image` - Update profile image
- `DELETE /api/user/profile-image` - Remove profile image
- `POST /api/user/change-password` - Change password
- `DELETE /api/user/delete-account` - Delete account

### Admin (Admin users only)

- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/count` - Get user statistics
- `GET /api/admin/comments/count` - Get comment statistics
- `GET /api/admin/usage/count` - Get usage statistics
- `PUT /api/admin/users/{id}` - Update user
- `GET /api/admin/logs` - Get system logs
- `POST /api/admin/logs/cleanup` - Cleanup old logs

## WebSocket Events

### Client to Server

- `ping` - Heartbeat message
- `message` - Chat message data

### Server to Client

- `pong` - Heartbeat response
- `heartbeat` - Server heartbeat
- `message` - New chat message with sentiment analysis
- `disconnect` - Channel disconnect notification

## Production Deployment

### Railway/Render/Heroku

```bash
# Procfile is already configured
web: uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1
```

### Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["python", "start.py"]
```

### Environment Variables for Production

```env
SECRET_KEY=your-production-secret-key
MONGO_URI=your-production-mongodb-uri
MONGO_DBNAME=twitch_sentiment_prod
EMAIL_SENDER=your-production-email
EMAIL_PASSWORD=your-production-email-password
FRONTEND_URL=https://your-frontend-domain.com
ENVIRONMENT=production
```

## Performance Improvements

1. **Async Operations**: All database operations are now async
2. **WebSocket Efficiency**: Better real-time communication than SSE
3. **JWT Authentication**: Stateless authentication reduces server load
4. **Connection Pooling**: Motor provides built-in connection pooling
5. **Error Handling**: Comprehensive error handling and logging

## Monitoring

- Health check endpoint: `GET /health`
- Automatic reconnection for WebSocket connections
- Comprehensive logging for debugging
- Database connection monitoring

## Migration Notes

### From Flask Version

1. Update frontend to use WebSocket instead of SSE
2. Update authentication to use JWT tokens
3. Update API calls to include Authorization headers
4. Test WebSocket connections in production environment

### Breaking Changes

- Authentication now uses JWT tokens instead of sessions
- WebSocket endpoints have different URLs
- Some API response formats may have changed
- CORS configuration is more strict in production

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**: Check CORS settings and WebSocket URL
2. **JWT Token Invalid**: Ensure token is included in Authorization header
3. **Database Connection**: Verify MongoDB URI and network access
4. **Email Sending**: Check email credentials and SMTP settings

### Logs

- Application logs are written to stdout
- Database connection status in health check
- WebSocket connection status in browser console
