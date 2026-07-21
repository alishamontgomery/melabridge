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

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your new MelaBridge email address</Preview>
    <Body style={styles.main}>
      <Section style={styles.wrapper}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brandName}>MelaBridge</Text>
            <Text style={styles.brandTagline}>Account update</Text>
          </Section>
          <Section style={styles.content}>
            <Heading style={styles.h1}>Confirm your email change</Heading>
            <Text style={styles.text}>
              You requested to change the email on your MelaBridge account
              from{' '}
              <Link href={`mailto:${oldEmail}`} style={styles.link}>
                <strong>{oldEmail}</strong>
              </Link>{' '}
              to{' '}
              <Link href={`mailto:${newEmail}`} style={styles.link}>
                <strong>{newEmail}</strong>
              </Link>
              .
            </Text>
            <Button style={styles.button} href={confirmationUrl}>
              Confirm email change
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
              If you didn't request this change, contact us immediately at{' '}
              <Link href={`mailto:${BRAND.supportEmail}`} style={styles.link}>
                {BRAND.supportEmail}
              </Link>{' '}
              to secure your account.
            </Text>
            <Text style={styles.footerText}>
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

export default EmailChangeEmail
