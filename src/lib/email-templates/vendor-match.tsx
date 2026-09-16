import * as React from 'react'
import {
  Body,
  Button,
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

interface VendorMatchEmailProps {
  category?: string
  location?: string
  vendorName?: string
  marketplaceUrl?: string
}

export const VendorMatchEmail = ({
  category = 'vendor',
  location,
  vendorName = 'a vendor',
  marketplaceUrl = 'https://melabridge.com/marketplace',
}: VendorMatchEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>A {category} vendor is now available on MelaBridge</Preview>
    <Body style={styles.main}>
      <Section style={styles.wrapper}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Text style={styles.brandName}>MelaBridge</Text>
            <Text style={styles.brandTagline}>Event planning, connected</Text>
          </Section>
          <Section style={styles.content}>
            <Heading style={styles.h1}>A vendor match is available</Heading>
            <Text style={styles.text}>
              {vendorName} is now listed for {category}
              {location ? ` in ${location}` : ''}, matching a vendor need you saved.
            </Text>
            <Button style={styles.button} href={marketplaceUrl}>
              View marketplace
            </Button>
            <Text style={styles.helper}>
              MelaBridge does not endorse or guarantee vendors. Review the listing and decide whether it fits your event.
            </Text>
          </Section>
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              You received this because you saved a vendor need on MelaBridge.{' '}
              <Link href={BRAND.siteUrl} style={styles.link}>melabridge.com</Link>
            </Text>
          </Section>
        </Container>
      </Section>
    </Body>
  </Html>
)

export default VendorMatchEmail