/**
 * Centralized site configuration for the DivinexAI BookOS Launch Engine.
 *
 * This is the single source of truth for book metadata, brand assets, and
 * social destinations. Every component and route reads from here instead of
 * hardcoding copy or URLs, so a future title (or a new book entirely) can be
 * relaunched by editing this file alone.
 */

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "http://localhost:3000";

export const book = {
  title: "The Billionaire Blueprint 2.0",
  subtitle:
    "The Mindset of Titans of Tomorrow — Build Generational Wealth in the Age of AI & Fintech",
  edition: "Extended Edition",
  author: "Robert L. McCormick",
  authorTitle: "Founder & CEO, Divinex Technology LLC",
  publisher: "Divinex Technology LLC",
  publisherLocation: "Houston, TX",
  description:
    "A strategic guide for builders, founders, creators, and operators who want to move from consumer to owner: AI-enabled wealth creation, infrastructure-first business thinking, and digital assets that work while you don't.",
  earlyAccessChapter: "Chapter 12",
  earlyAccessChapterTitle: "Chapter 12: The Infrastructure Advantage",
} as const;

export const assets = {
  /**
   * Preferred production asset. Replace this file to update the cover
   * everywhere on the site — no component changes required.
   * Recommended format: WebP, sRGB, ~1600px on the long edge.
   */
  coverImage: "/images/billionaire-blueprint-2-cover.png",
  coverImageAlt:
    "The Billionaire Blueprint 2.0, Extended Edition, by Robert L. McCormick — a black and gold hardcover book featuring a glowing digital globe over a city skyline, symbolizing AI-enabled wealth infrastructure.",
  coverWidth: 1024,
  coverHeight: 1536,
  ogImage: "/images/billionaire-blueprint-2-cover.png",
  favicon: "/favicon.ico",
} as const;

export const contact = {
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "hello@divinexai.com",
  fromEmail:
    process.env.RESEND_FROM_EMAIL ??
    "The Billionaire Blueprint <launch@blueprint.divinexai.com>",
} as const;

/**
 * Supporter actions & social destinations. All configurable via environment
 * variables so links can change per-environment without a redeploy of code.
 */
export const social = {
  instagram: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL || "#",
  tiktok: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK_URL || "#",
  youtube: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE_URL || "#",
  facebook: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK_URL || "#",
  linkedin: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN_URL || "#",
  /** The specific launch announcement post visitors are asked to like/comment on. */
  launchPost: process.env.NEXT_PUBLIC_LAUNCH_POST_URL || "#",
  /** The canonical URL supporters are asked to share. */
  shareUrl: process.env.NEXT_PUBLIC_SHARE_URL || siteUrl,
} as const;

export const supporterActions = [
  {
    id: "follow",
    label: "Follow",
    description: "Follow Divinex Technology on Instagram for launch updates.",
    href: social.instagram,
    cta: "Follow on Instagram",
  },
  {
    id: "like",
    label: "Like",
    description: "Like the official launch announcement post.",
    href: social.launchPost,
    cta: "Open the launch post",
  },
  {
    id: "share",
    label: "Share",
    description: "Share the launch with your network.",
    href: social.shareUrl,
    cta: "Share the launch",
  },
] as const;

export type SupporterActionId = (typeof supporterActions)[number]["id"];

export const legal = {
  companyName: "Divinex Technology LLC",
  companyLocation: "Houston, TX",
} as const;
