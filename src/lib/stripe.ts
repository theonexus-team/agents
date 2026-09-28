import Stripe from "stripe";

// Lazy singleton, not constructed at module load: Stripe's constructor throws
// immediately if the key is missing, which would otherwise crash `next build`'s
// route-collection step before real secrets are ever set in the environment.
let client: Stripe | undefined;

export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return client;
}
