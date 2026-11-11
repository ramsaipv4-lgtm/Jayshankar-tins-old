-- Test fixtures: five users (one per role), a vendor pair, three fish, two storage locations.
-- Fixed ids so tests can refer to them.
insert into auth.users (id, email, raw_user_meta_data) values
 ('a0000000-0000-0000-0000-000000000001','admin@t.local',    '{"role":"admin","display_name":"Admin"}'),
 ('a0000000-0000-0000-0000-000000000002','coadmin@t.local',  '{"role":"co-admin","display_name":"CoAdmin"}'),
 ('a0000000-0000-0000-0000-000000000003','rep@t.local',      '{"role":"vendor-rep","display_name":"Rep"}'),
 ('a0000000-0000-0000-0000-000000000004','worker@t.local',   '{"role":"worker","display_name":"Worker"}'),
 ('a0000000-0000-0000-0000-000000000005','super@t.local',    '{"role":"super-worker","display_name":"Super"}');

-- warehouse 'main' and its two transit locations already exist from migration 0006/0031

-- transit locations are provisioned by trigger; add two real ones
insert into public.locations (id, name, display_name, kind, warehouse_id)
select x.id::uuid, x.name, x.dn, x.kind, (select id from public.warehouses where name='main')
from (values
 ('c0000000-0000-0000-0000-000000000001','main-cold','Cold room','storage'),
 ('c0000000-0000-0000-0000-000000000002','main-floor','Display floor','display')) as x(id,name,dn,kind);

insert into public.skus (id, code, english_name, tamil_name, category, size_grade) values
 ('d0000000-0000-0000-0000-000000000001','SELA','Sela Fish','சேலா','fin_fish','mixed'),
 ('d0000000-0000-0000-0000-000000000002','SEER','Seer (Vanjaram)','வஞ்சிரம்','fin_fish','large'),
 ('d0000000-0000-0000-0000-000000000003','CRAB','Blue Crab','நண்டு','crustacean','mixed');

insert into public.vendors (id, name, phone) values
 ('e0000000-0000-0000-0000-000000000001','Annamalai Boat','9000000001'),
 ('e0000000-0000-0000-0000-000000000002','Kumar Traders','9000000002');
