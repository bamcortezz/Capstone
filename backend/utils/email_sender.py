import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv

load_dotenv()

def send_otp_email(to_email, otp):
    # Email configuration
    sender_email = os.getenv('EMAIL_SENDER')
    sender_password = os.getenv('EMAIL_PASSWORD')
    
    # Create message
    message = MIMEMultipart()
    message["From"] = sender_email
    message["To"] = to_email
    message["Subject"] = "Your OTP for Account Verification"
    
    # Email body
    body = f"""
    Dear User,
    
    Your One-Time Password (OTP) for account verification is: {otp}
    
    This OTP will expire in 10 minutes.
    
    If you didn't request this OTP, please ignore this email.
    
    Best regards,
    Team
    """
    
    message.attach(MIMEText(body, "plain"))
    
    try:
        # Create SMTP session and send email
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(message)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False
