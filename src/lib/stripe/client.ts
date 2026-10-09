import "server-only";
import Stripe from "stripe";
import { env, isStripeConfigured } from "@/lib/env";

let cachedClient: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  if (!isStripeConfigured()) return null;
  if (!cachedClient) {
    cachedClient = new Stripe(env.stripeSecretKey!);
  }
  return cachedClient;
}
