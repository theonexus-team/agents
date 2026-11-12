"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { PRODUCTS, money, productBySlug } from "@/lib/content";
import { addToCart, useApp } from "@/lib/store";
import { Scene } from "@/components/Scene";
import { useToast } from "@/components/Providers";
import { Button, btn } from "@/components/ui";

export function ProductDetail({ slug }: { slug: string }) {
  const product = productBySlug(slug)!;
  const app = useApp();
  const toast = useToast();
  const [qty, setQty] = useState(1);
  const inBag = app.cart.find((l) => l.slug === slug)?.qty ?? 0;
  const others = PRODUCTS.filter((p) => p.slug !== slug).slice(0, 4);

  return (
    <div className="pt-4 lg:pt-8">
      <div className="px-4 lg:px-0">
        <Link href="/shop" className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-plum-700 hover:text-plum-900">
          <ArrowLeft className="h-4 w-4" /> Shop
        </Link>
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:gap-10">
        <div className="relative aspect-[4/5] overflow-hidden lg:rounded-[1.75rem] lg:shadow-[var(--shadow-card)]">
          <Scene name={product.scene} label={product.name} />
        </div>
        <div className="px-5 lg:px-0 lg:py-6">
          <p className="eyebrow text-gold-600">{product.category === "Hats" ? "Signature hat" : "Kumihimo necklace"}</p>
          <h1 className="display mt-2 text-[2.4rem] leading-tight text-plum-900 sm:text-5xl">{product.name}</h1>
          <p className="display mt-3 text-3xl text-plum-700">{money(product.price)}</p>
          <p className="mt-5 leading-relaxed text-plum-800/85">{product.description}</p>
          <ul className="mt-5 space-y-2">
            {product.details.map((d) => (
              <li key={d} className="flex items-center gap-2.5 text-sm text-plum-800">
                <Check className="h-4 w-4 text-gold-500" /> {d}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex items-center gap-3">
            <div className="inline-flex h-13 items-center gap-3 rounded-full border border-plum-800/20 bg-ivory-50 px-2">
              <button type="button" aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))} className="rounded-full p-2 hover:bg-plum-800/5">
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-5 text-center tabular-nums" aria-live="polite">
                {qty}
              </span>
              <button type="button" aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(10, q + 1))} className="rounded-full p-2 hover:bg-plum-800/5">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <Button
              size="lg"
              className="flex-1"
              onClick={() => {
                addToCart(product.slug, qty);
                toast(`${qty} × ${product.name} added to your bag`);
                setQty(1);
              }}
            >
              <ShoppingBag className="h-4 w-4" /> Add to Bag{qty > 1 ? ` · ${money(product.price * qty)}` : ""}
            </Button>
          </div>
          {inBag > 0 && (
            <Link href="/bag" className="mt-4 flex items-center justify-between rounded-2xl bg-lavender-100 px-5 py-3.5 text-sm text-plum-800 transition hover:bg-lavender-200">
              <span>{inBag} in your bag</span>
              <span className="eyebrow text-plum-700">View bag →</span>
            </Link>
          )}
          <p className="mt-6 text-xs leading-relaxed text-plum-700/55">
            Name and price reflect the public store. Artwork and description were created for this concept. Checkout is simulated.
          </p>
        </div>
      </div>

      <section className="mt-14 px-4 lg:px-0">
        <h2 className="display mb-4 text-[1.7rem] text-plum-900">You may also love</h2>
        <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {others.map((p) => (
            <li key={p.slug}>
              <Link href={`/shop/${p.slug}`} className="group block">
                <div className="aspect-[4/5] overflow-hidden rounded-2xl shadow-[var(--shadow-card)]">
                  <Scene name={p.scene} className="transition-transform duration-700 group-hover:scale-[1.04]" />
                </div>
                <p className="mt-3 font-serif text-[1.08rem] leading-tight text-plum-900">{p.name}</p>
                <p className="mt-1 text-sm text-plum-700/75">{money(p.price)}</p>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/shop" className={btn("outline", "md", "mt-8")}>
          Back to the collection
        </Link>
      </section>
    </div>
  );
}
