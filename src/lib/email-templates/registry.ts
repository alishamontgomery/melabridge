import type { ComponentType } from 'react'
import { TicketConfirmationEmail } from './ticket-confirmation'
import { TeamInviteEmail } from './team-invite'
import { GuestMessageEmail } from './guest-message'
import { GuestMessageRsvpEmail } from './guest-message-rsvp'
import { GuestInvitationEmail } from './guest-invitation'
import { VendorMatchEmail } from './vendor-match'
import { AccountNotificationEmail } from './account-notification'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'account-notification': {
    component: AccountNotificationEmail,
    displayName: 'Account notification',
    subject: (d) => d.title ?? 'You have an update on MelaBridge',
    previewData: {
      recipientName: 'Jordan',
      title: 'Your weekly event update',
      body: 'You have 2 upcoming events and 3 open planning tasks.',
      actionUrl: '/dashboard',
    },
  },
  'ticket-confirmation': {
    component: TicketConfirmationEmail,
    displayName: 'Ticket confirmation',
    subject: (d) => `Your tickets to ${d.eventName ?? 'the event'} are confirmed`,
    previewData: {
      siteName: 'MelaBridge', eventName: 'A Night Under the Stars',
      eventDate: 'Saturday, October 17, 2026 at 7:00 PM',
      eventLocation: 'The Garden Room · Chicago, Illinois',
      buyerName: 'Jordan', ticketName: 'General Admission', quantity: 2,
      amountFormatted: '$150.00', orderId: 'MB-8F3C91A2',
      organizerName: 'Avery Events', organizerEmail: 'tickets@example.com',
      cancellationPolicy: 'allowed_until', cancellationWindowHours: 72,
      cancellationTerms: 'Tickets may be transferred to another guest at no charge.',
      attendeeQrCode: 'MB-TKT-8F3C91A2',
      ticketsUrl: 'https://melabridge.com/tickets/order/MB-8F3C91A2',
    },
  },
  'team-invite': {
    component: TeamInviteEmail,
    displayName: 'Team member added',
    subject: (d) => `You've been added to ${d.eventName ?? 'an event'} on MelaBridge`,
    previewData: { eventName: 'Amara & Julien — Wedding', inviterName: 'Amara', eventUrl: 'https://melabridge.com/events' },
  },
  'guest-message': {
    component: GuestMessageEmail,
    displayName: 'Message to guests',
    subject: (d) => d.subject ?? 'A message from your event organiser',
    previewData: { eventName: 'Summer Gala 2026', organizerName: 'Amara', subject: 'Important parking info', body: 'Hi! Just a quick reminder about parking…' },
  },
  'guest-message-rsvp': {
    component: GuestMessageRsvpEmail,
    displayName: 'Message to guests with RSVP buttons',
    subject: (d) => d.subject ?? 'A message from your event organiser',
    previewData: {
      eventName: 'Summer Gala 2026',
      organizerName: 'Amara',
      subject: 'Are you joining us?',
      body: 'Hi! We wanted to reach out about the Summer Gala. Please let us know if you can make it.',
      rsvpYesUrl: '#yes',
      rsvpNoUrl: '#no',
    },
  },
  'guest-invitation': {
    component: GuestInvitationEmail,
    displayName: 'Guest invitation',
    subject: (d) => `You're invited to ${d.eventName ?? 'an event'}`,
    previewData: {
      guestName: 'Jordan',
      eventName: 'Amara & Julien — Wedding',
      organizerName: 'Amara',
      message: 'We would be delighted to celebrate with you. Please let us know if you can join us.',
      rsvpYesUrl: '#yes',
      rsvpNoUrl: '#no',
    },
  },
  'vendor-match': {
    component: VendorMatchEmail,
    displayName: 'Vendor match available',
    subject: (d) => `A ${d.category ?? 'vendor'} match is available on MelaBridge`,
    previewData: {
      category: 'Photography',
      location: 'Chicago',
      vendorName: 'Aperture House',
      marketplaceUrl: 'https://melabridge.com/marketplace',
    },
  },
  'team-invite': {
    component: TeamInviteEmail,
    displayName: 'Team member added',
    subject: (d) => `You've been added to ${d.eventName ?? 'an event'} on MelaBridge`,
    previewData: { eventName: 'Amara & Julien — Wedding', inviterName: 'Amara', eventUrl: 'https://melabridge.com/events' },
  },
  'guest-message': {
    component: GuestMessageEmail,
    displayName: 'Message to guests',
    subject: (d) => d.subject ?? 'A message from your event organiser',
    previewData: { eventName: 'Summer Gala 2026', organizerName: 'Amara', subject: 'Important parking info', body: 'Hi! Just a quick reminder about parking…' },
  },
  'guest-message-rsvp': {
    component: GuestMessageRsvpEmail,
    displayName: 'Message to guests with RSVP buttons',
    subject: (d) => d.subject ?? 'A message from your event organiser',
    previewData: {
      eventName: 'Summer Gala 2026',
      organizerName: 'Amara',
      subject: 'Are you joining us?',
      body: 'Hi! We wanted to reach out about the Summer Gala. Please let us know if you can make it.',
      rsvpYesUrl: '#yes',
      rsvpNoUrl: '#no',
    },
  },
}
