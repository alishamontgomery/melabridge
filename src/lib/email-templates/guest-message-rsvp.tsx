/**
 * Guest-message email template that includes RSVP action buttons.
 * Used when the message is sent to a guest-based group and the recipient
 * has a known guest record (so we can sign per-guest tokens).
 *
 * Variables: eventName, organizerName, subject, body,
 *            rsvpYesUrl, rsvpNoUrl (optional — omit to hide buttons)
 */
import * as React from "react";

interface Props {
  eventName?: string;
  organizerName?: string;
  subject?: string;
  body?: string;
  rsvpYesUrl?: string;
  rsvpNoUrl?: string;
}

export function GuestMessageRsvpEmail({
  eventName = "your event",
  organizerName = "Your event organiser",
  subject = "A message from your organiser",
  body = "",
  rsvpYesUrl,
  rsvpNoUrl,
}: Props) {
  const showRsvp = !!(rsvpYesUrl && rsvpNoUrl);

  return (
    <div style={{ fontFamily: "'Inter', Arial, sans-serif", maxWidth: 600, margin: "0 auto", color: "#111" }}>
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg,#7c3aed 0%,#a855f7 100%)",
          padding: "24px 32px",
          borderRadius: "12px 12px 0 0",
        }}
      >
        <p style={{ color: "#e9d5ff", fontSize: 12, margin: 0, letterSpacing: 2, textTransform: "uppercase" }}>
          MelaBridge
        </p>
        <h1 style={{ color: "#fff", fontSize: 22, margin: "8px 0 0", fontWeight: 700 }}>
          {subject}
        </h1>
      </div>

      {/* Body */}
      <div
        style={{
          background: "#fafafa",
          border: "1px solid #e5e7eb",
          borderTop: "none",
          padding: "28px 32px",
          borderRadius: showRsvp ? "0" : "0 0 12px 12px",
        }}
      >
        <p style={{ margin: "0 0 16px", color: "#374151", fontSize: 15 }}>
          Message from the organiser of <strong>{eventName}</strong>:
        </p>

        <div
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "20px 24px",
            whiteSpace: "pre-wrap",
            fontSize: 15,
            lineHeight: 1.7,
            color: "#111",
          }}
        >
          {body}
        </div>

        <p style={{ marginTop: 24, fontSize: 13, color: "#6b7280" }}>
          This message was sent by {organizerName} via MelaBridge.
        </p>
      </div>

      {/* RSVP section */}
      {showRsvp && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderTop: "none",
            padding: "24px 32px",
            borderRadius: "0 0 12px 12px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 14,
              fontWeight: 600,
              color: "#166534",
            }}
          >
            Let the organiser know if you're coming
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href={rsvpYesUrl}
              style={{
                display: "inline-block",
                background: "#16a34a",
                color: "#fff",
                padding: "12px 28px",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              ✓ I'm coming!
            </a>
            <a
              href={rsvpNoUrl}
              style={{
                display: "inline-block",
                background: "#fff",
                color: "#374151",
                border: "1px solid #d1d5db",
                padding: "12px 28px",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              Can't make it
            </a>
          </div>
          <p style={{ marginTop: 12, fontSize: 11, color: "#6b7280" }}>
            Clicking a button updates your RSVP instantly — no account needed.
          </p>
        </div>
      )}

      <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginTop: 16 }}>
        MelaBridge · Replies go to the event organiser
      </p>
    </div>
  );
}
