import * as React from "react";
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import { BRAND, styles } from "./_brand";

export function AccountNotificationEmail({
  recipientName,
  title = "You have an update",
  body,
  actionUrl = "/notifications",
}: {
  recipientName?: string | null;
  title?: string;
  body?: string;
  actionUrl?: string;
}) {
  const url = actionUrl.startsWith("http") ? actionUrl : `${BRAND.siteUrl}${actionUrl}`;
  return (
    <Html lang="en">
      <Head />
      <Preview>{title}</Preview>
      <Body style={styles.main}>
        <Section style={styles.wrapper}>
          <Container style={styles.container}>
            <Section style={styles.header}><Text style={styles.brandName}>MelaBridge</Text></Section>
            <Section style={styles.content}>
              <Heading style={styles.h1}>{title}</Heading>
              {recipientName ? <Text style={styles.text}>Hi {recipientName},</Text> : null}
              <Text style={styles.text}>{body}</Text>
              <Button style={styles.button} href={url}>View update</Button>
            </Section>
          </Container>
        </Section>
      </Body>
    </Html>
  );
}

export default AccountNotificationEmail;
