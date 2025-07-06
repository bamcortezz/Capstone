import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv

load_dotenv()

BRAND_HEADER = """
    <div style='background:#9147ff;padding:24px 0;text-align:center;border-radius:16px 16px 0 0;'>
      <h1 style='color:#fff;margin:0;font-size:2rem;font-family:sans-serif;letter-spacing:1px;'>Twitch Insight</h1>
    </div>
"""

CONTAINER_STYLE = (
    "background:#18181b;"
    "margin:0 auto;"
    "padding:0;"
    "min-width:320px;max-width:480px;"
    "border-radius:16px;"
    "box-shadow:0 4px 24px rgba(0,0,0,0.25);"
    "border:1px solid #23232b;"
    "text-align:center;"
)

CONTENT_STYLE = (
    "padding:32px 24px 24px 24px;"
    "font-family:sans-serif;"
    "color:#fff;"
    "border-radius:0 0 16px 16px;"
)

def send_otp_email(to_email, otp):
    sender_email = os.getenv('EMAIL_SENDER')
    sender_password = os.getenv('EMAIL_PASSWORD')

    message = MIMEMultipart('alternative')
    message["From"] = f'Twitch Insight <{sender_email}>'
    message["To"] = to_email
    message["Subject"] = "Your OTP for Account Verification"

    text = f"""
    Your One-Time Password (OTP) for account verification is: {otp}
    This OTP will expire in 10 minutes.
    If you didn't request this OTP, please ignore this email.
    """

    html = f"""
    <html>
    <body>
      <div style='{CONTAINER_STYLE}'>
        {BRAND_HEADER}
        <div style='{CONTENT_STYLE}'>
          <h2 style='color:#9147ff;margin-bottom:16px;'>Account Verification</h2>
          <p style='margin-bottom:18px;'>Your One-Time Password (OTP) for account verification is:</p>
          <div style='font-size:2rem;font-weight:bold;background:#22223b;color:#9147ff;padding:16px 32px;border-radius:8px;display:inline-block;margin:16px 0;'>{otp}</div>
          <p style='margin-top:24px;'>This OTP will expire in <b>10 minutes</b>.</p>
          <p style='color:#aaa;font-size:13px;margin-top:32px;'>If you didn't request this OTP, please ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
    """

    message.attach(MIMEText(text, "plain"))
    message.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(message)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

def send_password_reset_email(to_email, user_id, reset_token):
    sender_email = os.getenv('EMAIL_SENDER')
    sender_password = os.getenv('EMAIL_PASSWORD')

    message = MIMEMultipart('alternative')
    message["From"] = f'Twitch Insight <{sender_email}>'
    message["To"] = to_email
    message["Subject"] = "Password Reset Request"

    reset_link = f"http://localhost:5173/reset-password/{user_id}/{reset_token}"

    text = f"""
    You requested a password reset for your account.\n\nPlease click on the link below to reset your password:\n{reset_link}\n\nIf you didn't request a password reset, please ignore this email.
    """

    html = f"""
    <html>
    <body>
      <div style='{CONTAINER_STYLE}'>
        {BRAND_HEADER}
        <div style='{CONTENT_STYLE}'>
          <h2 style='color:#9147ff;margin-bottom:16px;'>Password Reset Request</h2>
          <p style='margin-bottom:18px;'>You requested a password reset for your account.</p>
          <p style='margin-bottom:24px;'>Please click the button below to reset your password:</p>
          <a href='{reset_link}' style='display:inline-block;margin:20px 0;padding:14px 32px;background:#9147ff;color:#fff;text-decoration:none;font-weight:bold;border-radius:6px;font-size:1.1rem;'>Reset Password</a>
          <p style='margin-top:24px;'>If you didn't request a password reset, please ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
    """

    message.attach(MIMEText(text, "plain"))
    message.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(message)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

def send_contact_email(name, email, subject, message_body):
    sender_email = os.getenv('EMAIL_SENDER')
    sender_password = os.getenv('EMAIL_PASSWORD')
    team_email = sender_email

    msg = MIMEMultipart('alternative')
    msg['From'] = f"{name} <{email}>"
    msg['To'] = team_email
    msg['Subject'] = f"Contact Form: {subject}"

    text = f"Name: {name}\nEmail: {email}\n\nMessage:\n{message_body}"

    html = f"""
    <html>
    <body>
      <div style='{CONTAINER_STYLE}'>
        {BRAND_HEADER}
        <div style='{CONTENT_STYLE}'>
          <h2 style='color:#9147ff;margin-bottom:16px;'>Contact Form Submission</h2>
          <p style='margin-bottom:18px;'><b>Name:</b> {name}<br/>
          <b>Email:</b> {email}</p>
          <div style='margin:24px 0 0 0;padding:18px 20px;background:#23232b;border-radius:8px;color:#fff;display:inline-block;text-align:left;'>
            <b>Message:</b><br/>
            <span style='white-space:pre-line;'>{message_body}</span>
          </div>
        </div>
      </div>
    </body>
    </html>
    """

    msg.attach(MIMEText(text, 'plain'))
    msg.attach(MIMEText(html, 'html'))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Error sending contact email: {e}")
        return False
