"""Branded transactional email templates for Delta SPMU Academy.

Centralizes the academy's email branding so every sendmail() call across
the codebase uses the same gold-on-forest-green look without duplicating
HTML. Each helper returns an HTML string ready to pass as `message=` to
frappe.sendmail().

The dynamic strings are escaped via frappe.utils.escape_html to prevent
template injection if a user-supplied field ever flows through.
"""

import frappe
from frappe.utils import escape_html

ACADEMY_NAME = "Delta SPMU Academy"
ACADEMY_TAGLINE = "Sacred Transformation"
SUPPORT_EMAIL = "info@deltaspmu.com"
PRIMARY = "#C9A96E"   # gold
DARK = "#1A2F23"      # forest green
BG = "#F5F2EC"        # warm alabaster


def _learn_url():
    """Student-portal base URL. Env-aware via site_config's `portal_url`
    (staging sets it to the staging portal); read lazily because frappe.conf
    isn't reliable at import time."""
    return (frappe.conf.get("portal_url") or "https://learn.deltaspmu.com").rstrip("/")


def _shell(title, intro, body_html, cta_label=None, cta_url=None):
    """Wrap content in the shared academy email shell.

    Args:
        title:       Big heading at the top of the message.
        intro:       One-line sub-heading under the title.
        body_html:   Pre-rendered HTML for the body (caller controls layout).
        cta_label:   Optional call-to-action button text.
        cta_url:     Optional call-to-action URL.
    """
    cta_html = ""
    if cta_label and cta_url:
        cta_html = f"""
        <tr><td style="padding:24px 0 8px;text-align:center;">
          <a href="{escape_html(cta_url)}" style="display:inline-block;padding:14px 32px;background:{DARK};color:#fff;text-decoration:none;font-family:Georgia,serif;font-size:14px;letter-spacing:1px;text-transform:uppercase;border-radius:2px;">{escape_html(cta_label)}</a>
        </td></tr>
        """

    return f"""<!doctype html>
<html>
<body style="margin:0;padding:0;background:{BG};font-family:Georgia,'Times New Roman',serif;color:{DARK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{BG};">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-top:4px solid {PRIMARY};">
        <tr><td style="padding:32px 40px 12px;text-align:center;">
          <div style="font-size:11px;letter-spacing:5px;text-transform:uppercase;color:{PRIMARY};font-family:Georgia,serif;">{ACADEMY_NAME}</div>
          <div style="font-size:10px;letter-spacing:3px;color:#999;margin-top:4px;">{ACADEMY_TAGLINE}</div>
        </td></tr>
        <tr><td style="padding:0 40px 8px;text-align:center;">
          <h1 style="font-size:24px;font-weight:400;font-style:italic;color:{DARK};margin:16px 0 4px;">{escape_html(title)}</h1>
          <p style="font-size:14px;color:#666;margin:0;">{escape_html(intro)}</p>
        </td></tr>
        <tr><td style="padding:24px 40px;font-size:15px;line-height:1.65;color:{DARK};">
          {body_html}
        </td></tr>
        {cta_html}
        <tr><td style="padding:32px 40px 24px;border-top:1px solid #eee;text-align:center;font-size:11px;color:#999;font-family:Helvetica,Arial,sans-serif;">
          Questions? Reply to this email or write to <a href="mailto:{SUPPORT_EMAIL}" style="color:{PRIMARY};text-decoration:none;">{SUPPORT_EMAIL}</a>.<br/>
          &copy; {frappe.utils.now_datetime().year} {ACADEMY_NAME} &middot; Addis Ababa, Ethiopia
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def payment_success(student_name, course_title, amount, currency, tx_id, access_days):
    """Render the payment-success confirmation email."""
    body = f"""
    <p>Hi {escape_html(student_name)},</p>
    <p>Your payment of <strong>{escape_html(f"{amount:,.0f}")} {escape_html(currency)}</strong>
    for <em>{escape_html(course_title)}</em> has been confirmed. You now have
    <strong>{access_days}-day access</strong> to your course materials.</p>
    <p style="font-size:12px;color:#888;margin-top:24px;">Transaction ID: <code>{escape_html(tx_id)}</code></p>
    """
    return _shell(
        title="Payment Confirmed",
        intro="Your enrollment is active.",
        body_html=body,
        cta_label="Open Your Course",
        cta_url=f"{_learn_url()}/my-courses",
    )


def welcome(student_name):
    """Render the post-registration welcome email."""
    body = f"""
    <p>Welcome, {escape_html(student_name)} —</p>
    <p>We're delighted to have you join our community of permanent makeup
    professionals. Your account is ready. Browse our certification programs
    and choose the path that fits where you are in your career.</p>
    """
    return _shell(
        title="Welcome to Delta SPMU",
        intro="Your journey begins here.",
        body_html=body,
        cta_label="Browse Courses",
        cta_url=f"{_learn_url()}/courses",
    )


def password_reset(student_name, reset_url):
    """Render the password reset email."""
    body = f"""
    <p>Hi {escape_html(student_name)},</p>
    <p>We received a request to reset the password for your Delta SPMU account.
    Click the button below to set a new one. This link expires in 24 hours.</p>
    <p style="font-size:12px;color:#888;margin-top:24px;">If you didn't request a reset, you can safely ignore this email.</p>
    """
    return _shell(
        title="Reset Your Password",
        intro="One click and you're back in.",
        body_html=body,
        cta_label="Reset Password",
        cta_url=reset_url,
    )


def certificate_ready(student_name, course_title, certificate_id):
    """Render the certificate-issued email."""
    body = f"""
    <p>Congratulations, {escape_html(student_name)}!</p>
    <p>You've completed <em>{escape_html(course_title)}</em>. Your certificate
    is ready to download and share.</p>
    <p style="font-size:12px;color:#888;margin-top:24px;">Certificate ID: <code>{escape_html(certificate_id)}</code></p>
    """
    return _shell(
        title="Your Certificate Awaits",
        intro="A milestone earned.",
        body_html=body,
        cta_label="View Certificate",
        cta_url=f"{_learn_url()}/certificates",
    )


def email_verification(student_name, verify_url):
    """Render the email-verification email."""
    body = f"""
    <p>Hi {escape_html(student_name)},</p>
    <p>Please confirm your email address so we can finish setting up your
    Delta SPMU account. This link expires in 24 hours.</p>
    """
    return _shell(
        title="Verify Your Email",
        intro="One last step.",
        body_html=body,
        cta_label="Confirm Email",
        cta_url=verify_url,
    )
