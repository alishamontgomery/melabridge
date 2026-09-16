import { TEMPLATES } from './registry'
import * as React from 'react'
import { render } from '@react-email/render'
import { ReplitConnectors } from '@replit/connectors-sdk'

// Server-only. Never import from client components.

export type SendTemplateEmailResult =
  | { sent: true }
  | { sent: false; reason: 'recipient_suppressed' }
  | { sent: false; reason: 'provider_disabled' }

export interface SendTemplateEmailOptions {
  templateData?: Record<string, any>
  /** Dedupes retries of the same logical send; defaults to a random UUID (no dedupe). */
  idempotencyKey?: string
  replyTo?: string
}

const connectors = new ReplitConnectors()
let resendConnectionAvailable: Promise<boolean> | null = null

export function resetEmailProviderCacheForTests(): void {
  resendConnectionAvailable = null
}

async function hasResendConnection(): Promise<boolean> {
  if (!resendConnectionAvailable) {
    resendConnectionAvailable = connectors
      .listConnections({ connector_names: 'resend' })
      .then((connections) => connections.length > 0)
  }
  try {
    return await resendConnectionAvailable
  } catch (error) {
    resendConnectionAvailable = null
    throw error
  }
}

/** Renders a registered template and sends it through the configured provider. */
export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {}
): Promise<SendTemplateEmailResult> {
  const template = TEMPLATES[templateName]
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`
    )
  }

  // Template-level `to` takes precedence — notification templates always
  // send to their fixed address.
  const recipient = template.to || to
  if (!recipient) {
    throw new Error('Recipient is required (the template defines no fixed recipient)')
  }

  const templateData = options.templateData ?? {}
  const subject = typeof template.subject === 'function'
    ? template.subject(templateData)
    : template.subject
  const html = await render(React.createElement(template.component, templateData))

  if (!(await hasResendConnection())) {
    return { sent: false, reason: 'provider_disabled' }
  }

  try {
    const response = await connectors.proxy('resend', '/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: 'MelaBridge <noreply@melabridge.com>',
        to: [recipient],
        subject,
        html,
        ...(options.replyTo ? { reply_to: options.replyTo } : {}),
      }),
    })

    if (!response.ok) {
      throw new Error(`Email provider rejected the message (${response.status})`)
    }
    return { sent: true }
  } catch (error) {
    console.error('[email] Provider request failed')
    throw error
  }
}
