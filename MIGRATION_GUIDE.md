# Migration Guide: Flask + SSE → FastAPI + WebSocket

This guide outlines the migration from Flask with Server-Sent Events (SSE) to FastAPI with WebSocket for better real-time performance and production readiness.

## Overview of Changes

### Backend Architecture

- **Framework**: Flask → FastAPI
- **Real-time**: SSE → WebSocket
- **Authentication**: Sessions → JWT Tokens
- **Database**: PyMongo → Motor (async)
- **Server**: Gunicorn → Uvicorn

### Frontend Updates

- **Real-time**: SSE hooks → WebSocket hooks
- **Authentication**: Session-based → JWT token-based
- **API Calls**: Updated to include Authorization headers

## Step-by-Step Migration

### 1. Backend Migration

#### Files Changed:

- `backend/app.py` → `backend/main.py` (completely rewritten)
- `backend/requirements.txt` (updated dependencies)
- `backend/Procfile` (updated for Uvicorn)
- `backend/models/*.py` (converted to async)
- `backend/utils/twitch_chat.py` (minor updates)

#### Key Changes:

1. **FastAPI Application**: Modern async framework with automatic API docs
2. **WebSocket Endpoints**: Real-time bidirectional communication
3. **JWT Authentication**: Stateless token-based auth
4. **Async Database**: All MongoDB operations are now async
5. **Better Error Handling**: Comprehensive error responses

### 2. Frontend Migration

#### Files Changed:

- `frontend/src/hooks/useSSEConnection.js` → `frontend/src/hooks/useWebSocketConnection.js`
- `frontend/src/contexts/AnalyzeContext.jsx` (updated for WebSocket)
- `frontend/src/contexts/AuthContext.jsx` (updated for JWT)
- `frontend/src/components/auth/Login.jsx` (updated for JWT)

#### Key Changes:

1. **WebSocket Connection**: More reliable than SSE with automatic reconnection
2. **JWT Token Management**: Tokens stored in localStorage
3. **Authorization Headers**: All API calls include Bearer token
4. **Better Error Handling**: Improved connection management

## Deployment Instructions

### 1. Environment Variables

Update your environment variables:

```env
# Add these new variables
SECRET_KEY=your-secret-key-here
ENVIRONMENT=production

# Keep existing variables
MONGO_URI=your-mongodb-uri
MONGO_DBNAME=twitch_sentiment
EMAIL_SENDER=your-email
EMAIL_PASSWORD=your-password
FRONTEND_URL=your-frontend-url
```

### 2. Database Migration

No database schema changes required. The existing data is compatible.

### 3. Frontend Environment

Update your frontend environment variables:

```env
VITE_API_URL=your-backend-url
```

### 4. Production Deployment

#### Railway/Render/Heroku

The `Procfile` is already updated:

```
web: uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1
```

#### Manual Deployment

```bash
# Install new dependencies
pip install -r requirements.txt

# Run the application
python start.py
```

## Testing the Migration

### 1. Backend Testing

```bash
# Test health endpoint
curl http://localhost:8000/health

# Test WebSocket connection
# Use a WebSocket client to connect to ws://localhost:8000/ws/chat/testchannel
```

### 2. Frontend Testing

1. **Login**: Verify JWT token is stored and used
2. **WebSocket**: Check browser console for WebSocket connection
3. **Real-time**: Test chat analysis with live Twitch stream
4. **Reconnection**: Test network interruption and reconnection

### 3. Production Testing

1. **HTTPS**: Ensure WebSocket works over WSS
2. **CORS**: Verify CORS settings for your domain
3. **Load Testing**: Test with multiple concurrent connections
4. **Monitoring**: Check logs and health endpoints

## Performance Improvements

### Expected Benefits:

1. **Faster Response Times**: Async operations reduce latency
2. **Better Real-time**: WebSocket is more efficient than SSE
3. **Scalability**: JWT tokens enable horizontal scaling
4. **Resource Usage**: Lower memory footprint with async operations
5. **Connection Management**: Better handling of concurrent connections

### Monitoring:

- Use `/health` endpoint for monitoring
- Check WebSocket connection counts
- Monitor JWT token expiration
- Track database connection pool usage

## Rollback Plan

If issues occur, you can rollback by:

1. **Revert Code**: Switch back to Flask version
2. **Update Dependencies**: Revert to Flask requirements
3. **Update Procfile**: Change back to Gunicorn
4. **Frontend**: Revert to SSE implementation

## Common Issues and Solutions

### 1. WebSocket Connection Failed

**Issue**: WebSocket connection fails in production
**Solution**:

- Check CORS settings
- Ensure WSS is used for HTTPS
- Verify firewall settings

### 2. JWT Token Issues

**Issue**: Authentication fails
**Solution**:

- Check SECRET_KEY is set
- Verify token expiration settings
- Ensure Authorization header format

### 3. Database Connection

**Issue**: MongoDB connection fails
**Solution**:

- Verify MONGO_URI format
- Check network connectivity
- Ensure Motor driver compatibility

### 4. Email Sending

**Issue**: Email notifications fail
**Solution**:

- Check email credentials
- Verify SMTP settings
- Test email sending separately

## Support

For issues during migration:

1. Check the logs for error messages
2. Verify environment variables
3. Test individual components
4. Check the health endpoint
5. Review WebSocket connection status

## Post-Migration Checklist

- [ ] Backend starts without errors
- [ ] WebSocket connections work
- [ ] JWT authentication functions
- [ ] Database operations work
- [ ] Email sending works
- [ ] Frontend connects to backend
- [ ] Real-time chat analysis works
- [ ] Admin functions work
- [ ] Production deployment successful
- [ ] Monitoring and logging active
