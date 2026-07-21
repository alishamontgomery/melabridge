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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email to start planning with MelaBridge</Preview>
    <Body style={styles.main}>
      <Section style={styles.wrapper}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brandName}>MelaBridge</Text>
            <Text style={styles.brandTagline}>Event planning, orchestrated</Text>
          </Section>
          <Section style={styles.content}>
            <Heading style={styles.h1}>Welcome — confirm your email</Heading>
            <Text style={styles.text}>
              Thanks for creating a MelaBridge account for{' '}
              <Link href={`mailto:${recipient}`} style={styles.link}>
                {recipient}
              </Link>
              . Confirm your email to unlock your planning workspace.
            </Text>
            <Button style={styles.button} href={confirmationUrl}>
              Verify email
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
              Didn't sign up? You can safely ignore this email.
            </Text>
            <Text style={styles.footerText}>
              Questions?{' '}
              <Link href={`mailto:${BRAND.supportEmail}`} style={styles.link}>
                {BRAND.supportEmail}
              </Link>{' '}
              ·{' '}
              <Link href={siteUrl} style={styles.link}>
                melabridge.com
              </Link>
            </Text>
          </Section>
        </Container>
      </Section>
    </Body>
  </Html>
)

export default SignupEmail
