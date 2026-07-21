import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import { BRAND, styles } from './_brand'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your MelaBridge verification code</Preview>
    <Body style={styles.main}>
      <Section style={styles.wrapper}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brandName}>MelaBridge</Text>
            <Text style={styles.brandTagline}>Verification code</Text>
          </Section>
          <Section style={styles.content}>
            <Heading style={styles.h1}>Confirm it's you</Heading>
            <Text style={styles.text}>
              Enter the code below in MelaBridge to confirm your identity. It
              expires shortly.
            </Text>
            <Text style={styles.code}>{token}</Text>
            <Text style={styles.helper}>
              Didn't request this? You can safely ignore this email — no changes
              will be made to your account.
            </Text>
          </Section>
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Questions?{' '}
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

export default ReauthenticationEmail
