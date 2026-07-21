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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your MelaBridge password</Preview>
    <Body style={styles.main}>
      <Section style={styles.wrapper}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brandName}>MelaBridge</Text>
            <Text style={styles.brandTagline}>Account security</Text>
          </Section>
          <Section style={styles.content}>
            <Heading style={styles.h1}>Reset your password</Heading>
            <Text style={styles.text}>
              We received a request to reset the password for your MelaBridge
              account. Choose a new password using the button below — the link
              expires in 60 minutes.
            </Text>
            <Button style={styles.button} href={confirmationUrl}>
              Reset password
            </Button>
            <Hr style={styles.hr} />
            <Text style={styles.helper}>
              Button not working? Paste this link into your browser:
              <br />
              <Link href={confirmationUrl} style={styles.link}>
                {confirmationUrl}
              </Link>
            </Text>
          </Section>
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              If you didn't request a password reset, you can safely ignore this
              email — your password will not change.
            </Text>
            <Text style={styles.footerText}>
              Need help?{' '}
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

export default RecoveryEmail
