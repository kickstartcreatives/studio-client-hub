-- Fictional examples used only by the static demo build.
-- Fixed dates keep rebuilds reproducible. No live data is imported.
UPDATE clients SET created_at = '2026-10-01 12:00:00', updated_at = '2026-10-28 12:00:00';
UPDATE projects SET target_launch = '2026-11-18', started_on = '2026-10-01', created_at = '2026-10-01 12:00:00', updated_at = '2026-10-28 12:00:00';
UPDATE updates SET created_at = CASE id WHEN 'update-sunrise-1' THEN '2026-10-28 12:00:00' ELSE '2026-10-23 12:00:00' END;
UPDATE requests SET created_at = '2026-10-27 12:00:00', updated_at = '2026-10-27 12:00:00';

INSERT INTO clients (id, name, business, slug, relationship, engagement, contracted_rate, next_action, status, care_plan, created_at)
VALUES
  ('client-harbor', 'Sam Rivera', 'Harbor Coffee', 'harbor-coffee', 'Active client', 'Website launch', '$3,600 project', 'Approve the seasonal menu', 'active', 'Site care · $95/mo', '2026-09-10 12:00:00'),
  ('client-juniper', 'Alex Brooks', 'Juniper Trail Goods', 'juniper-trail', 'Lead', 'New website', 'Estimate in progress', 'Schedule a discovery call', 'lead', NULL, '2026-10-25 12:00:00');
INSERT INTO users (id, client_id, email, name) VALUES
  ('user-sam', 'client-harbor', 'sam@example.com', 'Sam Rivera'),
  ('user-alex', 'client-juniper', 'alex@example.com', 'Alex Brooks');
INSERT INTO projects (id, client_id, name, type, stage, status, progress, current_focus, target_launch, started_on, created_at) VALUES
  ('project-harbor-site', 'client-harbor', 'Coffee shop website', 'Website', 'Launch prep', 'active', 90, 'The mobile menu is ready. One last content review before launch.', '2026-11-06', '2026-09-10', '2026-09-10 12:00:00');
INSERT INTO agreements (id, client_id, label, amount, cadence, status) VALUES
  ('agreement-harbor-build', 'client-harbor', 'Website build', '$3,600', 'Project', 'active'),
  ('agreement-harbor-care', 'client-harbor', 'Site care', '$95', 'Monthly', 'active');
INSERT INTO updates (id, client_id, body, client_visible, created_at) VALUES
  ('update-harbor-1', 'client-harbor', 'The seasonal menu and opening hours are in place. Please check the prices before we launch.', 1, '2026-10-28 14:00:00'),
  ('update-harbor-2', 'client-harbor', 'Mobile layout is checked. The menu is easy to read without downloading a PDF.', 1, '2026-10-24 12:00:00'),
  ('update-juniper-1', 'client-juniper', 'Discovery call requested. Prepare questions about product photography and the first collection.', 0, '2026-10-26 12:00:00');
INSERT INTO requests (id, client_id, user_id, type, details, urgency, status, created_at, updated_at) VALUES
  ('request-harbor-1', 'client-harbor', 'user-sam', 'content', 'Add the winter drinks to the menu page.', 'soon', 'in_progress', '2026-10-26 12:00:00', '2026-10-28 12:00:00'),
  ('request-harbor-2', 'client-harbor', 'user-sam', 'design', 'Make the opening hours easier to spot on mobile.', 'normal', 'done', '2026-10-20 12:00:00', '2026-10-24 12:00:00');
