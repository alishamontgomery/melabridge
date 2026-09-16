// Shared brand styles + constants for MelaBridge auth emails.
// Keep colors HEX and fonts email-safe (no external CSS, no <style> tags).

export const BRAND = {
  name: 'MelaBridge',
  siteUrl: 'https://melabridge.com',
  supportEmail: 'hello@melabridge.com',
  // Approximation of the app's primary purple (oklch(0.42 0.19 295)) in sRGB.
  primary: '#4b2aa4',
  primaryGlow: '#7a4fe0',
  gold: '#d9a441',
  ink: '#1a1030',
  body: '#4a4560',
  muted: '#9a94ab',
  border: '#e8e4f2',
  surface: '#faf8ff',
} as const

export const styles = {
  main: {
    backgroundColor: '#ffffff',
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    color: BRAND.body,
    margin: '0',
    padding: '0',
  },
  wrapper: {
    backgroundColor: BRAND.surface,
    padding: '32px 16px',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    border: `1px solid ${BRAND.border}`,
    maxWidth: '560px',
    margin: '0 auto',
    padding: '0',
    overflow: 'hidden',
  },
  header: {
    background: `linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryGlow} 100%)`,
    padding: '28px 32px',
    textAlign: 'left' as const,
  },
  brandName: {
    color: '#ffffff',
    fontFamily:
      "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    fontSize: '22px',
    fontWeight: 600 as const,
    letterSpacing: '-0.01em',
    margin: '0',
  },
  brandTagline: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: '12px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    margin: '6px 0 0',
  },
  content: {
    padding: '32px',
  },
  h1: {
    fontFamily:
      "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    fontSize: '24px',
    fontWeight: 600 as const,
    color: BRAND.ink,
    lineHeight: '1.25',
    margin: '0 0 16px',
  },
  text: {
    fontSize: '15px',
    color: BRAND.body,
    lineHeight: '1.6',
    margin: '0 0 20px',
  },
  button: {
    backgroundColor: BRAND.primary,
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 600 as const,
    borderRadius: '10px',
    padding: '14px 28px',
    textDecoration: 'none',
    display: 'inline-block',
  },
  code: {
    fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
    fontSize: '28px',
    fontWeight: 700 as const,
    color: BRAND.primary,
    letterSpacing: '0.24em',
    backgroundColor: BRAND.surface,
    border: `1px solid ${BRAND.border}`,
    borderRadius: '10px',
    padding: '16px 20px',
    display: 'inline-block',
    margin: '0 0 24px',
  },
  hr: {
    border: 'none',
    borderTop: `1px solid ${BRAND.border}`,
    margin: '28px 0',
  },
  link: {
    color: BRAND.primary,
    textDecoration: 'underline',
  },
  footer: {
    padding: '20px 32px 28px',
    borderTop: `1px solid ${BRAND.border}`,
    backgroundColor: BRAND.surface,
  },
  footerText: {
    fontSize: '12px',
    color: BRAND.muted,
    lineHeight: '1.6',
    margin: '0 0 6px',
  },
  helper: {
    fontSize: '13px',
    color: BRAND.muted,
    lineHeight: '1.6',
    margin: '0',
  },
}
