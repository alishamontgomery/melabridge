import type { ComponentType } from 'react'
import { TicketConfirmationEmail } from './ticket-confirmation'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'ticket-confirmation': {
    component: TicketConfirmationEmail,
    displayName: 'Ticket confirmation',
    subject: (d) => `Your tickets to ${d.eventName ?? 'the event'} are confirmed`,
  },
}

