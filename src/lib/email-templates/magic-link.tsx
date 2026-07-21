import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import { BRAND, styles } from './_brand'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your MelaBridge sign-in link</Preview>
    <Body style={styles.main}>
      <Section style={styles.wrapper}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brandName}>MelaBridge</Text>
            <Text style={styles.brandTagline}>Secure sign-in</Text>
          </Section>
          <Section style={styles.content}>
            <Heading style={styles.h1}>Your sign-in link</Heading>
            <Text style={styles.text}>
              Click the button below to sign in to your MelaBridge workspace.
              This link expires shortly, so use it soon.
            </Text>
            <Button style={styles.button} href={confirmationUrl}>
              Sign in to MelaBridge
            </Button>
            <Hr style={styles.hr} />
            <Text style={styles.helper}>
              Or paste this URL into your browser:
              <br />
              <Link href={confirmationUrl} style={styles.link}>
                {confirmationUrl}
              </Link>
            </Text>
          </Section>
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Didn't request this link? You can safely ignore this email.
            </Text>
            <Text style={styles.footerText}>
              <Link href={`mailto:${BRAND.supportEmail}`} style={styles.link}>
                {BRAND.supportEmail}
              </Link>{' '}
              ·{' '}
              <Link href={BRAND.siteUrl} style={styles.link}>
                melabridge.com
              </Link>
            </Text>
          </Section>
        </Container>
      </Section>
    </Body>
  </Html>
)

export default MagicLinkEmail
