"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { PRODUCTS, money } from "@/lib/content";
import { addToCart } from "@/lib/store";
import { Scene } from "@/components/Scene";
import { useToast } from "@/components/Providers";
import { Button, PageHeader, btn } from "@/components/ui";

const FILTERS = ["All", "Hats", "Necklaces"] as const;

export default function ShopPage() {
  const toast = useToast();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const hat = PRODUCTS.find((p) => p.featured)!;
  const rest = PRODUCTS.filter((p) => !p.featured && (filter === "All" || p.category === filter));

  return (
    <div>
      <PageHeader eyebrow="The collection" title="Shop A Good Witch." sub="Pieces to carry a little magic with you, wherever you go." />

      {(filter === "All" || filter === "Hats") && (
        <section className="mt-6 px-4 lg:px-0">
          <article className="card overflow-hidden lg:grid lg:grid-cols-[1.1fr_1fr]">
            <Link href={`/shop/${hat.slug}`} className="group relative block h-96 overflow-hidden lg:h-auto lg:min-h-[30rem]">
              <Scene name={hat.scene} className="transition-transform duration-700 group-hover:scale-[1.03]" label={hat.name} />
              <span className="eyebrow absolute top-4 left-4 rounded-full bg-plum-900 px-3 py-1.5 text-gold-300">Signature piece</span>
            </Link>
            <div className="flex flex-col justify-center p-7 sm:p-10">
              <p className="eyebrow text-gold-600">Featured</p>
              <h2 className="display mt-2 text-[2.4rem] leading-tight text-plum-900">{hat.name}</h2>
              <p className="display mt-2 text-3xl text-plum-700">{money(hat.price)}</p>
              <p className="mt-4 leading-relaxed text-plum-700/80">{hat.description}</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  onClick={() => {
                    addToCart(hat.slug);
                    toast(`${hat.name} added to your bag`);
                  }}
                >
                  Add to Bag
                </Button>
                <Link href={`/shop/${hat.slug}`} className={btn("outline", "lg")}>
                  View details <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </article>
        </section>
      )}

      <section className="mt-10 px-4 lg:px-0">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="display text-[1.7rem] text-plum-900">Kumihimo necklaces</h2>
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3.5 py-1.5 text-xs transition ${filter === f ? "bg-plum-800 text-ivory-50" : "text-plum-700 hover:bg-plum-800/5"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        {rest.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {rest.map((p) => (
              <li key={p.slug} className="group">
                <div className="relative overflow-hidden rounded-2xl shadow-[var(--shadow-card)]">
                  <Link href={`/shop/${p.slug}`} className="block aspect-[4/5]" aria-label={p.name}>
                    <Scene name={p.scene} className="transition-transform duration-700 group-hover:scale-[1.04]" />
                  </Link>
                  <button
                    type="button"
                    aria-label={`Add ${p.name} to bag`}
                    onClick={() => {
                      addToCart(p.slug);
                      toast(`${p.name} added to your bag`);
                    }}
                    className="absolute right-2.5 bottom-2.5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-plum-900 text-ivory-50 shadow-lg transition hover:bg-plum-700 active:scale-90"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <Link href={`/shop/${p.slug}`} className="mt-3 block px-0.5">
                  <p className="font-serif text-[1.12rem] leading-tight text-plum-900">{p.name}</p>
                  <p className="mt-1 text-sm text-plum-700/75">{money(p.price)}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-plum-700/70">The signature hat is shown above.</p>
        )}
      </section>

      <p className="mx-auto mt-12 max-w-md px-6 text-center text-xs leading-relaxed text-plum-700/55">
        Product names and prices reflect the publicly visible A Good Witch store. Artwork and descriptions were created for this concept.
        Checkout is simulated: no orders are placed and no payments are taken.
      </p>
    </div>
  );
}
