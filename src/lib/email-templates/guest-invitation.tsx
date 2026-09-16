import * as React from "react";

interface Props {
  guestName?: string;
  eventName?: string;
  organizerName?: string;
  message?: string;
  rsvpYesUrl?: string;
  rsvpNoUrl?: string;
}

export function GuestInvitationEmail({
  guestName = "Guest",
  eventName = "our event",
  organizerName = "Your event organiser",
  message = "We would love for you to join us. Please let us know if you can make it.",
  rsvpYesUrl = "#",
  rsvpNoUrl = "#",
}: Props) {
  return (
    <div style={{ fontFamily: "'Inter', Arial, sans-serif", maxWidth: 600, margin: "0 auto", color: "#292524" }}>
      <div style={{ background: "#581c87", padding: "36px 32px", borderRadius: "16px 16px 0 0", textAlign: "center" }}>
        <p style={{ color: "#e9d5ff", fontFamily: "'Manrope', Arial, sans-serif", fontSize: 11, margin: 0, letterSpacing: 3, textTransform: "uppercase" }}>
          You&apos;re invited
        </p>
        <h1 style={{ color: "#fff", fontSize: 30, margin: "12px 0 0", fontWeight: 500 }}>{eventName}</h1>
      </div>
      <div style={{ background: "#fffbeb", border: "1px solid #e7e5e4", borderTop: "none", padding: "34px 32px", textAlign: "center" }}>
        <p style={{ fontSize: 19, margin: "0 0 18px" }}>Dear {guestName},</p>
        <p style={{ fontFamily: "'Inter', Arial, sans-serif", fontSize: 15, lineHeight: 1.75, margin: "0 auto 26px", maxWidth: 480, whiteSpace: "pre-wrap" }}>
          {message}
        </p>
        <p style={{ fontFamily: "'Manrope', Arial, sans-serif", fontSize: 14, fontWeight: 600, margin: "0 0 16px" }}>
          Will you be joining us?
        </p>
        <div>
          <a href={rsvpYesUrl} style={{ display: "inline-block", background: "#7e22ce", color: "#fff", padding: "12px 24px", margin: "4px", borderRadius: 999, textDecoration: "none", fontFamily: "'Manrope', Arial, sans-serif", fontWeight: 700 }}>
            Yes, I&apos;ll be there
          </a>
          <a href={rsvpNoUrl} style={{ display: "inline-block", background: "#fff", color: "#57534e", border: "1px solid #d6d3d1", padding: "11px 24px", margin: "4px", borderRadius: 999, textDecoration: "none", fontFamily: "'Manrope', Arial, sans-serif", fontWeight: 600 }}>
            I can&apos;t make it
          </a>
        </div>
        <p style={{ fontFamily: "'Inter', Arial, sans-serif", color: "#78716c", fontSize: 12, margin: "28px 0 0" }}>
          Sent with care by {organizerName} through MelaBridge.
        </p>
      </div>
    </div>
  );
}
