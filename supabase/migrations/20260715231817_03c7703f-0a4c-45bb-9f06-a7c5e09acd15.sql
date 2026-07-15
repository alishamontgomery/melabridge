
DELETE FROM public.ticket_attendees WHERE event_id = '00000000-0000-0000-0000-0000cafe0002';
DELETE FROM public.ticket_orders    WHERE event_id = '00000000-0000-0000-0000-0000cafe0002';
DELETE FROM public.ticket_types     WHERE event_id = '00000000-0000-0000-0000-0000cafe0002';
DELETE FROM public.events           WHERE id       = '00000000-0000-0000-0000-0000cafe0002';
