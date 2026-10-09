export interface Subscriber {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  country: string | null;
  marketingConsent: boolean;
  termsAccepted: boolean;
  acceptedEarlyAccessTermsAt: string;
  referralCode: string;
  referredBy: string | null;
  socialFollowConfirmed: boolean;
  socialLikeConfirmed: boolean;
  socialShareConfirmed: boolean;
  chapter12AccessedAt: string | null;
  chapter12AccessRevoked: boolean;
  unsubscribed: boolean;
  unsubscribedAt: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSubscriberInput {
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  country: string | null;
  marketingConsent: boolean;
  termsAccepted: boolean;
  referredBy: string | null;
  socialFollowConfirmed: boolean;
  socialLikeConfirmed: boolean;
  socialShareConfirmed: boolean;
  source: string | null;
}

export interface SubscriberStatus {
  subscriber: Subscriber;
  referralCount: number;
}
