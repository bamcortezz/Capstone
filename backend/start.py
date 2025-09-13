#!/usr/bin/env python3
"""
Production startup script for FastAPI application
"""
import os
import uvicorn
from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    # Get configuration from environment variables
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8080))
    workers = int(os.getenv("WORKERS", 1))
    is_production = os.getenv("ENVIRONMENT") == "production"
    
    print(f"Starting FastAPI server...")
    print(f"Host: {host}")
    print(f"Port: {port}")
    print(f"Workers: {workers}")
    print(f"Environment: {'Production' if is_production else 'Development'}")
    
    # Configure uvicorn for production
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        workers=workers if is_production else 1,
        reload=not is_production,
        log_level="info" if is_production else "debug",
        access_log=True,
        server_header=False,
        date_header=False
    )
