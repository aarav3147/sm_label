# SM Labels — Production Security & Deployment Configuration Guide

This guide details the deployment security controls, environment variable management, secret rotation protocols, DNS security records, and incident response playbooks for **SM Labels** ([https://smlabels.in](https://smlabels.in)).

---

## 1. Environment Variable Management

All backend configuration values must be supplied via secure server-side environment variables. **Never hardcode secrets in client-side HTML, CSS, or JavaScript.**

| Variable Name | Required? | Secret? | Default / Example Value | Description |
| :--- | :---: | :---: | :--- | :--- |
| `OWNER_EMAIL` | Yes | No | `enterprisessm.delhi@gmail.com` | Destination inbox for verified customer inquiries |
| `FROM_EMAIL` | Yes | No | `quotes@smlabels.in` or `onboarding@resend.dev` | Verified outbound sender email address |
| `RESEND_API_KEY` | Yes | **YES** | `re_your_api_key_here` | Secret API key from [resend.com/api-keys](https://resend.com/api-keys) |

### Where to Store Secrets
- **Local Development:** In `.env.local` (this file is excluded by `.gitignore` and must never be committed to Git).
- **Production (Vercel):**
  1. Open the [Vercel Dashboard](https://vercel.com).
  2. Navigate to: **Project Settings > Environment Variables**.
  3. Add `RESEND_API_KEY`, `OWNER_EMAIL`, and `FROM_EMAIL` under the **Production** and **Preview** environments.
  4. Ensure the **"Automatically expose System Environment Variables"** toggle is configured according to least privilege.

---

## 2. Production Deployment Steps

### Option A: Vercel (Recommended for Serverless API)
1. Commit all verified changes to Git:
   ```bash
   git add .
   git commit -m "Deploy: Security hardening, rate limiting, and zero-vulnerability audit pass"
   git push origin master
   ```
2. Connect the repository in Vercel.
3. Configure the environment variables listed in Section 1 in the Vercel dashboard.
4. Deploy. Vercel will automatically apply `vercel.json` clean URLs, routing, and all HTTP security headers.

### Option B: Node.js VPS / Container Deployment
1. Ensure Node.js 18+ is installed.
2. Clone repository: `git clone <repo-url> && cd sm-labels`
3. Install production dependencies: `npm ci --production`
4. Create `.env.local` with the production environment variables.
5. Run using a process manager like PM2:
   ```bash
   pm2 start dev-server.js --name "sm-labels"
   pm2 save
   ```
6. Place behind an Nginx reverse proxy with SSL enabled (Let's Encrypt / Certbot).

---

## 3. Production Security Checklist

Before marking the deployment live, verify the following:

- [x] **HTTPS Enforcement:** Domain automatically redirects HTTP to HTTPS.
- [x] **HSTS:** `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` header active.
- [x] **MIME Protection:** `X-Content-Type-Options: nosniff` header active.
- [x] **Clickjacking Defense:** `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'` active.
- [x] **CSP:** Content Security Policy active and permitting only Google Fonts, Tailwind CDN, and trusted endpoints.
- [x] **Referrer Policy:** `strict-origin-when-cross-origin` active.
- [x] **Permissions Policy:** Unused browser APIs disabled (`camera=(), microphone=(), geolocation=(), payment=()`).
- [x] **No Secrets in Git:** Verified `.env.local` is ignored and zero credentials are in Git history.
- [x] **No Secrets in Frontend:** Client-side JavaScript contains zero API credentials.
- [x] **Zero Vulnerabilities:** `npm audit` returns 0 vulnerabilities.
- [x] **API Method Guard:** `/api/submit-enquiry` rejects GET, PUT, DELETE with `405 Method Not Allowed`.
- [x] **Rate Limiting:** In-memory IP rate limiter limits submissions to 5 per 10 minutes per IP.
- [x] **Payload Cap:** Requests > 15 KB are rejected with `413 Payload Too Large`.
- [x] **Anti-Spam:** Silent honeypot field absorbs bot submissions without triggering email dispatch.
- [x] **HTML Injection Guard:** All form inputs entity-encoded in email notifications.

---

## 4. DNS & Domain Security Guidelines (Manual Actions for Owner)

Configure the following DNS records at your domain registrar / DNS host (e.g. Cloudflare, Hostinger, GoDaddy):

### 1. Email Authentication Records (SPF, DKIM, DMARC)
Ensure inquiries sent from `smlabels.in` achieve high deliverability and cannot be spoofed:
- **SPF Record (TXT on `@`):**
  ```text
  v=spf1 include:amazonses.com include:resend.com ~all
  ```
- **DKIM Records:**
  Add the 3 CNAME records provided in your Resend dashboard under **Domains > smlabels.in**.
- **DMARC Record (TXT on `_dmarc.smlabels.in`):**
  ```text
  v=DMARC1; p=quarantine; rua=mailto:enterprisessm.delhi@gmail.com; pct=100; adkim=r; aspf=r
  ```

### 2. Certification Authority Authorization (CAA Record)
Restrict which certificate authorities can issue SSL certificates for `smlabels.in`:
```text
smlabels.in.  CAA  0  issue  "letsencrypt.org"
smlabels.in.  CAA  0  issuewild  ";"
```

---

## 5. Secret Rotation Procedure

If the `RESEND_API_KEY` is ever suspected of being exposed or compromised:

1. **Generate New Key:** Log in to [resend.com/api-keys](https://resend.com/api-keys) and create a new API key with the name `SM_LABELS_PROD_KEY_YYYYMM`.
2. **Update Hosting Environment:**
   - In Vercel: Update `RESEND_API_KEY` in Project Settings > Environment Variables.
   - In Local/VPS: Update `RESEND_API_KEY` in `.env.local`.
3. **Trigger Redeploy:** Redeploy the project in Vercel to load the new environment variable.
4. **Test Delivery:** Submit a test quote from the website to verify successful receipt at `enterprisessm.delhi@gmail.com`.
5. **Revoke Old Key:** In the Resend dashboard, delete the old compromised API key.

---

## 6. Incident Response Playbooks

### Playbook A: API Key Suspected Exposed
1. **Immediate Revocation:** Revoke the exposed key in Resend dashboard within 15 minutes.
2. **Search Commit Logs:** Verify whether the key was committed to Git (`git log -S "exposed-key-prefix"`).
3. **Generate Replacement:** Follow the Secret Rotation Procedure above.
4. **Review Outbound Volume:** Inspect Resend logs for unexpected spikes in dispatched emails.

### Playbook B: Form Spam Flooding
1. **Verify Rate Limiter:** Ensure the IP rate limiter is active in `/api/submit-enquiry.js`.
2. **Inspect Trapped Logs:** Check Vercel function runtime logs for honeypot bot trap notices.
3. **Edge Cloudflare Protection:** If an attacker uses a distributed proxy network to bypass IP rate limits, activate Cloudflare "Under Attack Mode" or Cloudflare Turnstile CAPTCHA on `/api/submit-enquiry`.

### Playbook C: Rollback Procedure
If a production deployment introduces unexpected issues:
1. In the Vercel dashboard, navigate to **Deployments**.
2. Select the previous stable deployment and click **"Promote to Production"**.
3. Traffic will instantly route to the prior deployment without downtime.

---

## 7. Ongoing Maintenance & Health Checks

- **Monthly:** Run `npm audit` to identify newly disclosed vulnerabilities in package dependencies.
- **Quarterly:** Review Resend API delivery logs and verify bounce rates remain below 1%.
- **Annually:** Review domain SSL/TLS certificate renewal status and update DMARC compliance reports.
