"""Test SMTP auth + send to Resend directly from the EC2 instance.

Bypasses Frappe entirely so we can isolate where the timeout is coming from.
"""
import smtplib
import socket
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

HOST = "smtp.resend.com"
PORT = 465
USERNAME = "resend"
PASSWORD = "re_KkntoFkG_4eMD4JdFx68Sp3Ecd7X2urGd"
FROM = "noreply@deltaspmu.com"
TO = "tigrayinsights@gmail.com"

print(f"--- Connecting to {HOST}:{PORT} (SSL) ---")
try:
    ctx = ssl.create_default_context()
    with smtplib.SMTP_SSL(HOST, PORT, timeout=30, context=ctx) as srv:
        srv.set_debuglevel(0)
        print(f"  connected, ehlo...")
        srv.ehlo()
        print(f"  login with {USERNAME}...")
        srv.login(USERNAME, PASSWORD)
        print(f"  login OK")

        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Delta SPMU — Direct SMTP test"
        msg["From"] = FROM
        msg["To"] = TO
        msg.attach(MIMEText("Hello from EC2 via Resend.\n\nIf you see this, SMTP works.", "plain"))
        msg.attach(MIMEText("<h2>Hello from EC2 via Resend.</h2><p>If you see this, SMTP works.</p>", "html"))

        print(f"  sending mail FROM={FROM} TO={TO}...")
        srv.sendmail(FROM, [TO], msg.as_string())
        print(f"  OK — send accepted by Resend")
except smtplib.SMTPAuthenticationError as e:
    print(f"  AUTH FAILED: {e}")
except smtplib.SMTPException as e:
    print(f"  SMTP ERROR: {type(e).__name__}: {e}")
except (socket.timeout, socket.error) as e:
    print(f"  NETWORK ERROR: {type(e).__name__}: {e}")
except Exception as e:
    print(f"  UNEXPECTED: {type(e).__name__}: {e}")
