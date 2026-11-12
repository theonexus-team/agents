/**
 * Demonstration content for the A Good Witch concept prototype.
 *
 * Everything in this file is SAMPLE content written for the concept:
 * affirmations, prompts, members, posts, events and the creator messages.
 * Product names and prices and the private reading offer come from the
 * publicly visible store; their descriptions here were written for the concept.
 */
import type { SceneName } from "@/components/Scene";

export const BRAND = {
  name: "A Good Witch",
  tagline: "Your daily magic. Your community. Your journey.",
  creator: "Shelley",
  disclaimer:
    "An independent concept prototype inspired by the publicly visible A Good Witch brand. Not an official product or an authorized collaboration.",
};

/* ---------------------------------------------------------------- */
/* Daily magic                                                       */
/* ---------------------------------------------------------------- */

export type Affirmation = { id: string; text: string; theme: string };

export const AFFIRMATIONS: Affirmation[] = [
  { id: "a1", text: "I give myself permission to grow, release, and become.", theme: "Becoming" },
  { id: "a2", text: "My softness is not weakness. It is where my magic lives.", theme: "Softness" },
  { id: "a3", text: "I trust the timing of my life, even the parts I cannot see yet.", theme: "Trust" },
  { id: "a4", text: "I am allowed to take up space, exactly as I am today.", theme: "Worthiness" },
  { id: "a5", text: "Every ending I honour makes room for something beautiful.", theme: "Release" },
  { id: "a6", text: "I carry my own light, and I share it without dimming it.", theme: "Light" },
  { id: "a7", text: "I return to myself with kindness, again and again.", theme: "Self-love" },
];

export type Prompt = { id: string; text: string };

export const REFLECTION_PROMPTS: Prompt[] = [
  { id: "p1", text: "What is one thing you are ready to let go of today?" },
  { id: "p2", text: "What part of yourself deserves more love and attention today?" },
  { id: "p3", text: "Where did you feel most like yourself this week?" },
  { id: "p4", text: "What small ritual brings you back to calm?" },
  { id: "p5", text: "What are you quietly proud of that no one else knows about?" },
  { id: "p6", text: "Which season of your life are you in right now, and what does it ask of you?" },
  { id: "p7", text: "What would you tell the version of you from one year ago?" },
];

export const DAILY_MESSAGES: string[] = [
  "You don't have to have it all figured out to move forward. Light a candle, take a breath, and take the next small step. That is magic too.",
  "Rest is part of the spell. Give yourself the same patience you'd give a seed in the dark soil.",
  "Notice what made you smile today and hold onto it a little longer than usual.",
  "Some days the magic is loud. Most days it is quiet: a cup of tea, a kind word, a deep breath.",
  "What you release today is not lost. It becomes room for what is meant for you.",
  "Your intuition has been speaking softly. Today, make a little space to listen.",
  "Celebrate how far you've come, not only how far you have to go.",
];

export const RELEASE_CATEGORIES = [
  "Self-doubt",
  "Fear",
  "Resentment",
  "Negative habits",
  "Old expectations",
  "Something else",
] as const;

export const INTENTION_ENERGIES = [
  "Calm",
  "Courage",
  "Joy",
  "Softness",
  "Focus",
  "Abundance",
  "Gratitude",
  "Play",
] as const;

/** Day-of-year index so the "today" content rotates every 24 hours. */
export function dayIndex(date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

export function todaysMagic(date = new Date()) {
  const i = dayIndex(date);
  return {
    affirmation: AFFIRMATIONS[i % AFFIRMATIONS.length],
    prompt: REFLECTION_PROMPTS[i % REFLECTION_PROMPTS.length],
    message: DAILY_MESSAGES[i % DAILY_MESSAGES.length],
    scene: (["hat", "moon", "candles", "botanical", "tarot", "moon", "candles"] as SceneName[])[i % 7],
  };
}

/** Approximate moon phase (good enough for a daily ritual widget). */
export function moonPhase(date = new Date()) {
  const synodic = 29.530588853;
  const known = Date.UTC(2000, 0, 6, 18, 14);
  const age = ((((date.getTime() - known) / 86_400_000) % synodic) + synodic) % synodic;
  const names = [
    "New Moon",
    "Waxing Crescent",
    "First Quarter",
    "Waxing Gibbous",
    "Full Moon",
    "Waning Gibbous",
    "Last Quarter",
    "Waning Crescent",
  ];
  const idx = Math.floor(((age + synodic / 16) / synodic) * 8) % 8;
  const notes = [
    "A quiet beginning. Plant one small intention.",
    "Gentle momentum. Nurture what you started.",
    "A moment to choose. Act on one thing.",
    "Refine and prepare. You're almost there.",
    "Full light. Celebrate, then release.",
    "Share what you've learned. Give thanks.",
    "Clear space. Let go of what's heavy.",
    "Rest and reflect before the next cycle.",
  ];
  return { name: names[idx], note: notes[idx], age, illumination: (1 - Math.cos((2 * Math.PI * age) / synodic)) / 2 };
}

/* ---------------------------------------------------------------- */
/* Featured content (sample creator content)                         */
/* ---------------------------------------------------------------- */

export type Feature = {
  id: string;
  kind: "Video" | "Message" | "Ritual" | "Guide";
  title: string;
  blurb: string;
  duration: string;
  scene: SceneName;
  transcript: string[];
};

export const FEATURES: Feature[] = [
  {
    id: "f1",
    kind: "Video",
    title: "A little magic for your Monday",
    blurb: "A two-minute morning message about starting the week softly.",
    duration: "2:14",
    scene: "candles",
    transcript: [
      "Good morning, witches. Grab your coffee, your tea, whatever feels good.",
      "This week I want you to try one thing: before you reach for your phone, put a hand on your heart and say one kind thing to yourself.",
      "That's it. That's the spell. Let's see what it opens up for you.",
    ],
  },
  {
    id: "f2",
    kind: "Ritual",
    title: "A five-minute full moon release",
    blurb: "Write it down, read it aloud, and let it go.",
    duration: "5:02",
    scene: "moon",
    transcript: [
      "Find a quiet corner and something to write with.",
      "Write down one thing you're ready to release, then read it aloud, slowly.",
      "Fold the paper and set it aside. You've named it, and naming it is the first step.",
    ],
  },
  {
    id: "f3",
    kind: "Guide",
    title: "Pulling a card for the day",
    blurb: "A simple, beginner-friendly way to start a daily tarot practice.",
    duration: "3:40",
    scene: "tarot",
    transcript: [
      "Shuffle while you think about your day, not a big question, just today.",
      "Pull one card and notice your first feeling before you look anything up.",
      "Write that feeling down. Over time your notes become your own guidebook.",
    ],
  },
  {
    id: "f4",
    kind: "Message",
    title: "On growing at your own pace",
    blurb: "A note for anyone feeling behind.",
    duration: "1:48",
    scene: "botanical",
    transcript: [
      "Flowers don't bloom on a schedule someone else made.",
      "If you're in a quiet season right now, it doesn't mean nothing is happening.",
      "Roots grow in the dark. Be gentle with yourself.",
    ],
  },
];

/* ---------------------------------------------------------------- */
/* Community (fictional members and posts)                           */
/* ---------------------------------------------------------------- */

export type Member = { id: string; name: string; handle: string; location: string; hue: number; since: string };

export const MEMBERS: Member[] = [
  { id: "m1", name: "Rowan M.", handle: "rowan.reads.runes", location: "Portland, OR", hue: 280, since: "2024" },
  { id: "m2", name: "Celeste A.", handle: "celestial.celeste", location: "Austin, TX", hue: 320, since: "2023" },
  { id: "m3", name: "Juniper K.", handle: "juniper.and.sage", location: "Asheville, NC", hue: 140, since: "2025" },
  { id: "m4", name: "Marisol V.", handle: "marisol.moonlit", location: "San Diego, CA", hue: 30, since: "2024" },
  { id: "m5", name: "Imogen T.", handle: "imogen.in.bloom", location: "Toronto, ON", hue: 210, since: "2025" },
];

export type PostTopic = "Gratitude" | "Releasing" | "Beautiful moments" | "Intentions";

export type Post = {
  id: string;
  memberId: string;
  topic: PostTopic;
  prompt: string;
  body: string;
  ago: string;
  likes: number;
  scene?: SceneName;
  comments: { id: string; memberId: string; body: string }[];
};

export const POSTS: Post[] = [
  {
    id: "post1",
    memberId: "m2",
    topic: "Gratitude",
    prompt: "What are you grateful for today?",
    body: "My little sister called just to say she missed me. I've been carrying that warm feeling around all afternoon. Grateful for the people who reach out first.",
    ago: "2h",
    likes: 214,
    comments: [
      { id: "c1", memberId: "m4", body: "This made me want to call my sister right now. 💜" },
      { id: "c2", memberId: "m1", body: "Those calls are the real magic." },
    ],
  },
  {
    id: "post2",
    memberId: "m1",
    topic: "Releasing",
    prompt: "What is one thing you're working on releasing?",
    body: "The need to reply to every message instantly. I'm practicing letting my phone sit face down during my evening tea. Day four and I feel lighter already.",
    ago: "4h",
    likes: 187,
    comments: [{ id: "c3", memberId: "m5", body: "Face-down phone club! It changed my evenings." }],
  },
  {
    id: "post3",
    memberId: "m3",
    topic: "Beautiful moments",
    prompt: "Share something beautiful that happened this week.",
    body: "The lavender I planted in spring finally bloomed by the kitchen window. I cut a small bundle and hung it to dry over the doorway. The whole house smells like a dream.",
    ago: "6h",
    likes: 342,
    scene: "botanical",
    comments: [
      { id: "c4", memberId: "m2", body: "Dried lavender over the door is such a lovely ritual." },
      { id: "c5", memberId: "m4", body: "Please share how you dry it!" },
    ],
  },
  {
    id: "post4",
    memberId: "m4",
    topic: "Intentions",
    prompt: "What energy are you bringing into today?",
    body: "Courage. I have a hard conversation at work this afternoon and I'm wearing my favourite necklace as a little reminder that I can be kind and clear at the same time.",
    ago: "9h",
    likes: 129,
    comments: [{ id: "c6", memberId: "m3", body: "Sending you all the courage. You've got this." }],
  },
  {
    id: "post5",
    memberId: "m5",
    topic: "Gratitude",
    prompt: "What are you grateful for today?",
    body: "Pulled the Star card this morning right after a rough week. I'm taking it as a sign to keep going. Grateful for this space where I can say that out loud. 🌙",
    ago: "1d",
    likes: 256,
    scene: "tarot",
    comments: [],
  },
];

export const DAILY_DISCUSSION = {
  prompt: "What is one small ritual that brings you back to yourself?",
  context: "Today's coven conversation. Share yours and read how others find their calm.",
  replies: 1284,
};

export const SPOTLIGHT = {
  memberId: "m3",
  title: "Member spotlight",
  quote:
    "I joined to learn tarot and stayed for the people. This coven taught me that being gentle with myself is a practice, not a personality trait.",
  details: ["Hosts a weekly gratitude thread", "Favourite card: The Empress", "Grows her own herbs"],
};

export type Announcement = { id: string; title: string; body: string; date: string };

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "an1",
    title: "A new daily message every morning",
    body: "Starting this week, a short message from Shelley will be waiting on your Home screen each morning.",
    date: "Sample · This week",
  },
  {
    id: "an2",
    title: "Full moon circle sign-ups are open",
    body: "Save your spot in the virtual release circle from the Events tab.",
    date: "Sample · 2 days ago",
  },
];

/* ---------------------------------------------------------------- */
/* Events (fictional)                                                */
/* ---------------------------------------------------------------- */

export type GatheringEvent = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  virtual: boolean;
  description: string;
  details: string[];
  scene: SceneName;
  spots: number;
};

export const EVENTS: GatheringEvent[] = [
  {
    id: "e1",
    title: "Full Moon Release Circle",
    date: "Sample date · Thursday evening",
    time: "7:00 PM (your local time)",
    location: "Virtual gathering",
    virtual: true,
    description:
      "Gather online under the full moon for a guided release ritual, a few quiet minutes of journaling, and a group intention to close.",
    details: ["Guided release meditation", "Journaling prompts to keep", "Bring a candle and a piece of paper"],
    scene: "moon",
    spots: 48,
  },
  {
    id: "e2",
    title: "Candles & Intentions Evening",
    date: "Sample date · Saturday",
    time: "6:30 PM",
    location: "In person · Sample city studio",
    virtual: false,
    description:
      "An intimate in-person evening of candle dressing, intention setting, and meeting fellow coven members over tea.",
    details: ["All materials provided", "Light refreshments", "Small group, 20 guests"],
    scene: "candles",
    spots: 12,
  },
  {
    id: "e3",
    title: "Tarot for Beginners Workshop",
    date: "Sample date · Sunday afternoon",
    time: "2:00 PM (your local time)",
    location: "Virtual workshop",
    virtual: true,
    description:
      "Learn the basics of reading for yourself: card meanings, simple spreads, and how to trust your own interpretation.",
    details: ["Beginner friendly", "Printable spread guide", "Live Q&A"],
    scene: "tarot",
    spots: 96,
  },
];

/* ---------------------------------------------------------------- */
/* Readings (based on the publicly visible offer)                    */
/* ---------------------------------------------------------------- */

export const READING = {
  id: "private-1-1",
  title: "Private 1:1 Tarot Reading",
  price: 149,
  description:
    "A personal reading experience designed to give you space to explore your questions, reflect, and gain perspective.",
  includes: [
    "One-on-one time focused entirely on you",
    "Space to bring the questions on your heart",
    "Reflection and perspective to take with you",
  ],
};

export const READING_TIMES = ["Morning", "Midday", "Afternoon", "Evening"];

/* ---------------------------------------------------------------- */
/* Shop (names and prices from the public store)                     */
/* ---------------------------------------------------------------- */

export type Product = {
  slug: string;
  name: string;
  price: number;
  short: string;
  description: string;
  details: string[];
  scene: SceneName;
  featured?: boolean;
  category: "Hats" | "Necklaces";
};

export const PRODUCTS: Product[] = [
  {
    slug: "magnetic-stash-hat",
    name: "The Magnetic Stash Hat",
    price: 59,
    short: "The signature purple witch hat, with a hidden magnetic stash.",
    description:
      "A soft, structured purple witch hat with a little secret: a magnetic stash pocket tucked into the crown for the small things you want to keep close. Wear it to a gathering, a full moon walk, or simply because it makes you feel magical.",
    details: ["Signature deep purple", "Hidden magnetic pocket", "Structured brim that holds its shape"],
    scene: "stash-hat",
    featured: true,
    category: "Hats",
  },
  {
    slug: "red-blue-spiral-kumihimo-necklace",
    name: "Red & Blue Spiral Kumihimo Necklace",
    price: 110,
    short: "A hand-braided cord in red and blue with a spiral pendant.",
    description:
      "Kumihimo is a traditional Japanese braiding technique. Here, red and blue threads twist together into a cord that frames a spiral pendant, a reminder that growth moves in circles.",
    details: ["Hand-braided kumihimo cord", "Spiral pendant", "Red and blue palette"],
    scene: "necklace-spiral",
    category: "Necklaces",
  },
  {
    slug: "silver-fish-kumihimo-necklace",
    name: "Silver Fish Kumihimo Necklace",
    price: 149,
    short: "A silver fish pendant on a deep-toned braided cord.",
    description:
      "A silver fish pendant swims along a deep-toned braided kumihimo cord. A piece for going with the flow and trusting where the current takes you.",
    details: ["Hand-braided kumihimo cord", "Silver-tone fish pendant", "Deep ocean tones"],
    scene: "necklace-fish",
    category: "Necklaces",
  },
  {
    slug: "burgundy-thorn-kumihimo-necklace",
    name: "Burgundy Thorn Kumihimo Necklace",
    price: 149,
    short: "Rich burgundy braiding with a thorn pendant.",
    description:
      "Rich burgundy braiding and a delicate thorn pendant: soft and strong at the same time, the way protection should feel.",
    details: ["Hand-braided kumihimo cord", "Thorn pendant", "Burgundy and wine tones"],
    scene: "necklace-thorn",
    category: "Necklaces",
  },
  {
    slug: "copper-leaf-kumihimo-necklace",
    name: "Copper Leaf Kumihimo Necklace",
    price: 129,
    short: "Earthy braiding with a warm copper leaf.",
    description:
      "Earthy, autumnal braiding finished with a warm copper leaf pendant. For grounding, gratitude, and every season of change.",
    details: ["Hand-braided kumihimo cord", "Copper-tone leaf pendant", "Earthy autumn palette"],
    scene: "necklace-leaf",
    category: "Necklaces",
  },
];

export function productBySlug(slug: string) {
  return PRODUCTS.find((p) => p.slug === slug);
}

export const MEMBERSHIP_FEATURES = [
  { title: "Exclusive content", body: "Daily messages, rituals and videos from Shelley, made for the coven." },
  { title: "Community discussions", body: "Daily prompts and gentle conversation with people who get it." },
  { title: "Event announcements", body: "Be first to hear about circles, workshops and gatherings." },
  { title: "Special merchandise offers", body: "Early looks at new pieces and member-only drops." },
  { title: "Member updates", body: "Behind-the-scenes notes and news from inside A Good Witch." },
  { title: "Community experiences", body: "Shared rituals, challenges and moments to celebrate together." },
];

export const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
