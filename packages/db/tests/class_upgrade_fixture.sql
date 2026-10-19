-- Legacy rows created before the class repair migrations.
select set_config('request.jwt.claim.role', 'service_role', false);
select set_config('request.jwt.claim.sub', '', false);
insert into auth.users(id,email) values
('7f000000-0000-0000-0000-000000000001','class-upgrade-one@example.test'),
('7f000000-0000-0000-0000-000000000002','class-upgrade-two@example.test');
insert into public.profiles(id,username,display_name) values
('7f000000-0000-0000-0000-000000000001','class-upgrade-one','Upgrade One'),
('7f000000-0000-0000-0000-000000000002','class-upgrade-two','Upgrade Two');
insert into public.gyms(id,owner_user_id,name,slug) values
('7f000000-0000-0000-0000-000000000010','7f000000-0000-0000-0000-000000000001','Upgrade Gym','class-upgrade-gym');
insert into public.gym_classes(id,gym_id,title,capacity,starts_at,ends_at,booking_opens_at,booking_closes_at,updated_at) values
('7f000000-0000-0000-0000-000000000020','7f000000-0000-0000-0000-000000000010','Valid window',3,
 now()+interval '2 hours',now()+interval '3 hours',now()-interval '1 hour',now()+interval '1 hour','2000-01-01'),
('7f000000-0000-0000-0000-000000000021','7f000000-0000-0000-0000-000000000010','Missing window',3,
 now()+interval '2 hours',now()+interval '3 hours',null,null,'2000-01-01');
insert into public.class_waitlist(class_id,user_id,position) values
('7f000000-0000-0000-0000-000000000020','7f000000-0000-0000-0000-000000000001',5),
('7f000000-0000-0000-0000-000000000020','7f000000-0000-0000-0000-000000000002',6),
('7f000000-0000-0000-0000-000000000021','7f000000-0000-0000-0000-000000000001',1),
('7f000000-0000-0000-0000-000000000021','7f000000-0000-0000-0000-000000000002',1);
