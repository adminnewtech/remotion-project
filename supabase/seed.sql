-- Elite v1 — seed data for local development.
-- Catalog mirrors Newtech (newtechq8.com) real categories. Expand from the live store.

insert into locations (id, name, area, lat, lng) values
  ('00000000-0000-0000-0000-000000000001', 'Newtech Main Warehouse', 'Shuwaikh', 29.3375, 47.9300)
on conflict do nothing;

insert into categories (name_ar, name_en, slug, sort) values
  ('إكسسوارات السيارات', 'Car Accessories', 'car-accessories', 1),
  ('المنزل الذكي', 'Smart Home', 'smart-home', 2),
  ('إلكترونيات حديثة', 'Modern Electronics', 'modern-electronics', 3)
on conflict (slug) do nothing;

-- Sample products (prices in KWD). Replace with a full import from the live store.
with cat as (select id, slug from categories)
insert into products (category_id, name_ar, name_en, brand, slug, requires_installation, installation_fee, warranty_months)
select c.id, p.name_ar, p.name_en, p.brand, p.slug, p.req, p.fee, 12
from (values
  ('car-accessories','AIBOX ULTRA','AIBOX ULTRA','AIBOX ULTRA','AIBOX','aibox', true, 5.000),
  ('car-accessories','AIBOX PLUS','AIBOX PLUS','AIBOX PLUS','AIBOX','aibox-plus', true, 5.000),
  ('smart-home','قفل باب ذكي','Smart Door Lock','Improvid','smart-door-lock', true, 8.000),
  ('smart-home','كاميرا مراقبة','Surveillance Camera','Improvid','surveillance-camera', true, 8.000),
  ('modern-electronics','طابعة حرارية محمولة','Mobile Thermal Printer','Newtech','thermal-printer', false, 0.000)
) as p(cslug, name_ar, name_en, brand, slug, req, fee)
join cat c on c.slug = p.cslug
on conflict (slug) do nothing;
