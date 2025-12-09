"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Info, Sparkles } from "lucide-react";

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
        paddingTop: "8px",
      }}
    >
      {/* Gradient border top */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent" />

      {/* Background with subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-zinc-950 to-zinc-900/95 backdrop-blur-sm" />

      <div className="relative flex justify-around items-center max-w-[520px] mx-auto px-4">
        {/* Blazery - Treasury/Burns */}
        <Link
          href="/blazery"
          className={cn(
            "flex flex-col items-center justify-center p-2 transition-all duration-200 rounded-xl",
            pathname === "/blazery"
              ? "text-yellow-400"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <div className={cn(
            "p-2 rounded-lg transition-all",
            pathname === "/blazery" && "bg-yellow-500/10"
          )}>
            <Sparkles className={cn(
              "w-6 h-6 transition-all",
              pathname === "/blazery" && "drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
            )} />
          </div>
          <span className="text-[10px] font-medium mt-0.5">BURNS</span>
        </Link>

        {/* Main - Slot Machine */}
        <Link
          href="/"
          className={cn(
            "flex flex-col items-center justify-center p-2 transition-all duration-200 -mt-4",
            pathname === "/"
              ? "text-yellow-400"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <div className={cn(
            "relative p-3 rounded-2xl transition-all",
            pathname === "/"
              ? "bg-gradient-to-br from-yellow-500 to-orange-500 shadow-lg shadow-yellow-500/30"
              : "bg-zinc-800 hover:bg-zinc-700"
          )}>
            {/* Slot machine icon */}
            <div className="text-2xl">🎰</div>
            {/* Glow ring when active */}
            {pathname === "/" && (
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-400 blur-md opacity-50 -z-10 animate-pulse" />
            )}
          </div>
          <span className={cn(
            "text-[10px] font-bold mt-1",
            pathname === "/" ? "text-yellow-400" : "text-zinc-500"
          )}>SPIN</span>
        </Link>

        {/* About */}
        <Link
          href="/about"
          className={cn(
            "flex flex-col items-center justify-center p-2 transition-all duration-200 rounded-xl",
            pathname === "/about"
              ? "text-yellow-400"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <div className={cn(
            "p-2 rounded-lg transition-all",
            pathname === "/about" && "bg-yellow-500/10"
          )}>
            <Info className={cn(
              "w-6 h-6 transition-all",
              pathname === "/about" && "drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
            )} />
          </div>
          <span className="text-[10px] font-medium mt-0.5">INFO</span>
        </Link>
      </div>
    </nav>
  );
}
