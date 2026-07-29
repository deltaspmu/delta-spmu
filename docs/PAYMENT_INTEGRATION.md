# Delta SPMU Academy — Payment Integration Guide

## Overview

Delta SPMU Academy supports 4 payment methods for the Ethiopian market:

| Provider   | Type                | Currency | Integration          |
|------------|---------------------|----------|----------------------|
| telebirr   | Mobile money        | ETB      | REST API + RSA-PSS   |
| Chapa      | Payment gateway     | ETB/USD  | REST API + HMAC      |
| EthSwitch  | National bank switch| ETB      | REST API (NPG)       |
| CBE        | Bank transfer       | ETB      | Manual verification  |

### Pricing

- **Per course**: 5,000 ETB
- **All 4 courses bundle**: 5,000 ETB (`BUNDLE_ID = "all-courses-bundle"`)
- **Access duration**: 30 days from purchase
- **Transaction ID format**: `DS-{YYYYMMDDHHMMSS}-{6-char-hash}`

### Payment Flow (All Providers)

```
1. User clicks "Buy" on student portal
2. Frontend calls: POST /api/method/lms.lms.payments_api.initiate_payment
   Params: course, payment_method, phone (telebirr), currency
3. Backend creates Payment Transaction record (status: Pending, 30-min expiry)
4. Backend calls provider API -> returns checkout URL
5. User redirected to provider's payment page
6. User completes payment on provider site
7. Provider sends webhook to backend
8. Backend verifies webhook signature
9. Backend marks transaction Completed
10. Backend creates Course Access (30-day) + LMS Enrollment
11. Backend sends confirmation email
12. User redirected to /payment/success
```

---

## telebirr

### Overview

Ethiopia's largest mobile money platform operated by Ethio Telecom. Uses RSA-PSS signatures for webhook verification.

### Setup

1. Register as a merchant at https://developer.ethiotelecom.et
2. Obtain credentials: fabric app ID, app secret, merchant app ID, merchant code
3. Generate RSA key pair for signature verification
4. Get telebirr's public key for verifying callbacks

### Configuration

```bash
cd /home/frappe/deltaspmu

bench set-config telebirr_fabric_app_id   "<YOUR-FABRIC-APP-ID>"
bench set-config telebirr_app_secret      "<YOUR-APP-SECRET>"
bench set-config telebirr_merchant_app_id "<YOUR-MERCHANT-APP-ID>"
bench set-config telebirr_merchant_code   "<YOUR-MERCHANT-CODE>"
bench set-config telebirr_private_key     "<YOUR-RSA-PRIVATE-KEY>"
bench set-config telebirr_public_key      "<TELEBIRR-RSA-PUBLIC-KEY>"
bench set-config telebirr_environment     "sandbox"
bench set-config telebirr_notify_url      "https://api.deltaspmu.com/api/method/lms.lms.payments_api.telebirr_notify"
bench set-config telebirr_redirect_url    "https://learn.deltaspmu.com/payment/success"
```

### Webhook URL

```
POST https://api.deltaspmu.com/api/method/lms.lms.payments_api.telebirr_notify
```

This is a guest-accessible GET endpoint (bypasses CSRF). telebirr sends payment notifications here after the user completes payment.

### Verification

telebirr callbacks are verified using RSA-PSS with SHA-256. The backend:

1. Extracts the encrypted payload from the callback
2. Decrypts using the merchant's RSA private key
3. Verifies the signature using telebirr's public key
4. Checks transaction amount matches the original record

### Sandbox Testing

- Set `telebirr_environment` to `"sandbox"`
- Use telebirr sandbox test numbers provided in your merchant dashboard
- Sandbox callbacks may be delayed; use `check_payment_status` API to poll

---

## Chapa

### Overview

Ethiopian payment gateway supporting local methods (telebirr, CBE, Awash Bank) and international cards (Visa, Mastercard). Uses HMAC SHA-256 for webhook verification.

### Setup

1. Register at https://dashboard.chapa.co
2. Get your secret key and webhook secret from the dashboard
3. Add your webhook URL in the Chapa dashboard

### Configuration

```bash
cd /home/frappe/deltaspmu

bench set-config chapa_secret_key      "<YOUR-SECRET-KEY>"
bench set-config chapa_webhook_secret  "<YOUR-WEBHOOK-SECRET>"
bench set-config chapa_callback_url    "https://api.deltaspmu.com/api/method/lms.lms.payments_api.chapa_webhook"
bench set-config chapa_return_url      "https://learn.deltaspmu.com/payment/success"
```

### Webhook URL

```
POST https://api.deltaspmu.com/api/method/lms.lms.payments_api.chapa_webhook
```

Register this URL in the Chapa dashboard under Webhooks.

### Verification

Chapa webhooks are verified using HMAC SHA-256:

1. Extract the `Chapa-Signature` header from the webhook request
2. Compute HMAC-SHA256 of the raw request body using your webhook secret
3. Compare the computed hash with the signature header
4. Reject the webhook if they don't match

### API Endpoints

| Endpoint                                    | Method | Purpose                    |
|---------------------------------------------|--------|----------------------------|
| `https://api.chapa.co/v1/transaction/initialize` | POST | Start a payment            |
| `https://api.chapa.co/v1/transaction/verify/{tx_ref}` | GET | Check payment status |

### Sandbox Testing

- Use Chapa test secret key (starts with `CHASECK_TEST-`)
- Use a valid email address on a real domain for the learner account. Chapa
  rejects reserved or placeholder domains such as `example.com` before opening
  its hosted checkout.
- Test card: `4200 0000 0000 0000`, any future expiry, any CVV
- Test mobile: any valid Ethiopian phone number

---

## EthSwitch (National Payment Gateway)

### Overview

Ethiopia's national payment switch connecting all local banks. Processes payments through the bank's online banking interface. Uses order-based flow with server-to-server callbacks. Amounts are in santim (ETB x 100).

### Setup

1. Apply through your bank's merchant services department
2. Request EthSwitch NPG merchant credentials
3. Obtain: base URL, merchant username, merchant password

### Configuration

```bash
cd /home/frappe/deltaspmu

bench set-config ethswitch_base_url    "<ETHSWITCH-BASE-URL>"
bench set-config ethswitch_username    "<YOUR-MERCHANT-USERNAME>"
bench set-config ethswitch_password    "<YOUR-MERCHANT-PASSWORD>"
bench set-config ethswitch_return_url  "https://api.deltaspmu.com/api/method/lms.lms.payments_api.ethswitch_return"
bench set-config ethswitch_webhook_url "https://api.deltaspmu.com/api/method/lms.lms.payments_api.ethswitch_webhook"
```

### Webhook / Return URLs

```
Return URL (user redirect):
  GET https://api.deltaspmu.com/api/method/lms.lms.payments_api.ethswitch_return

Server webhook:
  POST https://api.deltaspmu.com/api/method/lms.lms.payments_api.ethswitch_webhook
```

### Verification

EthSwitch uses order status polling:

1. After payment, user is redirected to the return URL with `orderId` parameter
2. Backend calls `getOrderStatus.do` with the order ID
3. Status code `2` = Completed; other codes indicate failure or pending
4. Server webhook provides real-time notification as backup

### Key Details

- **Currency code**: 230 (ETB)
- **Amount format**: santim (multiply ETB by 100)
- **Order status codes**: 0=Registered, 1=Pre-Authorized, 2=Completed, 3=Reversed, 4=Refunded, 5=Initialized, 6=Declined

### Sandbox Testing

- Use the test base URL provided by EthSwitch
- Test with sandbox bank credentials provided by your bank

---

## CBE (Commercial Bank of Ethiopia)

### Overview

Manual bank transfer. The user transfers money to the Delta SPMU bank account, then submits the bank reference number through the student portal. An admin verifies the payment manually.

### Setup

1. Open a CBE business account
2. Configure account details in Frappe

### Configuration

```bash
cd /home/frappe/deltaspmu

bench set-config cbe_account_name   "Delta SPMU Academy"
bench set-config cbe_account_number "<YOUR-CBE-ACCOUNT-NUMBER>"
bench set-config cbe_bank_name      "Commercial Bank of Ethiopia"
```

### Flow

```
1. User selects "Bank Transfer (CBE)" as payment method
2. Frontend displays bank account details and instructions
3. User transfers funds via CBE mobile/branch
4. User enters bank reference number on student portal
5. Backend creates Payment Transaction with status "Pending Verification"
6. Admin portal shows pending verifications
7. Admin verifies reference number with bank statement
8. Admin marks payment as verified -> Course Access created
```

### Verification

Manual process:

1. Check the reference number against your CBE bank statement
2. Verify the amount matches the course price
3. Confirm the payment date is within the 30-minute transaction window
4. Mark as verified in the admin portal

---

## Testing in Sandbox Mode

### General approach

1. Set all payment providers to sandbox/test mode
2. Use provider-specific test credentials
3. Test each payment method end-to-end
4. Verify that Course Access records are created after payment
5. Verify that enrollment records are created
6. Test webhook delivery using provider dashboards or tools like ngrok

### Using ngrok for local webhook testing

If testing locally before deploying to EC2:

```bash
# Start ngrok tunnel to your local Frappe instance
ngrok http 8000

# Use the ngrok URL as your webhook endpoint
# Example: https://abc123.ngrok.io/api/method/lms.lms.payments_api.chapa_webhook
```

### Checklist per provider

- [ ] Payment initiation returns checkout URL
- [ ] User can complete payment on provider page
- [ ] Webhook is received by backend
- [ ] Webhook signature verification passes
- [ ] Payment Transaction status updates to Completed
- [ ] Course Access record created with correct dates
- [ ] LMS Enrollment record created
- [ ] Confirmation email sent
- [ ] User is redirected to success page
- [ ] `check_payment_status` API returns correct status

---

## Going to Production Checklist

- [ ] Switch telebirr from sandbox to production: `bench set-config telebirr_environment "production"`
- [ ] Replace Chapa test key with live key (starts with `CHASECK-`)
- [ ] Replace EthSwitch sandbox URL with production URL
- [ ] Verify all webhook URLs are using `https://api.deltaspmu.com` (not localhost or ngrok)
- [ ] Verify all return/redirect URLs point to `https://learn.deltaspmu.com`
- [ ] Test a real payment with a small amount on each provider
- [ ] Confirm webhook delivery is working in production
- [ ] Set up monitoring/alerts for failed payments
- [ ] Verify SSL certificates are valid on all domains
- [ ] Remove any test transactions from the database

---

## Troubleshooting

### Payment initiation fails with 403

- CSRF issue. Payment endpoints should use GET to bypass CSRF for cross-origin requests.
- Check that the endpoint has `allow_guest=True` if the user is not logged in.
- Check CORS configuration: `bench --site api.deltaspmu.com show-config | grep cors`

### Webhook not received

- Verify the webhook URL is reachable from the internet: `curl -I https://api.deltaspmu.com/api/method/lms.lms.payments_api.chapa_webhook`
- Check Nginx logs: `sudo tail -f /var/log/nginx/access.log`
- Check Frappe logs: `tail -f /home/frappe/deltaspmu/logs/frappe.log`
- For telebirr: ensure the notify URL is registered in your merchant dashboard
- For Chapa: check the webhook logs in the Chapa dashboard

### Webhook received but payment not processed

- Check signature verification. Look for errors in: `tail -f /home/frappe/deltaspmu/logs/frappe.log`
- Verify the webhook secret matches between provider dashboard and bench config
- Check that the transaction ID in the webhook matches an existing Payment Transaction record

### Course Access not created after payment

- Check the Payment Transaction record status in Frappe desk
- Look for errors in `frappe.log` during the enrollment creation step
- Verify the course name in the transaction matches an existing LMS Course
- Check that the `create_enrollment` function is being called

### "Payment expired" error

- Transactions expire after 30 minutes. The user must initiate a new payment.
- Check server time is synchronized: `timedatectl status`

### Exchange rate issues

- The exchange rate service has a fallback chain: Redis cache -> Live API -> Fallback API -> Last known -> Hardcoded 130.0
- If all external APIs fail, the hardcoded rate of 130 ETB/USD is used
- Clear the Redis cache to force a fresh rate: `bench --site api.deltaspmu.com clear-cache`
