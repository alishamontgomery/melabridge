// Server-only helpers for ticket QR + PDF generation and confirmation emails.
// Loaded lazily from server-function handlers (never at module scope of
// *.functions.ts files, per server-functions-modern guidance).

import QRCode from 'qrcode'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { sendTemplateEmail } from '@/lib/email-templates/send-email'

function money(cents: number, currency = 'usd') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format((cents ?? 0) / 100)
  } catch {
    return `$${((cents ?? 0) / 100).toFixed(2)}`
  }
}

function fmtDate(date?: string | null, time?: string | null) {
  if (!date) return null
  try {
    const d = new Date(`${date}T${time ?? '00:00'}`)
    return d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: time ? 'short' : undefined })
  } catch { return date }
}

export async function qrDataUrl(code: string) {
  return QRCode.toDataURL(code, { errorCorrectionLevel: 'M', margin: 1, width: 400 })
}

export async function qrPngBytes(code: string) {
  return QRCode.toBuffer(code, { errorCorrectionLevel: 'M', margin: 1, width: 512 })
}

export interface TicketPdfArgs {
  eventName: string
  eventWhen?: string | null
  eventLocation?: string | null
  ticketName: string
  attendeeName?: string | null
  orderId: string
  attendees: { qr_code: string; full_name?: string | null }[]
}

export async function buildTicketPdf(args: TicketPdfArgs): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  for (const [i, att] of args.attendees.entries()) {
    const page = doc.addPage([612, 792]) // US Letter
    const { width } = page.getSize()

    page.drawRectangle({ x: 0, y: 720, width, height: 72, color: rgb(0.07, 0.09, 0.15) })
    page.drawText('MelaBridge · Admit One', { x: 36, y: 748, size: 18, font: bold, color: rgb(1, 1, 1) })
    page.drawText(`Ticket ${i + 1} of ${args.attendees.length}`, { x: 36, y: 728, size: 10, font, color: rgb(0.85, 0.9, 1) })

    let y = 680
    const line = (label: string, value: string, s = 12) => {
      page.drawText(label, { x: 36, y, size: 9, font, color: rgb(0.5, 0.5, 0.55) })
      page.drawText(value, { x: 36, y: y - 14, size: s, font: bold, color: rgb(0.1, 0.1, 0.15) })
      y -= 36
    }
    line('EVENT', args.eventName, 16)
    if (args.eventWhen) line('WHEN', args.eventWhen)
    if (args.eventLocation) line('WHERE', args.eventLocation)
    line('TICKET', args.ticketName)
    line('ATTENDEE', att.full_name ?? args.attendeeName ?? 'Guest')
    line('ORDER', args.orderId)

    const png = await qrPngBytes(att.qr_code)
    const img = await doc.embedPng(png)
    const size = 220
    page.drawImage(img, { x: width - size - 36, y: 380, width: size, height: size })
    page.drawText(att.qr_code, { x: width - size - 36, y: 366, size: 9, font, color: rgb(0.4, 0.4, 0.45) })

    page.drawText('Present this QR code at check-in.', { x: 36, y: 60, size: 10, font, color: rgb(0.4, 0.4, 0.45) })
  }
  return await doc.save()
}

export interface SendConfirmationArgs {
  orderId: string
  siteUrl?: string
}

/** Send a confirmation email for a paid order. Idempotent per orderId. */
export async function sendOrderConfirmation({ orderId, siteUrl }: SendConfirmationArgs) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
  const { data: order, error } = await supabaseAdmin
    .from('ticket_orders')
    .select('id, buyer_name, buyer_email, quantity, amount_cents, currency, event_id, ticket_type_id, email_sent_at')
    .eq('id', orderId)
    .maybeSingle()
  if (error || !order) throw new Error(error?.message ?? 'Order not found')
  if (!order.buyer_email) throw new Error('No email on order')

  const [{ data: ev }, { data: type }, { data: attendees }] = await Promise.all([
    supabaseAdmin.from('events').select('name, event_date, event_time, location, owner_id').eq('id', order.event_id).maybeSingle(),
    supabaseAdmin.from('ticket_types').select('name').eq('id', order.ticket_type_id).maybeSingle(),
    supabaseAdmin.from('ticket_attendees').select('qr_code, full_name').eq('order_id', orderId).order('created_at', { ascending: true }),
  ])
  let organizerEmail: string | null = null
  if (ev?.owner_id) {
    const { data: prof } = await supabaseAdmin.from('profiles').select('email').eq('id', ev.owner_id).maybeSingle()
    organizerEmail = (prof as any)?.email ?? null
  }

  const firstQr = attendees?.[0]?.qr_code as string | undefined
  const qr = firstQr ? await qrDataUrl(firstQr) : null

  await sendTemplateEmail('ticket-confirmation', order.buyer_email, {
    idempotencyKey: `ticket-order:${order.id}`,
    templateData: {
      siteName: 'MelaBridge',
      eventName: ev?.name ?? 'Your event',
      eventDate: fmtDate(ev?.event_date as any, ev?.event_time as any),
      eventLocation: ev?.location ?? null,
      buyerName: order.buyer_name,
      ticketName: type?.name ?? 'Admission',
      quantity: order.quantity,
      amountFormatted: money(order.amount_cents ?? 0, (order.currency as string) ?? 'usd'),
      orderId: order.id,
      organizerEmail,
      qrDataUrl: qr,
      attendeeQrCode: firstQr ?? null,
      ticketsUrl: siteUrl ? `${siteUrl}/tickets/order/${order.id}` : null,
    },
    replyTo: organizerEmail ?? undefined,
  })

  if (!order.email_sent_at) {
    await supabaseAdmin.from('ticket_orders').update({ email_sent_at: new Date().toISOString() }).eq('id', order.id)
  }
  return { sent: true, email: order.buyer_email }
}
