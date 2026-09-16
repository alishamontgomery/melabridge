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

interface TeamInviteEmailProps {
  eventName?: string
  inviterName?: string
  eventUrl?: string
}

export const TeamInviteEmail = ({
  eventName = 'an event',
  inviterName,
  eventUrl = 'https://melabridge.com',
}: TeamInviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been added to {eventName} on MelaBridge</Preview>
    <Body style={styles.main}>
      <Section style={styles.wrapper}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brandName}>MelaBridge</Text>
            <Text style={styles.brandTagline}>Event collaboration</Text>
          </Section>
          <Section style={styles.content}>
            <Heading style={styles.h1}>You're now on the team</Heading>
            <Text style={styles.text}>
              {inviterName ? `${inviterName} has` : 'You have been'} added you to{' '}
              <strong>{eventName}</strong> on MelaBridge. You can now access the
              event workspace, collaborate on planning, and stay up to date.
            </Text>
            <Button style={styles.button} href={eventUrl}>
              Open event workspace
            </Button>
            <Hr style={styles.hr} />
            <Text style={styles.helper}>
              Button not working? Paste this link into your browser:
              <br />
              <Link href={eventUrl} style={styles.link}>
                {eventUrl}
              </Link>
            </Text>
          </Section>
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Didn't expect this? Contact the event owner or reach us at{' '}
              <Link href={`mailto:${BRAND.supportEmail}`} style={styles.link}>
                {BRAND.supportEmail}
              </Link>
              {' '}·{' '}
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

export default TeamInviteEmail
