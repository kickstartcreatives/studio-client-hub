INSERT OR IGNORE INTO clients
  (id, name, business, slug, relationship, engagement, contracted_rate, next_action, status, live_url, care_plan)
VALUES
  ('client-sunrise', 'Maya Chen', 'Sunrise Wellness Co.', 'sunrise-wellness', 'Active client', 'Website redesign', '$4,800 project', 'Review homepage direction', 'active', 'https://example.com', 'Site care · $125/mo');

INSERT OR IGNORE INTO users (id, client_id, email, name)
VALUES ('user-maya', 'client-sunrise', 'maya@example.com', 'Maya Chen');

INSERT OR IGNORE INTO projects
  (id, client_id, name, type, stage, status, progress, current_focus, target_launch, started_on)
VALUES
  ('project-sunrise-site', 'client-sunrise', 'Website redesign', 'Website', 'Visual design', 'active', 56, 'Homepage direction is ready for review.', '2026-09-18', '2026-07-28');

INSERT OR IGNORE INTO agreements (id, client_id, label, amount, cadence, status)
VALUES
  ('agreement-sunrise-build', 'client-sunrise', 'Website redesign', '$4,800', 'Project', 'active'),
  ('agreement-sunrise-care', 'client-sunrise', 'Site care', '$125', 'Monthly', 'active');

INSERT OR IGNORE INTO updates (id, client_id, body, link_url, link_label, client_visible, created_at)
VALUES
  ('update-sunrise-1', 'client-sunrise', 'The homepage direction is ready. I refined the services section and simplified the mobile navigation.', NULL, NULL, 1, datetime('now', '-1 day')),
  ('update-sunrise-2', 'client-sunrise', 'Your copy and brand photography are in place. Next up is the contact flow.', NULL, NULL, 1, datetime('now', '-6 days'));

INSERT OR IGNORE INTO requests
  (id, client_id, user_id, type, details, urgency, status, created_at, updated_at)
VALUES
  ('request-sunrise-1', 'client-sunrise', 'user-maya', 'content', 'Replace the team photo on the About page.', 'normal', 'queued', datetime('now', '-2 days'), datetime('now', '-2 days'));
