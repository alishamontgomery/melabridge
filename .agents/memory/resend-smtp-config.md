---
name: Resend SMTP for auth emails
description: Supabase custom SMTP configured via Resend integration to remove Supabase branding from all auth emails.
---

## What was configured

Supabase auth config PATCH'd via Management API with:
- `smtp_host`: smtp.resend.com
- `smtp_port`: "465" (must be a string, NOT a number — API rejects integers)
- `smtp_user`: resend
- `smtp_pass`: Resend API key (created via Resend integration, stored only in Supabase)
- `smtp_sender_name`: MelaBridge
- `smtp_admin_email`: noreply@melabridge.com

All 6 email templates replaced with full `<!DOCTYPE html>` branded HTML (purple gradient header, MelaBridge wordmark, clean footer with © MelaBridge only).
All email subjects updated to mention "MelaBridge" explicitly.

**Why:** Supabase free tier locks sender name + template changes behind custom SMTP. Once custom SMTP is set, Supabase routes emails through that provider's infrastructure completely — their wrapper HTML and "powered by Supabase" footer are bypassed.

## Resend domain verification (COMPLETE)

Domain `melabridge.com` verified via two TXT DNS records added on Wix (MX section was locked to Google Workspace, MX record was skipped — only bounce tracking affected, sending works fine).

DNS records added: DKIM TXT at `resend._domainkey.melabridge.com` and SPF TXT at `send.melabridge.com`. Both confirmed via Google DNS API.

## Re-enabling SMTP after DNS verification

1. Use `listConnections("resend")` inside `"use impure"` → `conns[0].proxyFetch("/api-keys", { method: "POST", body: JSON.stringify({ name: "MelaBridge Supabase SMTP " + Date.now() }) })` to get a fresh SMTP API key token.
2. PATCH `https://api.supabase.com/v1/projects/fawkzsyuiduzjnlaxssd/config/auth` with `smtp_host`, `smtp_port: "465"`, `smtp_user: "resend"`, `smtp_pass: <token>`, `smtp_sender_name: "MelaBridge"`, `smtp_admin_email: "noreply@melabridge.com"`.
3. SMTP key must be created fresh each session — it's not stored anywhere persistent.

## Email template field names (CRITICAL — must use flat names, NOT nested mailer_templates object)

The Supabase Management API uses FLAT field names for templates, NOT `mailer_templates.confirmation.content`:
- `mailer_templates_confirmation_content` (use `{{ .ConfirmationURL }}`)
- `mailer_templates_invite_content`
- `mailer_templates_recovery_content`
- `mailer_templates_email_change_content`
- `mailer_templates_magic_link_content`
- `mailer_templates_reauthentication_content` (uses `{{ .Token }}` for OTP)
- `mailer_subjects_confirmation`, `mailer_subjects_invite`, etc. (for subjects)

Nested `mailer_templates: { confirmation: { content } }` silently no-ops — status 200 but templates don't save.

## Key decisions

- `smtp_port` MUST be sent as a string `"465"`, not integer `465`.
- Full `<!DOCTYPE html>` templates with flat field names confirmed working (confirm_has_doctype: true in GET response).
- Connection ID: conn_resend_01KZPH3V5915M61RGSZR7HRVWM (Resend integration, added to environment).
