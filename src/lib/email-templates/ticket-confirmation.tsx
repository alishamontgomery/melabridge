import * as React from 'react'
import {
  Body, Container, Head, Heading, Html, Img, Link, Preview, Section, Text, Hr,
} from '@react-email/components'

export interface TicketConfirmationProps {
  siteName: string
  eventName: string
  eventDate?: string | null
  eventLocation?: string | null
  buyerName?: string | null
  ticketName: string
  quantity: number
  amountFormatted: string
  orderId: string
  organizerEmail?: string | null
  /** Data URL (image/png) of the first attendee's QR. */
  qrDataUrl?: string | null
  attendeeQrCode?: string | null
  ticketsUrl?: string | null
}

export const TicketConfirmationEmail = ({
  siteName, eventName, eventDate, eventLocation, buyerName, ticketName,
  quantity, amountFormatted, orderId, organizerEmail, qrDataUrl, attendeeQrCode, ticketsUrl,
}: TicketConfirmationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your tickets to {eventName} are confirmed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>You're in{buyerName ? `, ${buyerName}` : ''} 🎉</Heading>
        <Text style={text}>
          Your order for <strong>{eventName}</strong> is confirmed. Bring this email (or the QR code below) to the door for a fast check-in.
        </Text>

        <Section style={card}>
          <Text style={label}>Event</Text>
          <Text style={value}>{eventName}</Text>
          {eventDate && (<><Text style={label}>When</Text><Text style={value}>{eventDate}</Text></>)}
          {eventLocation && (<><Text style={label}>Where</Text><Text style={value}>{eventLocation}</Text></>)}
          <Hr style={hr} />
          <Text style={label}>Ticket</Text>
          <Text style={value}>{ticketName} × {quantity}</Text>
          <Text style={label}>Total</Text>
          <Text style={value}>{amountFormatted}</Text>
          <Text style={label}>Order</Text>
          <Text style={mono}>{orderId}</Text>
        </Section>

        {qrDataUrl && (
          <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
            <Img src={qrDataUrl} alt="Your ticket QR code" width={200} height={200} style={{ margin: '0 auto', borderRadius: 8 }} />
            {attendeeQrCode && <Text style={mono}>{attendeeQrCode}</Text>}
          </Section>
        )}

        {ticketsUrl && (
          <Text style={text}>
            View or download all attendee tickets: <Link href={ticketsUrl} style={link}>{ticketsUrl}</Link>
          </Text>
        )}

        <Text style={footer}>
          Sent by {siteName}{organizerEmail ? <> · Questions? <Link style={link} href={`mailto:${organizerEmail}`}>{organizerEmail}</Link></> : null}
        </Text>
      </Container>
    </Body>
  </Html>
)

export default TicketConfirmationEmail

const main = { backgroundColor: '#f6f7f9', fontFamily: 'Arial, sans-serif' }
const container = { padding: '28px 24px', maxWidth: 560, margin: '0 auto', backgroundColor: '#ffffff' }
const h1 = { fontSize: 22, fontWeight: 'bold' as const, color: '#111', margin: '0 0 16px' }
const text = { fontSize: 14, color: '#333', lineHeight: '1.55', margin: '0 0 18px' }
const card = { backgroundColor: '#fafafa', border: '1px solid #eee', borderRadius: 10, padding: '16px 18px', margin: '4px 0 8px' }
const label = { fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 0.6, color: '#888', margin: '10px 0 2px' }
const value = { fontSize: 14, color: '#111', margin: '0 0 4px', fontWeight: 500 as const }
const mono = { fontSize: 12, color: '#555', fontFamily: 'ui-monospace, Menlo, monospace', margin: '4px 0 0' }
const hr = { borderColor: '#eee', margin: '14px 0' }
const link = { color: '#2563eb', textDecoration: 'underline' }
const footer = { fontSize: 12, color: '#888', margin: '28px 0 0', textAlign: 'center' as const }
