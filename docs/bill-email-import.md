# Bill Email Import

This MVP imports utility bills from forwarded email.

## Flow

1. The app creates a per-user local part in `email_import_addresses`.
2. The user forwards bills to `local_part@EXPO_PUBLIC_BILL_IMPORT_DOMAIN`.
3. Cloudflare Email Routing sends the message to `cloudflare/email-worker/worker.js`.
4. The Worker calls the Supabase Edge Function `process-bill-email`.
5. The Edge Function parses amount, due date, provider, and creates a pending row in `detected_bills`.
6. The app lets the user accept or ignore each pending bill.

## Required env

App:

```bash
EXPO_PUBLIC_BILL_IMPORT_DOMAIN=import.your-domain.com
# No-domain Gmail fallback:
EXPO_PUBLIC_BILL_IMPORT_MAILBOX=your.import.mailbox@gmail.com
```

Supabase Edge Function:

```bash
BILL_IMPORT_WEBHOOK_SECRET=use-a-long-random-secret
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Cloudflare Worker:

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
BILL_IMPORT_WEBHOOK_SECRET=the-same-secret
```

## Setup

1. Run `supabase/migrations/20260418120000_bill_email_imports.sql`.
2. Deploy the Supabase function:

```bash
supabase functions deploy process-bill-email --no-verify-jwt
supabase secrets set BILL_IMPORT_WEBHOOK_SECRET=...
```

3. Enable Cloudflare Email Routing for your import domain, or use the Gmail fallback below.
4. Deploy the Worker in `cloudflare/email-worker`.
5. Route your import address domain to the Worker.

The parser is deliberately rule-based for now. Add new Turkish providers in
`supabase/functions/process-bill-email/parser.ts`.

## Cloudflare deploy

From the project root:

```bash
cd cloudflare/email-worker
npx wrangler login
npx wrangler secret put BILL_IMPORT_WEBHOOK_SECRET
npx wrangler deploy
```

Then in Cloudflare Dashboard:

1. Open your domain.
2. Go to Email Routing.
3. Enable Email Routing and let Cloudflare add the DNS records.
4. Open Email Workers.
5. Create or select `subtification-bill-email-worker`.
6. Enable Catch-all address.
7. Set the Catch-all action to send mail to this Worker.

The app generates a unique local part for each user, such as
`u_xxx@yourdomain.com`, so Catch-all routing is the simplest production setup.
Use the same domain in `EXPO_PUBLIC_BILL_IMPORT_DOMAIN`.

## No-domain Gmail fallback

If you do not own a domain, use one Gmail inbox as the import mailbox. Gmail
plus addressing lets each user get a unique address:

```text
your.import.mailbox+u_xxx@gmail.com
```

Set the app env:

```bash
EXPO_PUBLIC_BILL_IMPORT_MAILBOX=your.import.mailbox@gmail.com
```

Then create a Google Apps Script on that Gmail account:

1. Open https://script.google.com.
2. Create a new project.
3. Paste `google-apps-script/bill-import-gmail.gs`.
4. Replace `PASTE_THE_SAME_SECRET_HERE`.
5. Replace `PASTE_YOUR_GMAIL_ADDRESS_HERE`.
6. Run `createBillImportTrigger` once and approve permissions.

The trigger checks the inbox every 5 minutes and forwards matching bill emails to
the Supabase Edge Function.
