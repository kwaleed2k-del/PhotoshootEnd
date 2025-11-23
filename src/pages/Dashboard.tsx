import React, { useEffect, useMemo, useState } from 'react';
import {
  Wand2,
  Shirt,
  Package,
  ImagePlus,
  User,
  BadgeDollarSign,
  Sparkles,
  Palette,
  Rocket,
} from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { Sidebar } from '../components/dashboard/Sidebar';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { PLAN_DETAILS } from '../../services/permissionsService';

// Lenci color accents
const brandViolet = 'rgba(139,92,246,0.35)'; // violet-500 @ 35%
const brandPink = 'rgba(236,72,153,0.25)';  // pink-500 @ 25%
const brandEmerald = 'rgba(16,185,129,0.25)'; // emerald-500 @ 25%

const UNSPLASH_PARAMS = '?auto=format&fit=crop&w=1200&q=80&ixlib=rb-4.0.3';
const withUnsplashParams = (url: string) => `${url}${UNSPLASH_PARAMS}`;

const modelImages: string[] = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb', // Modern fashion model
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1', // Contemporary style
  'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df', // High fashion editorial
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce', // Street style model
  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e', // Modern portrait
  'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f', // Fashion forward
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330', // Contemporary beauty
  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91', // Modern editorial
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab', // High fashion
  'https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d', // Streetwear style
  'https://images.unsplash.com/photo-1517841905240-472988babdf9', // Modern lifestyle
  'https://images.unsplash.com/photo-1475688621402-4257b7f1c32c', // Contemporary fashion
].map(withUnsplashParams);

const productImages: string[] = [
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30', // Modern watch
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f', // Contemporary sunglasses
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e', // Luxury headphones
  'https://images.unsplash.com/photo-1560343090-f0409e92791a', // Modern tech product
  'https://images.unsplash.com/photo-1491553895911-0055eca6402d', // High-end product
  'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd', // Contemporary design
  'https://images.unsplash.com/photo-1585386959984-a4155224a1ad', // Modern lifestyle
  'https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb', // Premium product
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30', // Modern watch
  'https://images.unsplash.com/photo-1572635196237-14b3f281503f', // Contemporary
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e', // Luxury
  'https://images.unsplash.com/photo-1560343090-f0409e92791a', // Electronics
].map(withUnsplashParams);

const cinematicImages: string[] = [
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce',
  'https://images.unsplash.com/photo-1508672019048-805c876b67e2',
  'https://images.unsplash.com/photo-1521572267360-ee0c2909d518',
  'https://images.unsplash.com/photo-1524505880432-af5299ff7c31',
  'https://images.unsplash.com/photo-1524253482453-3fed8d2fe12b',
  'https://images.unsplash.com/photo-1520975916090-3105956dac38',
  'https://images.unsplash.com/photo-1475688621402-4257b7f1c32c',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
  'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb',
  'https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d',
  'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1',
].map(withUnsplashParams);

const DEFAULT_FALLBACK_IMAGE = withUnsplashParams('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee');

type FallbackType = 'model' | 'product' | 'cinematic' | 'default';

const FALLBACK_IMAGES: Record<FallbackType, string> = {
  model: modelImages[1],
  product: productImages[1],
  cinematic: cinematicImages[1],
  default: DEFAULT_FALLBACK_IMAGE,
};

const telemetryBars = [
  {
    label: 'Lighting sync',
    value: 'Live',
    color: 'bg-fuchsia-400',
    min: 35,
    max: 88,
  },
  {
    label: 'Camera drift',
    value: 'Stable',
    color: 'bg-cyan-400',
    min: 25,
    max: 72,
  },
  {
    label: 'Director prompts',
    value: 'Queued',
    color: 'bg-amber-300',
    min: 45,
    max: 96,
  },
] as const;

const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
  const target = event.currentTarget;
  if (target.dataset.fallbackApplied) return;
  target.dataset.fallbackApplied = 'true';
  const fallbackType = (target.dataset.fallbackType as FallbackType) || 'default';
  target.src = FALLBACK_IMAGES[fallbackType] ?? DEFAULT_FALLBACK_IMAGE;
};

const heroCollections = [
  {
    title: 'Luminous Editorial Sets',
    description: 'Layer stylized lighting, fabrics, and art direction for runway-ready drops.',
    tag: 'Apparel Studio',
    stat: 'Realtime creative sync',
    palette: 'from-fuchsia-500/60 via-violet-500/30 to-sky-500/20',
    href: '/studio/apparel',
    image: modelImages[0],
    fallbackType: 'model' as FallbackType,
  },
  {
    title: 'Zero-Gravity Product Labs',
    description: 'Give gadgets and beauty lines cinematic float, reflections, and glow.',
    tag: 'Product Studio',
    stat: 'Motion-ready staging',
    palette: 'from-cyan-400/60 via-emerald-500/25 to-amber-400/25',
    href: '/studio/product',
    image: productImages[2],
    fallbackType: 'product' as FallbackType,
  },
];

const calloutCards = [
  {
    title: 'Trending looks',
    description: 'New seasonal presets curated nightly.',
    icon: <Rocket size={16} />,
    href: '/discover#looks',
    thumb: modelImages[0],
    fallbackType: 'model' as FallbackType,
    accent: 'from-fuchsia-500/30 to-purple-500/20',
  },
  {
    title: 'Palette remix',
    description: 'Auto-match brand palettes + Pantone.',
    icon: <Palette size={16} />,
    href: '/studio/apparel',
    thumb: modelImages[5],
    fallbackType: 'model' as FallbackType,
    accent: 'from-emerald-400/30 to-cyan-500/20',
  },
  {
    title: 'AI Director Tips',
    description: 'Micro-plays for lighting, camera, and styling.',
    icon: <Sparkles size={16} />,
    href: '/guides',
    thumb: cinematicImages[1],
    fallbackType: 'cinematic' as FallbackType,
    accent: 'from-amber-400/30 to-rose-500/20',
  },
];

const featuredInspiration = [
  modelImages[2],
  modelImages[7],
  modelImages[9],
];

const creativeRollups = [
  {
    title: 'Style accuracy',
    value: '99.2%',
    delta: '+1.4%',
    context: 'Model looks matching the brief',
    accent: 'from-fuchsia-500/30 via-purple-500/10 to-transparent',
    track: 'bg-fuchsia-500/40',
    markers: [42, 68, 85, 73, 91],
  },
  {
    title: 'Product realism',
    value: '98.1%',
    delta: '+0.7%',
    context: 'Physical product geometry preserved',
    accent: 'from-cyan-500/30 via-blue-500/10 to-transparent',
    track: 'bg-cyan-500/40',
    markers: [38, 56, 64, 78, 88],
  },
  {
    title: 'Lighting continuity',
    value: '96.4%',
    delta: '+2.2%',
    context: 'Scene-to-scene lighting alignment',
    accent: 'from-amber-400/30 via-orange-500/10 to-transparent',
    track: 'bg-amber-400/40',
    markers: [60, 74, 69, 82, 95],
  },
];

const storyPanels = [
  {
    title: 'Desert Bloom',
    subtitle: 'Runway resortwear',
    image: cinematicImages[0],
    tags: ['Copper dusk', '70mm lens', 'Warm haze'],
    fallbackType: 'cinematic' as FallbackType,
  },
  {
    title: 'Midnight Lab',
    subtitle: 'Futurist product stack',
    image: productImages[3],
    tags: ['Neon grid', 'Acrylic reflections', 'Low-key'],
    fallbackType: 'product' as FallbackType,
  },
  {
    title: 'City Pulse',
    subtitle: 'Street couture',
    image: modelImages[8],
    tags: ['Concrete bloom', 'Cool chrome', 'Editorial'],
    fallbackType: 'model' as FallbackType,
  },
];

const howItWorksTracks = [
  {
    title: 'Apparel Studio Flow',
    badge: 'Face-safe try-on',
    icon: <Shirt size={20} />,
    accent: 'from-fuchsia-500/40 via-purple-500/20 to-transparent',
    glow: 'bg-fuchsia-500/20',
    cta: { label: 'Launch Apparel Studio', href: '/studio/apparel', color: 'from-fuchsia-500 to-purple-500' },
    steps: [
      {
        label: 'Upload model & garment',
        detail: 'Preserve identity with face-locked try-on and auto garment detection.',
      },
      {
        label: 'Direct the scene',
        detail: 'Pick backgrounds, tweak lighting, and dial poses like a live set.',
      },
      {
        label: 'Generate + export',
        detail: 'Batch render looks, apply overlays, and send to commerce in seconds.',
      },
    ],
  },
  {
    title: 'Product Studio Flow',
    badge: 'Physics-aware',
    icon: <Package size={20} />,
    accent: 'from-cyan-500/40 via-blue-500/20 to-transparent',
    glow: 'bg-cyan-500/20',
    cta: { label: 'Launch Product Studio', href: '/studio/product', color: 'from-cyan-500 to-emerald-500' },
    steps: [
      {
        label: 'Drop in your product',
        detail: 'AI isolates geometry, reflections, and surface detail automatically.',
      },
      {
        label: 'Choose a mood',
        detail: 'Blend props, surfaces, and camera moves for cinematic hero shots.',
      },
      {
        label: 'Ship ready packs',
        detail: 'Output multi-angle sets, tweak shadows, and export with brand logos.',
      },
    ],
  },
];

type HeroCollection = (typeof heroCollections)[number];
type CalloutCard = (typeof calloutCards)[number];
type CreativeRollup = (typeof creativeRollups)[number];
type StoryPanel = (typeof storyPanels)[number];

export default function Dashboard() {
  const [username, setUsername] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [activeHero, setActiveHero] = useState(0);
  const { user } = useAuth();

  // DB-backed account info
  const [dbPlan, setDbPlan] = useState<string | null>(null);
  const [dbCredits, setDbCredits] = useState<number | null>(null);
  const [showTour, setShowTour] = useState(false);

  const planInfo = useMemo(() => {
    if (!user) return null;
    return PLAN_DETAILS[user.plan];
  }, [user]);

  const remainingCredits = useMemo(() => {
    if (dbCredits !== null && !Number.isNaN(dbCredits)) {
      return dbCredits;
    }
    if (!user || !planInfo) return 0;
    return Math.max(planInfo.generations - user.generationsUsed, 0);
  }, [user, planInfo, dbCredits]);

  const isLowCredits = remainingCredits > 0 && remainingCredits < 50;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const metaName = (data?.user?.user_metadata?.username as string) || null;
      setUsername(metaName);
      setAvatar((data?.user?.user_metadata?.avatar_url as string) || null);
      // show welcome once per session
      if (!sessionStorage.getItem('welcomed')) {
        setShowWelcome(true);
        sessionStorage.setItem('welcomed', '1');
      }
      // Load DB plan/credits if available
      const userId = data?.user?.id;
      if (userId) {
        const { data: profile, error } = await supabase
          .from('users')
          .select('subscription_plan, credits_balance')
          .eq('id', userId)
          .single();
        if (!error && profile) {
          setDbPlan((profile as any).subscription_plan ?? null);
          setDbCredits((profile as any).credits_balance ?? null);
        }
      }
    })();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveHero((prev) => (prev + 1) % heroCollections.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const currentHero = heroCollections[activeHero];

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="flex">
        <Sidebar />
        <main className="flex-1">
          <TourModal open={showTour} onClose={() => setShowTour(false)} />
          {/* Decorative brand orbs */}
          <div
            className="pointer-events-none fixed inset-0 -z-10"
            style={{
              background: `
                radial-gradient(800px 400px at 10% 10%, ${brandViolet}, transparent 60%),
                radial-gradient(700px 350px at 90% 15%, ${brandPink}, transparent 60%),
                radial-gradient(900px 450px at 50% 100%, ${brandEmerald}, transparent 60%)
              `,
              filter: 'blur(20px)',
              opacity: 0.8
            }}
            aria-hidden="true"
          />
          <div className="max-w-[1280px] mx-auto px-6 py-6">
            {/* Top bar + hero */}
            <div className="mb-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Wand2 className="text-violet-400" aria-hidden="true" />
                  <span className="text-zinc-300 text-sm">Studio Dashboard</span>
                </div>
                <a
                  href="/account"
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-800"
                  aria-label="Account"
                >
                  <img
                    src={avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=User'}
                    className="w-8 h-8 rounded-full border border-white/10"
                    alt="User avatar"
                  />
                  <span className="text-zinc-300 text-sm hidden sm:inline">{username || 'Your profile'}</span>
                </a>
              </div>
            <HeroSpotlight
                hero={currentHero}
                collections={heroCollections}
                activeIndex={activeHero}
                onSelect={setActiveHero}
              />
            </div>

            <WelcomeHero
              username={username}
              remainingCredits={remainingCredits}
              onStartApparel={() => (window.location.href = '/studio/apparel')}
              onStartProduct={() => (window.location.href = '/studio/product')}
            />

            <CalloutRail cards={calloutCards} />
            <InspirationStrip featured={featuredInspiration} fallbackType="model" />

            {/* Welcome heading */}
            <h1 className="text-xl md:text-2xl font-semibold text-white mb-4">
              {`Welcome back${username ? `, ${username}` : ''} 👋`}
            </h1>

            {/* Quick glance row removed per request */}

            {/* Guides removed per request */}

            {/* Hero quick actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="relative overflow-hidden rounded-2xl border border-white/10 mb-8 bg-zinc-900/60 backdrop-blur"
            >
              <div className="px-6 py-8 md:px-10 md:py-12">
                <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2">
                  The End of the Photoshoot.
                </h1>
                <p className="text-zinc-300 max-w-2xl">
                  Generate world‑class apparel and product shots. Instant results, studio quality.
                </p>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <QuickStartCard
                    iconBg="bg-violet-600/20 text-violet-300"
                    icon={<Shirt size={18} />}
                    title="Create Apparel"
                    href="/studio/apparel"
                    images={modelImages.slice(0, 4)}
                    fallbackType="model"
                  />
                  <QuickStartCard
                    iconBg="bg-emerald-600/20 text-emerald-300"
                    icon={<Package size={18} />}
                    title="Create Product"
                    href="/studio/product"
                    images={productImages.slice(0, 4)}
                    fallbackType="product"
                  />
                </div>
              </div>
            </motion.div>

            {/* Quote strip */}
            <section className="mb-10">
              <motion.div
                initial={{ opacity: 0.8 }}
                animate={{ opacity: 1, backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                className="relative overflow-hidden rounded-3xl border border-white/10 px-6 py-10 md:px-12"
                style={{
                  backgroundImage:
                    'linear-gradient(120deg, rgba(236,72,153,0.25), rgba(14,165,233,0.2), rgba(250,204,21,0.2))',
                  backgroundSize: '200% 200%',
                }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.15),transparent_55%)]" aria-hidden="true" />
                <div className="relative z-10 text-center space-y-4">
                  <p className="text-2xl md:text-4xl font-black text-white tracking-tight leading-snug">
                    Create stunning visuals in seconds. <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-fuchsia-300 to-cyan-200">Make the camera jealous.</span>
                  </p>
                  <p className="text-sm uppercase tracking-[0.35em] text-white/70">Lenci Studio Pulse</p>
                  <div className="flex justify-center gap-3 text-xs text-white/70">
                    <span className="px-3 py-1 rounded-full border border-white/20 backdrop-blur">Live color sync</span>
                    <span className="px-3 py-1 rounded-full border border-white/20 backdrop-blur">Motion presets</span>
                    <span className="px-3 py-1 rounded-full border border-white/20 backdrop-blur">Glare control</span>
                  </div>
                </div>
              </motion.div>
            </section>

            {showWelcome && (
              <div className="mb-6 p-4 rounded-lg border border-white/10 bg-violet-600/10 text-violet-200">
                <div className="flex items-center gap-3">
                  <Wand2 size={18} />
                  <p>
                    {`Welcome${username ? `, ${username}` : ''}!`} We pre‑heated the pixels for you —
                    time to make the camera jealous.
                  </p>
                </div>
              </div>
            )}

            {/* Sections mirroring screenshot */}
            <Section title="Starting points · Fashion Product Shots">
              <ImageGrid images={modelImages.slice(0, 12)} fallbackType="model" />
            </Section>

            <QuoteBreak
              quote="We replaced an entire seasonal shoot with these AI looks before lunch."
              author="Aaliyah Noor"
              role="Fashion Creative Director · Miraluxe"
              accent="from-fuchsia-500/30 via-rose-500/20 to-transparent"
            />

            <Section title="Starting points · Product Shots">
              <ImageGrid images={productImages.slice(0, 12)} fallbackType="product" />
            </Section>

            <QuoteBreak
              quote="Every hero shot feels lit by a real crew — but it’s just me and my laptop."
              author="Diego Martins"
              role="Head of Product Imagery · North Coast Labs"
              accent="from-cyan-500/30 via-blue-500/20 to-transparent"
            />

            <Section title="Inspiration · Cinematic">
              <ImageGrid images={cinematicImages.slice(0, 12)} compact fallbackType="cinematic" />
            </Section>

            <Section title="Creative telemetry index">
              <CreativeInsightGrid items={creativeRollups} />
            </Section>

            <Section title="Graphic moodboards">
              <GraphicStoryPanels panels={storyPanels} />
            </Section>

            <Section title="How it works">
              <HowItWorksShowcase tracks={howItWorksTracks} />
            </Section>
          </div>
        </main>
      </div>
    </div>
  );
}

function HeroSpotlight({
  hero,
  collections,
  activeIndex,
  onSelect,
}: {
  hero: HeroCollection;
  collections: HeroCollection[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/60 backdrop-blur px-6 py-8 md:px-10 md:py-12">
      <motion.div
        className={`absolute inset-0 bg-gradient-to-br ${hero.palette} opacity-70`}
        aria-hidden="true"
        animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        style={{
          backgroundSize: '200% 200%',
        }}
      />
      <motion.img
        key={hero.image}
        src={hero.image}
        alt=""
        aria-hidden="true"
        loading="lazy"
        data-fallback-type={hero.fallbackType}
        onError={handleImageError}
        className="absolute inset-0 hidden md:block w-full h-full object-cover opacity-35"
        initial={{ opacity: 0.2, scale: 1.05 }}
        animate={{ opacity: 0.45, scale: 1 }}
        transition={{ duration: 0.8 }}
      />
      <motion.div
        className="absolute inset-0"
        aria-hidden="true"
        animate={{ rotate: [0, 3, -3, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.2), transparent 45%)',
        }}
      />
      <div className="relative z-10 flex flex-col lg:flex-row gap-10">
        <div className="flex-1">
          <span className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-zinc-200/80 px-3 py-1 rounded-full border border-white/20 bg-black/30">
            <Sparkles size={12} />
            {hero.tag}
          </span>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white mt-4 leading-tight">
            {hero.title}
          </h1>
          <p className="text-zinc-100/80 max-w-xl mt-3 text-base md:text-lg">{hero.description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={hero.href}
              className="px-6 py-3 rounded-2xl bg-white text-zinc-900 font-semibold text-sm shadow-lg shadow-white/20 hover:-translate-y-0.5 transition-transform"
            >
              Launch studio
            </a>
            <button
              onClick={() => onSelect((activeIndex + 1) % collections.length)}
              className="px-6 py-3 rounded-2xl border border-white/20 text-white text-sm hover:bg-white/10 transition-colors"
            >
              Shuffle looks
            </button>
          </div>
        </div>
        <div className="w-full lg:w-64 flex flex-col justify-between gap-4">
          <div className="relative rounded-2xl border border-white/15 bg-black/30 p-4 overflow-hidden">
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5"
              aria-hidden="true"
              animate={{ opacity: [0.2, 0.6, 0.2], backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              style={{ backgroundSize: '180% 180%' }}
            />
            <div className="relative z-10 space-y-3">
              <div className="text-xs uppercase tracking-[0.35em] text-zinc-400">Creative systems</div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-400">Live scene flow</p>
                  <p className="text-3xl font-bold text-white">{hero.stat}</p>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-emerald-300 bg-emerald-500/10 border border-emerald-300/30 px-3 py-1 rounded-full">
                  Synced
                </div>
              </div>
              <div className="space-y-3">
                {telemetryBars.map((bar, index) => (
                  <div key={bar.label} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span>{bar.label}</span>
                      <span className="text-zinc-200">{bar.value}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${bar.color}`}
                        animate={{ width: [`${bar.min}%`, `${bar.max}%`, `${(bar.min + bar.max) / 2}%`] }}
                        transition={{
                          duration: 4 + index,
                          repeat: Infinity,
                          repeatType: 'mirror',
                          ease: 'easeInOut',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {collections.map((_, idx) => (
              <button
                key={idx}
                onClick={() => onSelect(idx)}
                aria-label={`Show hero ${idx + 1}`}
                className={`h-2 flex-1 rounded-full transition-all ${idx === activeIndex ? 'bg-white' : 'bg-white/30'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CalloutRail({ cards }: { cards: CalloutCard[] }) {
  return (
    <div className="mb-6">
      <div className="flex gap-4 overflow-x-auto pb-2">
        {cards.map((card, index) => (
          <motion.a
            key={card.title}
            href={card.href}
            className="group min-w-[260px] rounded-2xl border border-white/10 bg-zinc-900/70 backdrop-blur p-4 flex items-center gap-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-white/10">
              <div className={`absolute inset-0 bg-gradient-to-br ${card.accent}`} />
              <img
                src={card.thumb}
                alt={card.title}
                loading="lazy"
                data-fallback-type={card.fallbackType}
                onError={handleImageError}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <div className="text-white font-semibold flex items-center gap-2">
                {card.icon}
                {card.title}
              </div>
              <p className="text-xs text-zinc-400 mt-1">{card.description}</p>
            </div>
            <ImagePlus className="text-zinc-500 group-hover:text-white transition-colors" size={18} />
          </motion.a>
        ))}
      </div>
    </div>
  );
}

function WelcomeHero({
  username,
  remainingCredits,
  onStartApparel,
  onStartProduct,
}: {
  username: string | null;
  remainingCredits: number;
  onStartApparel: () => void;
  onStartProduct: () => void;
}) {
  const welcomeName = username ? `, ${username}` : '';
  const statusCards = [
    {
      label: 'Apparel queue',
      value: 'Ready',
      color: 'text-emerald-300',
      glow: 'from-emerald-500/25 via-emerald-400/10 to-transparent',
    },
    {
      label: 'Product queue',
      value: 'Ready',
      color: 'text-cyan-300',
      glow: 'from-cyan-500/25 via-cyan-400/10 to-transparent',
    },
    {
      label: 'Identity lock',
      value: 'On',
      color: 'text-fuchsia-300',
      glow: 'from-fuchsia-500/25 via-fuchsia-400/10 to-transparent',
    },
    {
      label: 'AI Director',
      value: 'Online',
      color: 'text-amber-200',
      glow: 'from-amber-500/20 via-amber-400/10 to-transparent',
    },
  ];
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-900/80 via-zinc-900/70 to-cyan-900/60 mb-8"
    >
      <div className="absolute inset-0">
        <motion.div
          className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-fuchsia-500/40 blur-3xl"
          animate={{ scale: [1, 1.1, 0.95, 1], opacity: [0.4, 0.7, 0.5, 0.4] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-cyan-500/30 blur-3xl"
          animate={{ x: [0, 40, -20, 0], opacity: [0.3, 0.6, 0.4, 0.3] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
        <motion.div
          className="absolute inset-0 opacity-40"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15), transparent 45%)' }}
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <div className="relative z-10 px-6 py-8 md:px-10 md:py-12 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-white/70 flex items-center gap-2">
            <span className="inline-flex w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            Welcome orbit
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-white">
            Welcome back{welcomeName}! <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-300 to-cyan-200">Let’s make the camera jealous.</span>
          </h1>
          <p className="text-zinc-200 text-sm md:text-base">
            Credits ready, studios standing by. Launch apparel or product mode to start generating scenes in seconds.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onStartApparel}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white text-zinc-900 font-semibold shadow-xl shadow-white/20 hover:-translate-y-0.5 transition"
            >
              <Shirt size={16} />
              Launch Apparel
            </button>
            <button
              onClick={onStartProduct}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl border border-white/40 text-white hover:bg-white/10 transition"
            >
              <Package size={16} />
              Launch Product
            </button>
          </div>
        </div>
        <div className="bg-black/30 rounded-2xl border border-white/10 p-5 backdrop-blur space-y-3">
          <div className="flex items-center justify-between text-white">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/60">Credits</p>
              <p className="text-3xl font-black">{remainingCredits.toLocaleString()}</p>
            </div>
            <span className="text-[11px] px-3 py-1 rounded-full bg-white/10 border border-white/30">
              Live sync
            </span>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Studio uptime', color: 'bg-emerald-400', width: '92%' },
              { label: 'Generation speed', color: 'bg-fuchsia-400', width: '88%' },
              { label: 'Face lock stability', color: 'bg-cyan-300', width: '97%' },
            ].map((bar) => (
              <div key={bar.label}>
                <div className="flex justify-between text-[11px] text-zinc-300">
                  <span>{bar.label}</span>
                  <span>Live</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <motion.div
                    className={`h-full ${bar.color}`}
                    animate={{ width: [bar.width, '100%', bar.width] }}
                    transition={{ duration: 6, repeat: Infinity, repeatType: 'mirror' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm text-white">
          {statusCards.map((item) => (
            <div key={item.label} className="relative rounded-2xl border border-white/10 bg-black/20 p-4 overflow-hidden backdrop-blur">
              <div className={`absolute inset-0 bg-gradient-to-br ${item.glow}`} aria-hidden="true" />
              <div className="relative z-10 space-y-1">
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/50">{item.label}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-semibold ${item.color}`}>{item.value}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/40 border border-white/20 text-white/70">Live</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function InspirationStrip({
  featured,
  fallbackType = 'default',
}: {
  featured: string[];
  fallbackType?: FallbackType;
}) {
  return (
    <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
      {featured.map((src, idx) => (
        <motion.div
          key={idx}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: idx * 0.05 }}
        >
          <img
            src={src}
            alt="featured inspiration"
            loading="lazy"
            data-fallback-type={fallbackType}
            onError={handleImageError}
            className="w-full h-48 object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs uppercase tracking-widest">
            <span>Inspiration</span>
            <span>#{idx + 1}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function GuideCards({ onStartTour }: { onStartTour: () => void }) {
  const cards = [
    {
      title: 'Take a 90‑second tour',
      desc: 'Learn the basics and create your first look.',
      href: '#tour',
    },
    {
      title: 'Best practices',
      desc: 'Prompts, lighting, and styling tips from pros.',
      href: '#best-practices',
    },
    {
      title: 'Export & deliver',
      desc: 'Upscale, background, and file formats.',
      href: '#export',
    },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
      {cards.map((c, i) => (
        <button
          key={i}
          onClick={() => (c.title.includes('tour') ? onStartTour() : (window.location.hash = c.href))}
          className="text-left rounded-xl border border-white/10 bg-zinc-900/60 hover:bg-zinc-900 transition-colors p-4"
        >
          <div className="text-white font-semibold">{c.title}</div>
          <div className="text-sm text-zinc-400 mt-1">{c.desc}</div>
        </button>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-sm font-medium text-zinc-400 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function QuoteBreak({
  quote,
  author,
  role,
  accent = 'from-fuchsia-500/30 via-purple-500/20 to-transparent',
}: {
  quote: string;
  author: string;
  role: string;
  accent?: string;
}) {
  return (
    <motion.blockquote
      className="mb-10"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70 px-6 py-8 md:px-12">
        <div className={`absolute inset-0 bg-gradient-to-r ${accent} opacity-60`} aria-hidden="true" />
        <div className="absolute inset-y-0 left-0 w-1 bg-white/20" aria-hidden="true" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-white/40 mb-3">
            <span className="w-2 h-2 rounded-full bg-white/70 animate-pulse" />
            Field note
          </div>
          <p className="text-2xl md:text-3xl text-white font-semibold leading-snug italic">“{quote}”</p>
          <div className="mt-4 text-sm text-zinc-300">
            <div className="font-semibold text-white">{author}</div>
            <div className="text-zinc-400">{role}</div>
          </div>
        </div>
        <motion.div
          className="absolute -right-10 bottom-0 w-40 h-40 rounded-full bg-white/5 blur-3xl"
          aria-hidden="true"
          animate={{ scale: [0.8, 1.1, 0.9], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
      </div>
    </motion.blockquote>
  );
}

function ImageGrid({
  images,
  compact = false,
  fallbackType = 'default',
}: {
  images: string[];
  compact?: boolean;
  fallbackType?: FallbackType;
}) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3`}>
      {images.map((src, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10% 0px -10% 0px' }}
          transition={{ delay: i * 0.02, duration: 0.35 }}
          className="overflow-hidden rounded-lg border border-white/5 bg-zinc-900/40"
        >
          <img
            src={src}
            alt="inspiration"
            loading="lazy"
            data-fallback-type={fallbackType}
            onError={handleImageError}
            className={`${compact ? 'h-44 md:h-48' : 'h-56 md:h-64'} w-full object-cover transition-transform duration-500 hover:scale-105`}
          />
        </motion.div>
      ))}
    </div>
  );
}

function CreativeInsightGrid({ items }: { items: CreativeRollup[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.map((item, index) => (
        <motion.div
          key={item.title}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.05 }}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70 p-5"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${item.accent}`} aria-hidden="true" />
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Signal</p>
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
              </div>
              <span className="text-xs px-3 py-1 rounded-full border border-white/10 text-white/70">Live</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-black text-white leading-none">{item.value}</p>
                <p className="text-xs text-emerald-300 mt-1">{item.delta}</p>
              </div>
              <p className="text-xs text-zinc-400 w-28 text-right">{item.context}</p>
            </div>
            <div className="h-16 flex items-end gap-1">
              {item.markers.map((mark, i) => (
                <motion.span
                  key={i}
                  className={`flex-1 rounded-t-full ${item.track}`}
                  style={{ height: `${Math.min(mark, 100)}%` }}
                  animate={{ opacity: [0.4, 1, 0.6] }}
                  transition={{
                    duration: 3 + i,
                    repeat: Infinity,
                    repeatType: 'mirror',
                    delay: i * 0.1,
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function GraphicStoryPanels({ panels }: { panels: StoryPanel[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {panels.map((panel, index) => (
        <motion.div
          key={panel.title}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/60 min-h-[320px]"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.05 }}
        >
          <img
            src={panel.image}
            alt={panel.title}
            loading="lazy"
            data-fallback-type={panel.fallbackType}
            onError={handleImageError}
            className="absolute inset-0 w-full h-full object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="relative z-10 h-full flex flex-col justify-end p-6 space-y-3">
            <div className="text-xs uppercase tracking-[0.4em] text-white/60">Moodboard</div>
            <h3 className="text-2xl font-bold text-white">{panel.title}</h3>
            <p className="text-sm text-zinc-200">{panel.subtitle}</p>
            <div className="flex flex-wrap gap-2">
              {panel.tags.map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs text-white/80">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function HowItWorksShowcase({ tracks }: { tracks: typeof howItWorksTracks }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {tracks.map((track, index) => (
        <motion.div
          key={track.title}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/70 p-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.05 }}
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${track.accent}`} aria-hidden="true" />
          <div className="absolute inset-0 opacity-60 mix-blend-screen" aria-hidden="true">
            <div className={`absolute -top-16 right-0 w-48 h-48 rounded-full blur-3xl ${track.glow}`} />
          </div>
          <div className="relative z-10 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-black/30 border border-white/10 text-white">{track.icon}</div>
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/60">Workflow</p>
                  <h3 className="text-2xl font-bold text-white">{track.title}</h3>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold text-emerald-200 bg-emerald-500/10 border border-emerald-400/30">
                {track.badge}
              </span>
            </div>

            <div className="space-y-6">
              {track.steps.map((step, stepIdx) => (
                <div key={step.label} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <motion.div
                      className="w-10 h-10 rounded-full bg-white text-zinc-900 font-bold flex items-center justify-center shadow-lg"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity, delay: stepIdx * 0.2 }}
                    >
                      {stepIdx + 1}
                    </motion.div>
                    {stepIdx < track.steps.length - 1 && <div className="flex-1 w-px bg-white/20" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm uppercase tracking-wide text-white/60">{step.label}</p>
                    <p className="text-base text-white">{step.detail}</p>
                    <motion.div
                      className="mt-2 h-1 rounded-full bg-white/20 overflow-hidden"
                      initial={{ width: '0%' }}
                      whileInView={{ width: '100%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: stepIdx * 0.15 }}
                    >
                      <div className="h-full bg-white/70" />
                    </motion.div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <a
                href={track.cta.href}
                className={`inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r ${track.cta.color} hover:opacity-90 transition`}
              >
                {track.cta.label}
                <Wand2 size={16} />
              </a>
              <button className="px-4 py-3 rounded-2xl border border-white/20 text-sm text-white/80 hover:text-white hover:border-white/40 transition">
                Preview steps
              </button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function QuickStartCard({
  icon,
  iconBg,
  title,
  href,
  images,
  fallbackType = 'default',
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  href: string;
  images: string[];
  fallbackType?: FallbackType;
}) {
  return (
    <a
      href={href}
      className="group rounded-xl border border-white/10 bg-zinc-900 p-5 hover:bg-zinc-900/70 transition-colors"
      aria-label={title}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded ${iconBg}`}>{icon}</div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {images.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`${title} example`}
            loading="lazy"
            data-fallback-type={fallbackType}
            onError={handleImageError}
            className="h-20 w-full object-cover rounded-md border border-white/5"
          />
        ))}
      </div>
    </a>
  );
}

function TourModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-white font-semibold">Welcome to Lenci — 90‑second tour</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
        </div>
        <div className="px-6 py-6 space-y-6">
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
            <div className="text-white font-medium mb-1">1. Pick your studio</div>
            <div className="text-sm text-zinc-400">Choose Apparel or Product to start with the right tools.</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
            <div className="text-white font-medium mb-1">2. Describe your look</div>
            <div className="text-sm text-zinc-400">Use the prompt and settings. Or select a template from Discover.</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4">
            <div className="text-white font-medium mb-1">3. Generate & iterate</div>
            <div className="text-sm text-zinc-400">Refine, upscale, and export. That’s it — studio‑quality in minutes.</div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
          <a href="/studio/apparel" className="px-4 py-2 rounded-lg bg-fuchsia-600/30 text-fuchsia-200 hover:bg-fuchsia-600/40">Start Apparel</a>
          <a href="/studio/product" className="px-4 py-2 rounded-lg bg-cyan-600/30 text-cyan-200 hover:bg-cyan-600/40">Start Product</a>
        </div>
      </div>
    </div>
  );
}


