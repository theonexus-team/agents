"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock, Minus, Plus, Sparkles, Trash2 } from "lucide-react";
import { money, productBySlug } from "@/lib/content";
import { setQty, setState, useApp, useHydrated } from "@/lib/store";
import { Scene } from "@/components/Scene";
import { Button, Empty, PageHeader, Sheet, btn } from "@/components/ui";

export default function BagPage() {
  const app = useApp();
  const hydrated = useHydrated();
  const [checkout, setCheckout] = useState(false);
  const lines = app.cart.map((l) => ({ ...l, product: productBySlug(l.slug)! })).filter((l) => l.product);
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = lines.reduce((n, l) => n + l.qty * l.product.price, 0);

  return (
    <div>
      <PageHeader eyebrow="Shopping bag" title="Your bag" sub={count ? `${count} ${count === 1 ? "item" : "items"} waiting for you.` : undefined} />

      {hydrated && !lines.length ? (
        <div className="mt-6 px-4 lg:px-0">
          <Empty
            title="Your bag is empty"
            body="Find a piece that feels like you: the signature hat or a hand-braided necklace."
            action={
              <Link href="/shop" className={btn("primary", "md")}>
                Shop the collection
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 px-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-0">
          <ul className="space-y-3">
            {lines.map(({ slug, qty, product }) => (
              <li key={slug} className="card flex gap-4 p-3 sm:p-4">
                <Link href={`/shop/${slug}`} className="h-28 w-24 shrink-0 overflow-hidden rounded-xl sm:h-32 sm:w-28">
                  <Scene name={product.scene} />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/shop/${slug}`} className="font-serif text-[1.15rem] leading-tight text-plum-900 hover:text-plum-600">
                      {product.name}
                    </Link>
                    <button type="button" aria-label={`Remove ${product.name}`} onClick={() => setQty(slug, 0)} className="rounded-full p-1.5 text-plum-700/50 hover:bg-plum-800/5 hover:text-plum-900">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-plum-700/70">{money(product.price)} each</p>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="inline-flex items-center gap-3 rounded-full border border-plum-800/15 px-1.5 py-1">
                      <button type="button" aria-label="Decrease quantity" onClick={() => setQty(slug, qty - 1)} className="rounded-full p-1.5 hover:bg-plum-800/5">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-4 text-center text-sm tabular-nums">{qty}</span>
                      <button type="button" aria-label="Increase quantity" onClick={() => setQty(slug, qty + 1)} className="rounded-full p-1.5 hover:bg-plum-800/5">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="font-medium text-plum-900 tabular-nums">{money(product.price * qty)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="card h-fit p-6 lg:sticky lg:top-24">
            <h2 className="display text-2xl text-plum-900">Order summary</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-plum-700/75">Subtotal ({count})</dt>
                <dd className="tabular-nums">{money(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-plum-700/75">Shipping</dt>
                <dd className="text-plum-700/75">Calculated at checkout</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-plum-700/75">Taxes</dt>
                <dd className="text-plum-700/75">Calculated at checkout</dd>
              </div>
              <div className="ornament py-1 text-[0.4rem]">◆</div>
              <div className="flex justify-between text-base">
                <dt className="font-medium text-plum-900">Estimated total</dt>
                <dd className="display text-2xl text-plum-900 tabular-nums">{money(subtotal)}</dd>
              </div>
            </dl>
            <Button size="lg" className="mt-6 w-full" onClick={() => setCheckout(true)} disabled={!lines.length}>
              <Lock className="h-4 w-4" /> Checkout
            </Button>
            <Link href="/shop" className={btn("ghost", "md", "mt-2 w-full")}>
              Continue shopping
            </Link>
            <p className="mt-3 text-center text-[0.68rem] text-plum-700/55">Simulated checkout. No payment is processed.</p>
          </aside>
        </div>
      )}

      <Sheet open={checkout} onClose={() => setCheckout(false)} eyebrow="Checkout demonstration" title="This is where checkout would begin">
        <div className="-mx-6 h-40 overflow-hidden sm:mx-0 sm:rounded-2xl">
          <Scene name="candles" />
        </div>
        <p className="mt-5 leading-relaxed text-plum-800/85">
          In a live app, this step would hand off to the store&apos;s existing secure checkout. In this prototype, no order has been placed and no
          payment details are collected.
        </p>
        <div className="mt-5 rounded-2xl bg-lavender-100/70 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-plum-700/80">Items</span>
            <span>{count}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-plum-700/80">Estimated total</span>
            <span className="font-medium">{money(subtotal)}</span>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => setCheckout(false)}>
            <Sparkles className="h-4 w-4" /> Keep my bag
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setState({ cart: [] });
              setCheckout(false);
            }}
          >
            Clear bag and finish demo
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
