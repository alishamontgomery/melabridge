/**
 * Email template for organizer messages sent to guests.
 * Variables: eventName, organizerName, subject, body
 */
import * as React from 'react';

interface Props {
  eventName?: string;
  organizerName?: string;
  subject?: string;
  body?: string;
}

export function GuestMessageEmail({ eventName = 'your event', organizerName = 'Your event organizer', subject = 'A message from your organizer', body = '' }: Props) {
  return (
    <div style={{ fontFamily: "'Inter', Arial, sans-serif", maxWidth: 600, margin: '0 auto', color: '#111' }}>
      <div style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#a855f7 100%)', padding: '24px 32px', borderRadius: '12px 12px 0 0' }}>
        <p style={{ color: '#e9d5ff', fontSize: 12, margin: 0, letterSpacing: 2, textTransform: 'uppercase' }}>MelaBridge</p>
        <h1 style={{ color: '#fff', fontSize: 22, margin: '8px 0 0', fontWeight: 700 }}>
          {subject}
        </h1>
      </div>

      <div style={{ background: '#fafafa', border: '1px solid #e5e7eb', borderTop: 'none', padding: '28px 32px', borderRadius: '0 0 12px 12px' }}>
        <p style={{ margin: '0 0 16px', color: '#374151', fontSize: 15 }}>
          Message from the organiser of <strong>{eventName}</strong>:
        </p>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '20px 24px', whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.7, color: '#111' }}>
          {body}
        </div>

        <p style={{ marginTop: 24, fontSize: 13, color: '#6b7280' }}>
          This message was sent by {organizerName} via MelaBridge.
          If you have questions, please reply to your organiser directly.
        </p>
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 16 }}>
        MelaBridge · Replies go to the event organiser · Unsubscribe requests will be forwarded
      </p>
    </div>
  );
}
