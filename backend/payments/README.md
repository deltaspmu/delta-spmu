# Delta SPMU Academy — Payment Provider Integrations

## Overview

Delta SPMU supports 4 payment methods for Ethiopian and international customers:

| Provider | Type | Currency | File |
|----------|------|----------|------|
| telebirr | Mobile money | ETB | `../frappe-lms/lms/lms/telebirr.py` |
| Chapa | Payment gateway | ETB, USD | `../frappe-lms/lms/lms/chapa.py` |
| EthSwitch NPG | Bank gateway | ETB | `../frappe-lms/lms/lms/ethswitch.py` |
| CBE (Bank Transfer) | Manual | ETB | Handled in `payments_api.py` |

> **Note:** All gateway modules now live alongside the rest of the Frappe app in
> `backend/frappe-lms/lms/lms/` so the `scripts/deploy-backend.sh` script
> (which uses non-recursive `scp *.py`) picks them up automatically.

## Payment Flow

```
User clicks Buy → initiate_payment() → Creates Payment Transaction (30-min expiry)
       ↓
Routes to provider (checkout URL)
       ↓
User pays on provider's site
       ↓
Provider sends webhook → Backend verifies signature → Marks Completed
       ↓
Creates Course Access (30-day window) + LMS Enrollment
       ↓
Sends confirmation email
```

## Transaction ID Format

`DS-{YYYYMMDDHHMMSS}-{6-char-hash}`

Example: `DS-20260405143022-A3F2B1`

## Pricing

- **Per course**: 5,000 ETB
- **Bundle (all 4 courses)**: 5,000 ETB
- **USD pricing**: Converted using live exchange rate (fallback: 130 ETB/USD)
- **Access duration**: 30 days per purchase

## Configuration

All config keys are set via `bench set-config` on the Frappe server.

### telebirr
```bash
bench set-config telebirr_fabric_app_id "<value>"
bench set-config telebirr_app_secret "<value>"
bench set-config telebirr_merchant_app_id "<value>"
bench set-config telebirr_merchant_code "<value>"
bench set-config telebirr_private_key "<RSA-private-key-PEM>"
bench set-config telebirr_public_key "<telebirr-public-key-PEM>"
bench set-config telebirr_environment "sandbox"  # or "production"
bench set-config telebirr_notify_url "https://api.deltaspmu.com/api/method/lms.lms.payments_api.telebirr_notify"
bench set-config telebirr_redirect_url "https://learn.deltaspmu.com/payment/success"
```

### Chapa
```bash
bench set-config chapa_secret_key "<value>"
bench set-config chapa_webhook_secret "<value>"
bench set-config chapa_callback_url "https://api.deltaspmu.com/api/method/lms.lms.payments_api.chapa_webhook"
bench set-config chapa_return_url "https://learn.deltaspmu.com/payment/success"
```

### EthSwitch
```bash
bench set-config ethswitch_username "<value>"
bench set-config ethswitch_password "<value>"
bench set-config ethswitch_base_url "<environment-url>"
bench set-config ethswitch_return_url "https://learn.deltaspmu.com/payment/success"
```

### CBE (Bank Transfer)
No configuration needed — handled manually:
1. User selects CBE and receives bank transfer instructions
2. User transfers funds and submits reference number
3. Admin verifies payment manually via admin portal
4. Admin calls `admin_verify_payment(transaction_id)` to grant access

## Webhook Endpoints

| Provider | Endpoint | Verification |
|----------|----------|-------------|
| telebirr | `POST /api/method/lms.lms.payments_api.telebirr_notify` | RSA-PSS SHA256 |
| Chapa | `POST /api/method/lms.lms.payments_api.chapa_webhook` | HMAC SHA256 |
| EthSwitch | `POST /api/method/lms.lms.payments_api.ethswitch_webhook` | Server-to-server |

## Custom DocTypes

### Payment Transaction
- user, course, course_title
- original_amount, currency, discount_percent, discount_amount, final_amount
- payment_method, status (Pending/Processing/Completed/Failed/Pending Verification)
- expires_at, prepay_id, trade_no, completed_at
- error_message, notify_received, notify_payload
- ethswitch_order_id, phone, user_reference

### Course Access
- user, course
- access_start, access_end
- is_active
- payment_transaction

## Troubleshooting

### telebirr callback not received
1. Check `telebirr_notify_url` is correct and publicly accessible
2. Verify RSA keys are correctly configured
3. Check Frappe error logs: `bench --site api.deltaspmu.com show-logs`

### Chapa webhook signature mismatch
1. Verify `chapa_webhook_secret` matches Chapa dashboard
2. Check raw payload is used for HMAC (not parsed JSON)

### EthSwitch order stuck in "Registered"
1. Check order status: call `get_order_status(order_id)`
2. User may not have completed payment on bank page
3. Order expires after 20 minutes by default
