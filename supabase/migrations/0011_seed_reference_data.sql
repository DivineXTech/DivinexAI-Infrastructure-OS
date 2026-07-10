-- FlowraMarket Africa — 0011: platform reference data (currencies, countries,
-- categories, plans, default fee rule). This is platform configuration, not
-- demo content — safe to apply to every environment including production.

insert into public.currencies (code, name, minor_unit_exponent) values
  ('USD', 'US Dollar', 2),
  ('EUR', 'Euro', 2),
  ('GBP', 'British Pound', 2),
  ('NGN', 'Nigerian Naira', 2),
  ('KES', 'Kenyan Shilling', 2),
  ('GHS', 'Ghanaian Cedi', 2),
  ('ZAR', 'South African Rand', 2),
  ('EGP', 'Egyptian Pound', 2),
  ('XOF', 'West African CFA Franc', 0),
  ('RWF', 'Rwandan Franc', 0)
on conflict (code) do nothing;

insert into public.countries (code, name, default_currency_code, is_launch_market, sort_order) values
  ('NG', 'Nigeria', 'NGN', true, 1),
  ('KE', 'Kenya', 'KES', true, 2),
  ('GH', 'Ghana', 'GHS', true, 3),
  ('ZA', 'South Africa', 'ZAR', true, 4),
  ('EG', 'Egypt', 'EGP', false, 5),
  ('RW', 'Rwanda', 'RWF', false, 6),
  ('UG', 'Uganda', 'USD', false, 7),
  ('TZ', 'Tanzania', 'USD', false, 8),
  ('SN', 'Senegal', 'XOF', false, 9),
  ('CI', 'Cote d''Ivoire', 'XOF', false, 10),
  ('ET', 'Ethiopia', 'USD', false, 11),
  ('MA', 'Morocco', 'USD', false, 12),
  ('US', 'United States', 'USD', false, 90),
  ('GB', 'United Kingdom', 'GBP', false, 91),
  ('CA', 'Canada', 'USD', false, 92)
on conflict (code) do nothing;

insert into public.platform_plans (code, name, description, monthly_price_minor, annual_price_minor, currency_code, max_active_products, default_transaction_fee_bps, features, sort_order) values
  ('starter', 'Starter', 'Free to start. Basic storefront and standard analytics.', 0, 0, 'USD', 5, 900, '["Basic storefront","Standard analytics","Community support"]', 1),
  ('creator_pro', 'Creator Pro', 'More products, advanced analytics, email tools, and lower fees.', 1900, 19000, 'USD', 50, 600, '["Unlimited products","Advanced analytics","Discount codes","AI listing credits"]', 2),
  ('studio', 'Studio', 'Team seats, affiliates, and automation for growing creator businesses.', 4900, 49000, 'USD', null, 400, '["Team members","Affiliate tools","Priority support"]', 3),
  ('enterprise', 'Enterprise', 'White-label marketplace and custom implementation for organizations.', 0, 0, 'USD', null, 0, '["White-label marketplace","API access","Governance controls","Custom fees"]', 4)
on conflict (code) do nothing;

insert into public.platform_fee_rules (name, product_type, country_code, plan_code, percentage_bps, fixed_fee_minor, currency_code) values
  ('Default platform fee', null, null, null, 900, 0, 'USD')
on conflict do nothing;

insert into public.product_categories (slug, name, description, sort_order) values
  ('ai-agents', 'AI Agents', 'Autonomous and semi-autonomous AI agents built for real business tasks.', 1),
  ('websites-and-applications', 'Websites and Applications', 'Ready-to-deploy websites, apps, and starter kits.', 2),
  ('business-templates', 'Business Templates', 'Operational templates for running and scaling a business.', 3),
  ('online-courses', 'Online Courses', 'Structured, self-paced learning products.', 4),
  ('ebooks-and-guides', 'eBooks and Guides', 'Written guides, playbooks, and reference material.', 5),
  ('prompt-libraries', 'Prompt Libraries', 'Curated prompt collections for creative and business use.', 6),
  ('creative-assets', 'Creative Assets', 'Design, audio, video, and photography assets.', 7),
  ('marketing-services', 'Marketing Services', 'Done-for-you and done-with-you marketing offers.', 8),
  ('business-automation', 'Business Automation', 'Workflow automations and integrations.', 9),
  ('industry-operating-systems', 'Industry Operating Systems', 'End-to-end operating systems for a specific industry.', 10)
on conflict (slug) do nothing;

insert into public.platform_settings (key, value, description) values
  ('platform_name', '"FlowraMarket Africa"', 'Public-facing platform name.'),
  ('default_currency', '"USD"', 'Fallback currency when a buyer/seller currency cannot be resolved.'),
  ('support_email', '"support@flowramarket.africa"', 'Primary support contact shown across the platform.')
on conflict (key) do nothing;

insert into public.feature_flags (key, is_enabled, description) values
  ('ai_creator_studio', false, 'AI Creator Studio tools — Phase 3.'),
  ('affiliates', false, 'Creator affiliate programs — Phase 3.'),
  ('courses', false, 'Course product type delivery — Phase 3.'),
  ('memberships', false, 'Membership product type delivery — Phase 3.'),
  ('email_campaigns', false, 'Creator email/subscriber tools — Phase 3.')
on conflict (key) do nothing;
