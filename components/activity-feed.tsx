"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DonutSymbol } from "@/components/donut-icon";
import { cn } from "@/lib/utils";
import {
  useGlobalSpin,
  type GlobalSpinState,
  type GlobalWinState,
} from "@/hooks/use-global-spin";

const initialsFrom = (label?: string | null) => {
  if (!label) return "??";
  const stripped = label.replace(/[^a-zA-Z0-9]/g, "");
  if (!stripped) return label.slice(0, 2).toUpperCase();
  return stripped.slice(0, 2).toUpperCase();
};

const timeAgo = (timestamp: number) => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const getWinTierLabel = (tier: string) => {
  switch (tier) {
    case 'jackpot': return '💎 JACKPOT!!!';
    case 'mega': return '🔥 MEGA WIN!';
    case 'big': return '✨ BIG WIN!';
    case 'medium': return '💫 NICE WIN!';
    default: return '🎉 WIN!';
  }
};

function SpinningDisplay({ spin }: { spin: GlobalSpinState }) {
  const displayName = spin.user?.displayName || spin.user?.username || `${spin.spinner.slice(0, 6)}...${spin.spinner.slice(-4)}`;
  const username = spin.user?.username ? `@${spin.user.username}` : null;

  return (
    <div className="mt-3 px-1">
      <div className="bg-zinc-900/50 rounded-lg p-4 ring-2 ring-yellow-500/50">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border-2 border-yellow-500 animate-pulse">
            <AvatarImage
              src={spin.user?.pfpUrl || undefined}
              alt={displayName}
              className="object-cover"
            />
            <AvatarFallback className="bg-zinc-800 text-white text-sm">
              {initialsFrom(displayName)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="text-white font-medium text-sm truncate">{displayName}</div>
            {username && (
              <div className="text-gray-500 text-xs truncate">{username}</div>
            )}
            <div className="text-yellow-400 text-xs mt-0.5 animate-pulse">Waiting for result...</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WinDisplay({ win, isRecent }: { win: GlobalWinState; isRecent: boolean }) {
  const displayName = win.user?.displayName || win.user?.username || `${win.spinner.slice(0, 6)}...${win.spinner.slice(-4)}`;
  const username = win.user?.username ? `@${win.user.username}` : null;
  const isBigWin = win.symbol.tier === 'jackpot' || win.symbol.tier === 'mega' || win.symbol.tier === 'big';

  return (
    <div className="mt-3 px-1">
      <div className={cn(
        "bg-zinc-900/50 rounded-lg p-4 transition-all",
        isRecent && "animate-win-pop",
        isRecent && isBigWin && "ring-2 ring-yellow-500"
      )}>
        {/* Winner info row */}
        <div className="flex items-center gap-3 mb-3">
          <Avatar className={cn(
            "h-12 w-12 border-2",
            isBigWin ? "border-yellow-500" : "border-zinc-700"
          )}>
            <AvatarImage
              src={win.user?.pfpUrl || undefined}
              alt={displayName}
              className="object-cover"
            />
            <AvatarFallback className="bg-zinc-800 text-white text-sm">
              {initialsFrom(displayName)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="text-white font-medium truncate">{displayName}</div>
            {username && (
              <div className="text-gray-500 text-xs truncate">{username}</div>
            )}
            <div className="text-gray-500 text-xs">{timeAgo(win.timestamp)}</div>
          </div>
        </div>

        {/* Win tier label for big wins */}
        {isBigWin && isRecent && (
          <div className={cn(
            "text-center text-lg font-black mb-2",
            win.symbol.tier === 'jackpot' && "text-yellow-400 text-xl animate-pulse",
            win.symbol.tier === 'mega' && "text-orange-400",
            win.symbol.tier === 'big' && "text-yellow-400"
          )}>
            {getWinTierLabel(win.symbol.tier)}
          </div>
        )}

        {/* Win amounts */}
        <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3">
          <div>
            <div className="text-gray-400 text-xs">Won {win.symbol.payout}</div>
            <div className={cn(
              "font-bold",
              isBigWin ? "text-xl text-yellow-400" : "text-lg text-white"
            )}>
              <DonutSymbol /> {win.amountFormatted}
            </div>
            <div className="text-gray-500 text-xs">${win.usdValue}</div>
          </div>

          {/* Show 3 matching symbols */}
          <div className="flex items-center gap-1">
            <span className="text-2xl">{win.symbol.emoji}</span>
            <span className="text-2xl">{win.symbol.emoji}</span>
            <span className="text-2xl">{win.symbol.emoji}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-3 px-1">
      <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
        <div className="text-gray-500 text-sm">No recent wins</div>
        <div className="text-gray-600 text-xs mt-1">Be the first to spin!</div>
      </div>
    </div>
  );
}

export function ActivityFeed() {
  const { activeSpin, lastWin, isGlobalSpinning, showWinResult } = useGlobalSpin();

  // Show spinning state when someone is spinning
  if (isGlobalSpinning && activeSpin) {
    return <SpinningDisplay spin={activeSpin} />;
  }

  // Show win result
  if (lastWin) {
    return <WinDisplay win={lastWin} isRecent={showWinResult} />;
  }

  // Empty state
  return <EmptyState />;
}

// Export hook for use in page.tsx
export { useGlobalSpin };
