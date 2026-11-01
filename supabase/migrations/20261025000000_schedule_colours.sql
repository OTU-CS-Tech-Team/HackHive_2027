-- Three colour groups on the schedule: blue = sponsors, green = misc (fun, food),
-- honey = HackHive's own events. Admins can still change any of these in /admin.
update public.event_categories set color = 'sky' where name = 'Sponsor workshops';
update public.event_categories set color = 'emerald' where name in ('Fun events', 'Food');
update public.event_categories set color = 'amber' where name in ('HackHive', 'Ceremonies');
