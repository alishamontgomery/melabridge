# Calendar subscription release check

Run this check with a test vendor before each release that changes the calendar
feed, calendar settings, or hosting. Use a test account and test event data;
calendar feed URLs are private credentials and must not be added to tickets,
screenshots, or source control.

## Test fixture

Create the following records for the test vendor:

- One confirmed booking with a known time, for example `2026-10-14
18:00–22:00 UTC`.
- One blocked date covering three inclusive dates, for example
  `2026-10-20` through `2026-10-22`.
- A second confirmed booking whose name and time can be changed after the
  subscriptions are created.

In **Settings → External calendar sync**, generate a private calendar link.
Leave the privacy switches at their default values for the first pass, then
enable event name and venue for the detail-visibility check if needed. Record
the feed generation time and the test vendor's calendar timezone in the
release evidence, but never record the URL itself.

## Subscribe each provider

Use the provider button beside the generated link where available. If a
provider does not open the subscription flow, copy the link and use the
provider's current “subscribe from URL” flow instead.

| Provider          | Subscription method                                                                                                                                                     | Initial pass criteria                                             |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Google Calendar   | Select **Subscribe** beside Google Calendar. If prompted, use the feed URL with the `webcal:` scheme, or paste the HTTPS feed URL under **Other calendars → From URL**. | A subscribed calendar appears and contains the confirmed booking. |
| Microsoft Outlook | Select **Subscribe** beside Microsoft Outlook, or use **Add calendar → Subscribe from web** and paste the HTTPS feed URL.                                               | A subscribed calendar appears and contains the confirmed booking. |
| Apple Calendar    | Select **Subscribe** beside Apple Calendar, or use **File → New Calendar Subscription** on macOS and paste the `webcal:` URL.                                           | A subscribed calendar appears and contains the confirmed booking. |

For each provider, verify all of the following before checking refresh
behavior:

- The booking starts and ends at the expected time after converting from UTC
  to the calendar's displayed timezone.
- The blocked date is an all-day entry on October 20, 21, and 22, and does
  not include October 23.
- The default feed does not reveal the event name, venue, or address. Repeat
  with the corresponding privacy switches enabled only if that behavior is
  part of the release.
- The feed is read-only; no provider should be able to write events back to
  MelaBridge.

## Refresh check

After all three subscriptions have loaded the initial fixture:

1. Change the second booking's start/end time and, if enabled, its event name.
2. Extend the blocked date range by one day.
3. Record the change time. Do not unsubscribe and do not replace the URL.
4. Wait for the provider's normal subscription refresh. Do not treat a
   manually forced browser refresh as a passing refresh check.
5. Confirm the changed booking and new blocked day appear in each provider,
   and that the old booking time is gone.

Provider polling cadence is controlled by the provider and can change. Record
the observed refresh time for Google Calendar, Outlook, and Apple Calendar in
release evidence. The feed advertises a one-hour published refresh hint and
uses a five-minute HTTP cache; neither is a guarantee that a provider will
poll on that schedule. A delayed provider refresh is expected until that
provider's normal cadence has elapsed.

## Link reset check

Use the same test vendor and all three subscriptions:

1. Copy the current feed URL as `old URL` without saving it in the release
   artifact.
2. Select **Reset link** in MelaBridge and copy the new URL.
3. Request the old URL from a private browser window or with a GET request
   that prints response headers. It must return `404 Calendar not found`.
4. Request the new URL. It must return HTTP 200, `Content-Type:
text/calendar`, and the current fixture.
5. Replace the subscription URL in Google Calendar, Outlook, and Apple
   Calendar with the new URL. Each provider must subscribe successfully and
   display the fixture again.
6. Confirm that the old subscription stops receiving updates after its
   provider refreshes. Remove the old subscription if the provider leaves a
   stale entry behind.

## Release evidence

Record only pass/fail results and timestamps:

| Check                                                           | Google Calendar | Outlook | Apple Calendar |
| --------------------------------------------------------------- | --------------- | ------- | -------------- |
| Initial booking and three-day blocked range                     |                 |         |                |
| Updated booking and extended blocked range after normal refresh |                 |         |                |
| New URL subscribes successfully                                 |                 |         |                |
| Old URL stops working after reset                               |                 |         |                |
| Observed refresh time                                           |                 |         |                |

If any provider fails, keep the release blocked until the feed response,
subscription URL, or provider-specific behavior is understood and the check
passes again. Delete the test subscriptions and test records after the check.
