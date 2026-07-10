/**
 * Seeds demo African creators and products for local development.
 * Requires a connected Supabase project — set NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY (see ENVIRONMENT.md) before running:
 *
 *   npm run seed
 *
 * All demo content is clearly fictional (see section 34 of the product
 * brief) — no real creators, revenue, or reviews are implied.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running the seed script.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

interface DemoCreator {
  email: string;
  displayName: string;
  username: string;
  countryCode: string;
  storeName: string;
  tagline: string;
  category: string;
  products: {
    title: string;
    slug: string;
    shortDescription: string;
    productType: string;
    priceMinor: number;
    currencyCode: string;
    categorySlug: string;
  }[];
}

const DEMO_PASSWORD = "FlowraDemo!2026";

const DEMO_CREATORS: DemoCreator[] = [
  {
    email: "amaka.demo@flowramarket.africa",
    displayName: "Amaka Eze",
    username: "amaka-automations",
    countryCode: "NG",
    storeName: "Amaka Automations",
    tagline: "WhatsApp and AI agents for Nigerian small businesses.",
    category: "AI Agents",
    products: [
      {
        title: "WhatsApp Sales Agent Template",
        slug: "whatsapp-sales-agent-template",
        shortDescription: "A ready-to-configure AI sales agent for WhatsApp Business.",
        productType: "ai_agent",
        priceMinor: 4900,
        currencyCode: "USD",
        categorySlug: "ai-agents",
      },
      {
        title: "AI Prompt Library for African Entrepreneurs",
        slug: "ai-prompt-library-african-entrepreneurs",
        shortDescription: "120 tested prompts for marketing, ops, and customer support.",
        productType: "downloadable_file",
        priceMinor: 1900,
        currencyCode: "USD",
        categorySlug: "prompt-libraries",
      },
    ],
  },
  {
    email: "wanjiru.demo@flowramarket.africa",
    displayName: "Wanjiru Kamau",
    username: "wanjiru-teaches",
    countryCode: "KE",
    storeName: "Wanjiru Teaches",
    tagline: "Practical e-commerce courses for East African founders.",
    category: "Online Courses",
    products: [
      {
        title: "E-commerce Launch Course",
        slug: "ecommerce-launch-course",
        shortDescription: "Launch and ship your first online store in 14 days.",
        productType: "course",
        priceMinor: 9900,
        currencyCode: "USD",
        categorySlug: "online-courses",
      },
      {
        title: "Mobile Money Operations Guide",
        slug: "mobile-money-operations-guide",
        shortDescription: "Running daily operations with M-Pesa and mobile money.",
        productType: "downloadable_file",
        priceMinor: 1200,
        currencyCode: "USD",
        categorySlug: "ebooks-and-guides",
      },
    ],
  },
  {
    email: "kwame.demo@flowramarket.africa",
    displayName: "Kwame Designs",
    username: "kwame-designs",
    countryCode: "GH",
    storeName: "Kwame Designs",
    tagline: "Brand kits and websites for African small businesses.",
    category: "Creative Assets",
    products: [
      {
        title: "Small-Business Branding Kit",
        slug: "small-business-branding-kit",
        shortDescription: "Logo, palette, and social templates in one bundle.",
        productType: "bundle",
        priceMinor: 4900,
        currencyCode: "USD",
        categorySlug: "creative-assets",
      },
      {
        title: "Local Business Website Starter Kit",
        slug: "local-business-website-starter-kit",
        shortDescription: "A ready-to-deploy website template for local businesses.",
        productType: "downloadable_file",
        priceMinor: 3900,
        currencyCode: "USD",
        categorySlug: "websites-and-applications",
      },
    ],
  },
  {
    email: "thandiwe.demo@flowramarket.africa",
    displayName: "Thandiwe Nkosi",
    username: "thandiwe-sound",
    countryCode: "ZA",
    storeName: "Thandiwe Sound",
    tagline: "Afrobeats production samples and sound kits.",
    category: "Creative Assets",
    products: [
      {
        title: "Afrobeats Production Sample Pack",
        slug: "afrobeats-production-sample-pack",
        shortDescription: "120 royalty-free drum loops, one-shots, and vocal chops.",
        productType: "downloadable_file",
        priceMinor: 2900,
        currencyCode: "USD",
        categorySlug: "creative-assets",
      },
    ],
  },
  {
    email: "sara.demo@flowramarket.africa",
    displayName: "Sara Consulting",
    username: "sara-consulting",
    countryCode: "NG",
    storeName: "Sara Consulting",
    tagline: "Pan-African business systems for growing teams.",
    category: "Business Automation",
    products: [
      {
        title: "Contractor Estimating Workflow",
        slug: "contractor-estimating-workflow",
        shortDescription: "A ready automation for quoting and invoicing contract work.",
        productType: "automation_workflow",
        priceMinor: 5900,
        currencyCode: "USD",
        categorySlug: "business-automation",
      },
      {
        title: "Social Media Content Automation Pack",
        slug: "social-media-content-automation-pack",
        shortDescription: "Free starter workflow for scheduling a week of content.",
        productType: "downloadable_file",
        priceMinor: 0,
        currencyCode: "USD",
        categorySlug: "marketing-services",
      },
    ],
  },
];

async function ensureUser(email: string, displayName: string) {
  const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const found = existing?.users.find((u) => u.email === email);
  if (found) return found.id;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error || !data.user) throw new Error(`Failed to create user ${email}: ${error?.message}`);
  return data.user.id;
}

async function seedCreator(demo: DemoCreator) {
  const userId = await ensureUser(demo.email, demo.displayName);

  await supabase
    .from("profiles")
    .update({
      display_name: demo.displayName,
      username: demo.username,
      country_code: demo.countryCode,
      account_purpose: "sell",
      onboarding_step: "completed",
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", userId);

  const { data: existingCreator } = await supabase.from("creator_accounts").select("id").eq("owner_id", userId).maybeSingle();

  const creatorId =
    existingCreator?.id ??
    (
      await supabase
        .from("creator_accounts")
        .insert({ owner_id: userId, business_type: "individual", country_code: demo.countryCode, support_email: demo.email })
        .select("id")
        .single()
    ).data?.id;

  if (!creatorId) throw new Error(`Failed to create creator account for ${demo.email}`);

  await supabase.from("storefronts").upsert(
    {
      creator_id: creatorId,
      slug: demo.username,
      store_name: demo.storeName,
      tagline: demo.tagline,
      category: demo.category,
      description: `${demo.tagline} Demo storefront for FlowraMarket Africa.`,
      is_published: true,
      published_at: new Date().toISOString(),
    },
    { onConflict: "creator_id" },
  );

  await supabase
    .from("seller_verifications")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("creator_id", creatorId);

  for (const product of demo.products) {
    const { data: category } = await supabase.from("product_categories").select("id").eq("slug", product.categorySlug).maybeSingle();

    const { data: existingProduct } = await supabase.from("products").select("id").eq("slug", product.slug).maybeSingle();
    if (existingProduct) continue;

    const { data: created, error } = await supabase
      .from("products")
      .insert({
        creator_id: creatorId,
        category_id: category?.id ?? null,
        slug: product.slug,
        title: product.title,
        short_description: product.shortDescription,
        full_description: `${product.shortDescription} This is demo content for the FlowraMarket Africa MVP — not a real product.`,
        product_type: product.productType,
        status: "published",
        pricing_model: product.priceMinor === 0 ? "free" : "fixed",
        base_price_minor: product.priceMinor,
        currency_code: product.currencyCode,
        published_at: new Date().toISOString(),
        is_marketplace_submitted: true,
        created_by: userId,
      })
      .select("id")
      .single();

    if (error) {
      console.error(`Failed to seed product ${product.slug}:`, error.message);
      continue;
    }
    if (created) {
      await supabase.from("product_submissions").insert({ product_id: created.id, submitted_by: userId, status: "approved" });
    }
  }

  console.log(`Seeded ${demo.storeName} (@${demo.username})`);
}

async function seedBuyer() {
  const userId = await ensureUser("buyer.demo@flowramarket.africa", "Demo Buyer");
  await supabase
    .from("profiles")
    .update({ display_name: "Demo Buyer", username: "demo-buyer", account_purpose: "buy", onboarding_step: "completed" })
    .eq("id", userId);
  console.log("Seeded demo buyer (buyer.demo@flowramarket.africa)");
}

async function main() {
  for (const creator of DEMO_CREATORS) {
    await seedCreator(creator);
  }
  await seedBuyer();

  const adminEmail = process.env.ADMIN_EMAIL_ALLOWLIST?.split(",")[0]?.trim();
  if (adminEmail) {
    const userId = await ensureUser(adminEmail, "Platform Admin");
    await supabase.from("user_roles").upsert({ user_id: userId, role: "super_admin" }, { onConflict: "user_id,role" });
    console.log(`Granted super_admin to ${adminEmail}`);
  } else {
    console.log("Set ADMIN_EMAIL_ALLOWLIST to also seed a super_admin user.");
  }

  console.log(`\nDemo account password for all seeded users: ${DEMO_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
