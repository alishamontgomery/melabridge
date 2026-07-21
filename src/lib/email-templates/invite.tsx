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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ confirmationUrl }: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to MelaBridge</Preview>
    <Body style={styles.main}>
      <Section style={styles.wrapper}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brandName}>MelaBridge</Text>
            <Text style={styles.brandTagline}>You're invited</Text>
          </Section>
          <Section style={styles.content}>
            <Heading style={styles.h1}>Join your team on MelaBridge</Heading>
            <Text style={styles.text}>
              You've been invited to collaborate on an event workspace in
              MelaBridge — the planning platform for weddings, cultural events,
              and celebrations. Accept the invite to set up your account.
            </Text>
            <Button style={styles.button} href={confirmationUrl}>
              Accept invitation
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
              Weren't expecting this invitation? You can safely ignore this
              email.
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

export default InviteEmail
