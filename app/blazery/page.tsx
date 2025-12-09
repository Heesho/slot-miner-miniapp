"use client";

import { NavBar } from "@/components/nav-bar";

export default function BlazeryPage() {
  return (
    <main className="flex h-screen w-screen justify-center overflow-hidden bg-black font-mono text-white">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-1 flex-col overflow-hidden rounded-[28px] bg-black px-4 pb-4 shadow-inner"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
        }}
      >
        <div className="flex flex-1 flex-col items-center justify-center">
          <h1 className="text-2xl font-bold tracking-wide mb-4">BLAZERY</h1>
          <p className="text-gray-400 text-center">
            Coming soon...
          </p>
        </div>
      </div>
      <NavBar />
    </main>
  );
}
