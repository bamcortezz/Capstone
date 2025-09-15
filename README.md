# Twitch Insight - Real-time Chat Sentiment Analysis Platform

A comprehensive web application that provides real-time sentiment analysis of Twitch chat messages, helping streamers and moderators understand their audience's emotional engagement and make data-driven decisions.

## 🎯 Project Overview

**Twitch Insight** is a capstone project developed by third-year Information Technology students. It combines modern web technologies with advanced machine learning to deliver real-time insights into Twitch chat sentiment, enabling streamers to better understand their community's reactions and engagement patterns.

### Key Features

- **Real-time Sentiment Analysis**: Live analysis of Twitch chat messages using RoBERTa model
- **Multi-user Support**: Multiple users can analyze different channels simultaneously
- **Advanced Analytics**: Comprehensive sentiment breakdown with user statistics
- **AI-Powered Summaries**: Google Gemini integration for intelligent analysis summaries
- **PDF Report Generation**: Export detailed analysis reports
- **User Management**: Complete authentication system with admin controls
- **Responsive Design**: Modern, mobile-friendly interface
- **WebSocket Communication**: Real-time bidirectional data flow

## 🏗️ Architecture

### Backend Technologies

- **FastAPI** (Primary) / **Flask** (Legacy): Modern async web framework
- **MongoDB**: NoSQL database with Motor (async driver)
- **WebSocket**: Real-time communication
- **JWT Authentication**: Secure token-based authentication
- **RoBERTa Model**: State-of-the-art sentiment analysis
- **Google Gemini API**: AI-powered analysis summaries
- **Twitch IRC**: Real-time chat integration

### Frontend Technologies

- **React 19**: Modern UI framework
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **Chart.js**: Interactive data visualization
- **Socket.IO Client**: Real-time communication
- **React Router**: Client-side routing
- **SweetAlert2**: Beautiful alert dialogs

## 📁 Project Structure

```
Capstone/
├── backend/                    # Backend API server
│   ├── app.py                 # Flask application (legacy)
│   ├── main.py                # FastAPI application (primary)
│   ├── start.py               # Production server entry point
│   ├── requirements.txt       # Python dependencies
│   ├── Procfile              # Deployment configuration
│   ├── models/               # Database models
│   │   ├── user.py           # User management
│   │   ├── history.py        # Analysis history
│   │   └── log.py            # System logging
│   └── utils/                # Utility modules
│       ├── sentiment_analyzer.py    # ML sentiment analysis
│       ├── twitch_chat.py           # Twitch IRC integration
│       ├── gemini_analyzer.py       # AI summary generation
│       ├── email_sender.py          # Email notifications
│       └── password_validator.py    # Password validation
├── frontend/                  # React frontend application
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── auth/         # Authentication components
│   │   │   ├── admin/        # Admin panel components
│   │   │   ├── pages/        # Main application pages
│   │   │   └── layout/       # Layout components
│   │   ├── contexts/         # React contexts
│   │   ├── hooks/            # Custom React hooks
│   │   └── utils/            # Frontend utilities
│   ├── package.json          # Node.js dependencies
│   └── vite.config.js        # Vite configuration
├── venv/                     # Python virtual environment
└── README.md                 # This documentation
```

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **MongoDB** (local or cloud instance)
- **Git**

### Backend Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd Capstone
   ```

2. **Set up Python environment**

   ```bash
   # Create virtual environment
   python -m venv venv

   # Activate virtual environment
   # Windows:
   venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate

   # Install dependencies
   pip install -r backend/requirements.txt
   ```

3. **Configure environment variables**
   Create a `.env` file in the backend directory:

   ```env
   # Database Configuration
   MONGO_URI=mongodb://localhost:27017/twitch_sentiment
   MONGO_DBNAME=twitch_sentiment

   # Security
   SECRET_KEY=your-secret-key-here

   # Email Configuration
   EMAIL_SENDER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-password

   # API Keys
   GEMINI_API_KEY=your-gemini-api-key

   # Application URLs
   FRONTEND_URL=http://localhost:5173
   ENVIRONMENT=development
   ```

4. **Start the backend server**

   ```bash
   cd backend

   # Development (FastAPI)
   python main.py

   # Production
   python start.py
   ```

### Frontend Setup

1. **Install dependencies**

   ```bash
   cd frontend
   npm install
   ```

2. **Configure environment variables**
   Create a `.env` file in the frontend directory:

   ```env
   VITE_API_URL=http://localhost:8000
   ```

3. **Start the development server**

   ```bash
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

## 🔧 Configuration

### Database Setup

The application uses MongoDB for data storage. Ensure MongoDB is running and accessible:

```bash
# Start MongoDB (if running locally)
mongod

# Or use MongoDB Atlas (cloud)
# Update MONGO_URI in .env with your Atlas connection string
```

### Email Configuration

For email functionality (OTP verification, password reset):

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password
3. Use the App Password in `EMAIL_PASSWORD` environment variable

### API Keys

#### Google Gemini API

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env` file as `GEMINI_API_KEY`

## 📊 Features & Functionality

### Core Features

#### 1. Real-time Sentiment Analysis

- **Live Chat Monitoring**: Connect to any Twitch channel
- **Sentiment Classification**: Positive, Neutral, Negative
- **Confidence Scoring**: ML model confidence levels
- **Real-time Updates**: WebSocket-based live updates

#### 2. Advanced Analytics

- **Sentiment Distribution**: Visual pie charts and statistics
- **User Analytics**: Top contributors by sentiment
- **Session Tracking**: Duration and message counts
- **Historical Data**: Save and retrieve past analyses

#### 3. AI-Powered Insights

- **Smart Summaries**: Google Gemini-generated analysis summaries
- **Trend Analysis**: Identify patterns and insights
- **Recommendations**: Actionable insights for streamers

#### 4. User Management

- **Authentication**: JWT-based secure authentication
- **User Profiles**: Customizable user profiles with images
- **Admin Panel**: User management and system monitoring
- **Activity Logging**: Comprehensive audit trails

#### 5. Data Export

- **PDF Reports**: Professional analysis reports
- **Historical Access**: View and manage past analyses
- **Data Visualization**: Interactive charts and graphs

### User Roles

#### Regular Users

- Connect to Twitch channels
- Perform sentiment analysis
- Save analysis results
- View personal history
- Manage profile settings

#### Admin Users

- All regular user features
- User management
- System monitoring
- Activity logs
- Analytics dashboard

## 🔌 API Documentation

### Authentication Endpoints

| Method | Endpoint               | Description            |
| ------ | ---------------------- | ---------------------- |
| POST   | `/api/register`        | User registration      |
| POST   | `/api/login`           | User login             |
| GET    | `/api/authenticate`    | Verify JWT token       |
| POST   | `/api/logout`          | User logout            |
| POST   | `/api/verify-otp`      | Email verification     |
| POST   | `/api/forgot-password` | Password reset request |
| POST   | `/api/reset-password`  | Password reset         |

### Analysis Endpoints

| Method | Endpoint                 | Description                 |
| ------ | ------------------------ | --------------------------- |
| POST   | `/api/twitch/connect`    | Connect to Twitch channel   |
| POST   | `/api/twitch/disconnect` | Disconnect from channel     |
| POST   | `/api/history/save`      | Save analysis results       |
| GET    | `/api/history`           | Get user's analysis history |
| GET    | `/api/history/{id}`      | Get specific analysis       |
| DELETE | `/api/history/{id}`      | Delete analysis             |
| GET    | `/api/history/{id}/pdf`  | Generate PDF report         |

### WebSocket Events

#### Client to Server

- `ping`: Heartbeat message
- `message`: Chat message data

#### Server to Client

- `pong`: Heartbeat response
- `heartbeat`: Server heartbeat
- `message`: New chat message with sentiment
- `disconnect`: Channel disconnect notification

### Admin Endpoints

| Method | Endpoint                    | Description        |
| ------ | --------------------------- | ------------------ |
| GET    | `/api/admin/users`          | Get all users      |
| PUT    | `/api/admin/users/{id}`     | Update user        |
| GET    | `/api/admin/logs`           | Get system logs    |
| GET    | `/api/admin/users/count`    | User statistics    |
| GET    | `/api/admin/comments/count` | Comment statistics |

## 🚀 Deployment

### Production Deployment

#### Using Railway/Render/Heroku

1. **Prepare for deployment**

   ```bash
   # Install production dependencies
   pip install gunicorn

   # The Procfile is already configured
   ```

2. **Set environment variables**

   ```env
   SECRET_KEY=your-production-secret-key
   MONGO_URI=your-production-mongodb-uri
   EMAIL_SENDER=your-production-email
   EMAIL_PASSWORD=your-production-email-password
   GEMINI_API_KEY=your-gemini-api-key
   FRONTEND_URL=https://your-frontend-domain.com
   ENVIRONMENT=production
   ```

3. **Deploy backend**
   ```bash
   # Push to your deployment platform
   git push heroku main  # or railway/render equivalent
   ```

#### Frontend Deployment

1. **Build for production**

   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy to Vercel/Netlify**
   ```bash
   # Update VITE_API_URL to your production backend URL
   # Deploy the dist folder
   ```

### Docker Deployment

#### Backend Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY backend/ .
EXPOSE 8000

CMD ["python", "start.py"]
```

#### Frontend Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY frontend/package*.json ./
RUN npm install

COPY frontend/ .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "preview"]
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt password encryption
- **CORS Protection**: Configurable cross-origin resource sharing
- **Input Validation**: Comprehensive data validation
- **Rate Limiting**: API rate limiting (configurable)
- **Environment-based Security**: Different security levels for dev/prod

## 🧪 Testing

### Backend Testing

```bash
cd backend
python -m pytest tests/
```

### Frontend Testing

```bash
cd frontend
npm test
```

## 📈 Performance Optimization

### Backend Optimizations

- **Async Operations**: FastAPI async/await patterns
- **Connection Pooling**: MongoDB connection optimization
- **Caching**: Redis caching (optional)
- **Load Balancing**: Multiple worker processes

### Frontend Optimizations

- **Code Splitting**: Lazy loading of components
- **Virtual Scrolling**: Efficient large list rendering
- **Memoization**: React.memo for performance
- **Bundle Optimization**: Vite build optimizations

## 🐛 Troubleshooting

### Common Issues

#### Backend Issues

1. **MongoDB Connection Failed**

   ```bash
   # Check MongoDB is running
   mongod --version

   # Verify connection string
   echo $MONGO_URI
   ```

2. **JWT Token Errors**

   ```bash
   # Check SECRET_KEY is set
   echo $SECRET_KEY

   # Verify token expiration settings
   ```

3. **Email Sending Failed**
   ```bash
   # Verify email credentials
   # Check Gmail App Password
   # Ensure 2FA is enabled
   ```

#### Frontend Issues

1. **API Connection Failed**

   ```bash
   # Check VITE_API_URL
   echo $VITE_API_URL

   # Verify backend is running
   curl http://localhost:8000/health
   ```

2. **WebSocket Connection Issues**
   ```bash
   # Check WebSocket URL
   # Verify CORS settings
   # Check firewall/proxy settings
   ```

### Debug Mode

Enable debug mode for detailed logging:

```env
ENVIRONMENT=development
DEBUG=true
```

## 🤝 Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Test thoroughly**
5. **Submit a pull request**

### Code Standards

- **Python**: Follow PEP 8 guidelines
- **JavaScript**: Use ESLint configuration
- **Commits**: Use conventional commit messages
- **Documentation**: Update README for new features

## 📝 License

This project is developed as a capstone project for educational purposes.

## 👥 Development Team

**Third-year Information Technology Students:**

- Francis Emil M. Cortez
- Hyrum Gaspan
- Marvie M. Gutierrez
- Vincent C. Medrano
- Christian Angelo M. Pring
- Justine S. Tadiaman

## 📞 Support

For support and questions:

- **Email**: Contact through the application's contact form
- **Issues**: Create GitHub issues for bugs and feature requests
- **Documentation**: Refer to this README and inline code comments

## 🔄 Migration Guide

The project has been migrated from Flask + SSE to FastAPI + WebSocket. See `MIGRATION_GUIDE.md` for detailed migration information.

## 📊 System Requirements

### Minimum Requirements

- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 10GB
- **Network**: Stable internet connection

### Recommended Requirements

- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 20GB+ SSD
- **Network**: High-speed internet

## 🎯 Future Enhancements

- **Multi-platform Support**: Discord, YouTube Live integration
- **Advanced Analytics**: Machine learning insights
- **Real-time Alerts**: Custom notification system
- **API Rate Limiting**: Advanced rate limiting
- **Mobile App**: React Native mobile application
- **Cloud Integration**: AWS/Azure deployment options

---

**Twitch Insight** - Empowering streamers with data-driven insights for better community engagement.
