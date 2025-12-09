"use client";

import { useEffect, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NavBar } from "@/components/nav-bar";
import { AddToFarcasterButton } from "@/components/add-to-farcaster-button";
import { DonutSymbol } from "@/components/donut-icon";

type MiniAppContext = {
  user?: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
};

const initialsFrom = (label?: string) => {
  if (!label) return "";
  const stripped = label.replace(/[^a-zA-Z0-9]/g, "");
  if (!stripped) return label.slice(0, 2).toUpperCase();
  return stripped.slice(0, 2).toUpperCase();
};

export default function AboutPage() {
  const readyRef = useRef(false);
  const [context, setContext] = useState<MiniAppContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hydrateContext = async () => {
      try {
        const ctx = (await (sdk as unknown as {
          context: Promise<MiniAppContext> | MiniAppContext;
        }).context) as MiniAppContext;
        if (!cancelled) {
          setContext(ctx);
        }
      } catch {
        if (!cancelled) setContext(null);
      }
    };
    hydrateContext();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!readyRef.current) {
        readyRef.current = true;
        sdk.actions.ready().catch(() => {});
      }
    }, 1200);
    return () => clearTimeout(timeout);
  }, []);

  const userDisplayName =
    context?.user?.displayName ?? context?.user?.username ?? "Farcaster user";
  const userHandle = context?.user?.username
    ? `@${context.user.username}`
    : context?.user?.fid
      ? `fid ${context.user.fid}`
      : "";
  const userAvatarUrl = context?.user?.pfpUrl ?? null;

  return (
    <main className="flex h-screen w-screen justify-center overflow-hidden bg-black font-mono text-white">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-1 flex-col overflow-hidden rounded-[28px] bg-black px-2 pb-4 shadow-inner"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        }}
      >
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="sticky top-0 z-10 bg-black pb-2 flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-wide">ABOUT</h1>
            {context?.user ? (
              <div className="flex items-center gap-2 rounded-full bg-black px-3 py-1">
                <Avatar className="h-8 w-8 border border-zinc-800">
                  <AvatarImage
                    src={userAvatarUrl || undefined}
                    alt={userDisplayName}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-zinc-800 text-white">
                    {initialsFrom(userDisplayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="leading-tight text-left">
                  <div className="text-sm font-bold">{userDisplayName}</div>
                  {userHandle ? (
                    <div className="text-xs text-gray-400">{userHandle}</div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-6 px-2 overflow-y-auto scrollbar-hide flex-1">
            <div className="grid grid-cols-1 gap-2">
              <AddToFarcasterButton
                variant="default"
              />
            </div>

            <section>
              <h2 className="text-lg font-bold text-yellow-400 mb-2">
                What Is Donutardio?
              </h2>
              <ul className="space-y-1 text-sm text-gray-300 list-disc list-inside">
                <li>Vegas-style slot machine on Base</li>
                <li>Pay ETH to spin, win <DonutSymbol /> DOTARD tokens from the prize pool</li>
                <li>Prize pool grows continuously from emissions</li>
                <li>VRF-powered random outcomes - provably fair!</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-yellow-400 mb-2">
                How It Works
              </h2>
              <ul className="space-y-1 text-sm text-gray-300 list-disc list-inside">
                <li>Spin price follows a Dutch auction:</li>
                <li className="pl-6 list-none">- Price doubles after each spin</li>
                <li className="pl-6 list-none">- Then decays to 0 over one hour</li>
                <li>90% of spin revenue goes to treasury</li>
                <li>10% goes to team</li>
                <li>VRF callback determines your win amount</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-yellow-400 mb-2">
                Prize Pool
              </h2>
              <ul className="space-y-1 text-sm text-gray-300 list-disc list-inside">
                <li><DonutSymbol /> DOTARD tokens are emitted continuously</li>
                <li>Starting at 2 DOTARD/sec, halving every 30 days</li>
                <li>Tail emission: 0.01 DOTARD/sec forever</li>
                <li>Each spin mints pending emissions to the prize pool</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-bold text-yellow-400 mb-2">
                Win Odds
              </h2>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-zinc-900 rounded p-2 flex items-center gap-2">
                  <span className="text-2xl">🍒</span>
                  <div>
                    <div className="text-white">Cherry</div>
                    <div className="text-gray-400">1% pool • 50% chance</div>
                  </div>
                </div>
                <div className="bg-zinc-900 rounded p-2 flex items-center gap-2">
                  <span className="text-2xl">🍋</span>
                  <div>
                    <div className="text-white">Lemon</div>
                    <div className="text-gray-400">2% pool • 25% chance</div>
                  </div>
                </div>
                <div className="bg-zinc-900 rounded p-2 flex items-center gap-2">
                  <span className="text-2xl">📊</span>
                  <div>
                    <div className="text-white">Bar</div>
                    <div className="text-gray-400">5% pool • 15% chance</div>
                  </div>
                </div>
                <div className="bg-zinc-900 rounded p-2 flex items-center gap-2">
                  <span className="text-2xl">🔔</span>
                  <div>
                    <div className="text-white">Bell</div>
                    <div className="text-gray-400">10% pool • 7% chance</div>
                  </div>
                </div>
                <div className="bg-zinc-900 rounded p-2 flex items-center gap-2">
                  <span className="text-2xl">7️⃣</span>
                  <div>
                    <div className="text-white">Seven</div>
                    <div className="text-gray-400">25% pool • 2.5% chance</div>
                  </div>
                </div>
                <div className="bg-zinc-900 rounded p-2 flex items-center gap-2 border border-yellow-500/50">
                  <span className="text-2xl">💎</span>
                  <div>
                    <div className="text-yellow-400 font-bold">Diamond</div>
                    <div className="text-gray-400">50% pool • 0.5% chance</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="pb-4">
              <h2 className="text-lg font-bold text-yellow-400 mb-2">
                Contracts
              </h2>
              <ul className="space-y-1 text-sm text-gray-300 list-disc list-inside">
                <li>Network: Base</li>
                <li className="break-all"><DonutSymbol /> DOTARD: 0x1bFD...4315</li>
                <li className="break-all">Rig: 0x9C89...7513</li>
                <li className="break-all">Multicall: 0x027F...Af8D</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
      <NavBar />
    </main>
  );
}
