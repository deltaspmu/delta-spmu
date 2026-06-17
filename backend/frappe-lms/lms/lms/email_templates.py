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
LEARN_URL = "https://learn.deltaspmu.com"
SUPPORT_EMAIL = "info@deltaspmu.com"
PRIMARY = "#C9A96E"   # gold
DARK = "#1A2F23"      # forest green
BG = "#F5F2EC"        # warm alabaster


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
        cta_url=f"{LEARN_URL}/my-courses",
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
        cta_url=f"{LEARN_URL}/courses",
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
        cta_url=f"{LEARN_URL}/certificates",
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


    student_name, course_title, amount, currency, irn, qr_base64,
    document_number, invoice_date, seller_name,
):

    embedded inline as a data URI. The base64 alphabet contains no HTML-special
    characters, so it is safe in the img src.
    """
    qr_img = ""
    if qr_base64:
        qr_img = (
            f'width="180" height="180" style="display:block;margin:0 auto;border:1px solid #eee;"/>'
        )

    body = f"""
    <p>Hi {escape_html(student_name)},</p>
    <table role="presentation" width="100%" style="margin:16px 0;font-size:13px;color:{DARK};">
      <tr><td style="padding:6px 0;color:#888;">Seller</td><td style="padding:6px 0;text-align:right;font-weight:bold;">{escape_html(seller_name)}</td></tr>
      <tr><td style="padding:6px 0;color:#888;">Amount</td><td style="padding:6px 0;text-align:right;font-weight:bold;">{escape_html(f"{amount:,.2f}")} {escape_html(currency)}</td></tr>
      <tr><td style="padding:6px 0;color:#888;">Document No.</td><td style="padding:6px 0;text-align:right;">{escape_html(str(document_number))}</td></tr>
      <tr><td style="padding:6px 0;color:#888;">Date</td><td style="padding:6px 0;text-align:right;">{escape_html(str(invoice_date))}</td></tr>
    </table>
    <p style="font-size:11px;color:#888;margin:0;">Invoice Reference Number (IRN)</p>
    <p style="font-family:monospace;font-size:11px;word-break:break-all;background:{BG};padding:8px;border-radius:2px;margin:4px 0 20px;">{escape_html(irn)}</p>
    {qr_img}
    """
    return _shell(
        body_html=body,
    )


    student_name, course_title, irn, document_number, cancel_date, seller_name, reason,
):

    Sent to the buyer when a registered invoice is cancelled with MoR (e.g. on
    """
    body = f"""
    <p>Hi {escape_html(student_name)},</p>
    invoice is no longer valid for tax purposes.</p>
    <table role="presentation" width="100%" style="margin:16px 0;font-size:13px;color:{DARK};">
      <tr><td style="padding:6px 0;color:#888;">Seller</td><td style="padding:6px 0;text-align:right;font-weight:bold;">{escape_html(seller_name)}</td></tr>
      <tr><td style="padding:6px 0;color:#888;">Document No.</td><td style="padding:6px 0;text-align:right;">{escape_html(str(document_number))}</td></tr>
      <tr><td style="padding:6px 0;color:#888;">Cancelled on</td><td style="padding:6px 0;text-align:right;">{escape_html(str(cancel_date))}</td></tr>
      <tr><td style="padding:6px 0;color:#888;">Reason</td><td style="padding:6px 0;text-align:right;">{escape_html(str(reason))}</td></tr>
    </table>
    <p style="font-size:11px;color:#888;margin:0;">Cancelled Invoice Reference Number (IRN)</p>
    <p style="font-family:monospace;font-size:11px;word-break:break-all;background:{BG};padding:8px;border-radius:2px;margin:4px 0 16px;">{escape_html(irn)}</p>
    <p style="font-size:13px;color:#666;">If you were expecting a refund, it will be processed separately. Questions? Just reply to this email.</p>
    """
    return _shell(
        body_html=body,
    )



    Unlike the email helpers (which return a body wrapped in the email shell),
    this returns a complete HTML document suitable for opening in a new browser
    window and printing / saving as PDF — the MoR "printing layout" artifact.

    ``invoice`` keys (all optional unless noted):
        title, status, document_number, irn, date, currency, tax_note,
        transaction_id, qr_base64,
        seller{name,tin,vat,address,email,phone},
        buyer{name,tin,email},
        items[{description,qty,unit_price,line_total}],
        subtotal, tax_value, total
    """
    def money(v):
        try:
            return f"{float(v or 0):,.2f}"
        except (TypeError, ValueError):
            return "0.00"

    seller = invoice.get("seller") or {}
    buyer = invoice.get("buyer") or {}
    currency = escape_html(invoice.get("currency") or "ETB")
    title = escape_html(invoice.get("title") or "Tax Invoice")

    rows = ""
    for i, it in enumerate(invoice.get("items") or [], start=1):
        rows += f"""
        <tr>
          <td style="padding:8px 6px;border-bottom:1px solid #eee;">{i}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #eee;">{escape_html(str(it.get('description') or ''))}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;">{escape_html(str(it.get('qty') or 1))}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;">{money(it.get('unit_price'))}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;">{money(it.get('line_total'))}</td>
        </tr>"""

    qr_block = ""
    if invoice.get("qr_base64"):
        qr_block = f"""
        <div style="text-align:center;">
        </div>"""

    buyer_tin = f"<div style='color:#888;'>TIN: {escape_html(str(buyer.get('tin')))}</div>" if buyer.get("tin") else ""
    seller_vat = f"<div>VAT: {escape_html(str(seller.get('vat')))}</div>" if seller.get("vat") else ""
    tax_note = escape_html(invoice.get("tax_note") or "")

    return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>{title} — {escape_html(str(invoice.get('document_number') or ''))}</title>
<style>
  @page {{ size: A4; margin: 16mm; }}
  body {{ font-family: Helvetica, Arial, sans-serif; color:{DARK}; margin:0; background:#fff; }}
  .sheet {{ max-width: 720px; margin: 0 auto; padding: 24px; }}
  .brand {{ font-size:11px; letter-spacing:4px; text-transform:uppercase; color:{PRIMARY}; }}
  h1 {{ font-size:22px; margin:4px 0 0; font-weight:400; }}
  table {{ width:100%; border-collapse:collapse; }}
  .muted {{ color:#888; font-size:12px; }}
  .mono {{ font-family: monospace; font-size:11px; word-break:break-all; }}
  .totals td {{ padding:4px 6px; }}
  .no-print button {{ background:{DARK}; color:#fff; border:none; padding:10px 22px; border-radius:4px; font-size:13px; cursor:pointer; }}
  @media print {{ .no-print {{ display:none; }} .sheet {{ padding:0; }} }}
</style>
</head>
<body>
  <div class="no-print" style="text-align:center;padding:16px;background:{BG};">
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="sheet">
    <table>
      <tr>
        <td style="vertical-align:top;">
          <div class="brand">{escape_html(seller.get('name') or 'Delta SPMU Academy')}</div>
          <div class="muted" style="margin-top:6px;">TIN: {escape_html(str(seller.get('tin') or ''))}</div>
          {seller_vat}
          <div class="muted">{escape_html(seller.get('address') or '')}</div>
          <div class="muted">{escape_html(seller.get('email') or '')} {escape_html(seller.get('phone') or '')}</div>
        </td>
        <td style="vertical-align:top;text-align:right;">
          <h1>{title}</h1>
          <div class="muted" style="margin-top:8px;">Document No: <strong>{escape_html(str(invoice.get('document_number') or ''))}</strong></div>
          <div class="muted">Date: {escape_html(str(invoice.get('date') or ''))}</div>
          <div class="muted">Status: {escape_html(str(invoice.get('status') or ''))}</div>
        </td>
      </tr>
    </table>

    <div style="margin:18px 0;padding:12px;background:{BG};border-radius:4px;">
      <div class="muted">Billed to</div>
      <div style="font-weight:bold;">{escape_html(buyer.get('name') or 'Customer')}</div>
      {buyer_tin}
      <div class="muted">{escape_html(buyer.get('email') or '')}</div>
    </div>

    <table style="margin-top:8px;">
      <thead>
        <tr style="text-align:left;border-bottom:2px solid {DARK};">
          <th style="padding:8px 6px;">#</th>
          <th style="padding:8px 6px;">Description</th>
          <th style="padding:8px 6px;text-align:right;">Qty</th>
          <th style="padding:8px 6px;text-align:right;">Unit Price</th>
          <th style="padding:8px 6px;text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>{rows}</tbody>
    </table>

    <table style="margin-top:12px;">
      <tr>
        <td style="vertical-align:top;width:55%;">{qr_block}</td>
        <td style="vertical-align:top;">
          <table class="totals" style="width:100%;">
            <tr><td class="muted">Subtotal</td><td style="text-align:right;">{money(invoice.get('subtotal'))} {currency}</td></tr>
            <tr><td class="muted">Tax{(' — ' + tax_note) if tax_note else ''}</td><td style="text-align:right;">{money(invoice.get('tax_value'))} {currency}</td></tr>
            <tr style="border-top:2px solid {DARK};"><td style="font-weight:bold;padding-top:8px;">Total</td><td style="text-align:right;font-weight:bold;padding-top:8px;">{money(invoice.get('total'))} {currency}</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="margin-top:18px;">
      <div class="muted">Invoice Reference Number (IRN)</div>
      <div class="mono">{escape_html(str(invoice.get('irn') or ''))}</div>
    </div>

    <div class="muted" style="margin-top:24px;border-top:1px solid #eee;padding-top:12px;text-align:center;">
      Transaction {escape_html(str(invoice.get('transaction_id') or ''))} &middot; {ACADEMY_NAME}, Addis Ababa.
    </div>
  </div>
</body>
</html>"""
