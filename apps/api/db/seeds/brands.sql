insert into brands (slug, name, description)
values
  ('clean_scapes', 'Clean Scapes', 'Landscape and exterior maintenance brand'),
  ('partners_cc', 'Partners CC', 'Janitorial and facility support brand'),
  ('scout_security', 'Scout Security', 'Security and guarding brand'),
  ('ecs_texas', 'ECS of Texas', 'Exterior cleaning and specialty access brand'),
  ('revival_restoration', 'Revival Restoration', 'Restoration and recovery brand')
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description;
