"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import {
  useAccount,
  useConnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
  useWatchContractEvent,
} from "wagmi";
import { base } from "wagmi/chains";
import { formatEther, formatUnits, zeroAddress, type Address } from "viem";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CONTRACT_ADDRESSES, MULTICALL_ABI, RIG_ABI } from "@/lib/contracts";
import { cn, getEthPrice } from "@/lib/utils";
import { NavBar } from "@/components/nav-bar";
import { DonutSymbol } from "@/components/donut-icon";
import { ActivityFeed, useGlobalSpin } from "@/components/activity-feed";
import { getRandomSymbol as getGlobalRandomSymbol, type SlotSymbol as GlobalSlotSymbol } from "@/hooks/use-global-spin";

// ============================================
// TYPES
// ============================================

type MiniAppContext = {
  user?: {
    fid: number;
    username?: string;
    displayName?: string;
    pfpUrl?: string;
  };
};

type RigState = {
  ups: bigint;
  unitPrice: bigint;
  unitBalance: bigint;
  ethBalance: bigint;
  wethBalance: bigint;
  prizePool: bigint;
  pendingEmissions: bigint;
  epochId: bigint;
  price: bigint;
};

type SpinState = 'idle' | 'pending' | 'confirming' | 'waiting_vrf';

// ============================================
// CONSTANTS
// ============================================

const DOTARD_DECIMALS = 18;
const DOTARD_PRICE_USD = 0.10; // Hardcoded price
const DEADLINE_BUFFER_SECONDS = 15 * 60;
const VRF_TIMEOUT_MS = 120_000; // 2 minutes timeout for VRF
const BALANCE_POLL_INTERVAL_MS = 2_000; // Poll balance every 2 seconds as fallback

// Slot machine symbols with their odds
// payout = % of prize pool you win
// chance = probability of landing on this symbol
const SLOT_SYMBOLS = [
  { emoji: '🍒', name: 'Cherry', oddsBps: 100, payout: '1%', chance: '50%', tier: 'small' as const },
  { emoji: '🍋', name: 'Lemon', oddsBps: 200, payout: '2%', chance: '25%', tier: 'small' as const },
  { emoji: '📊', name: 'Bar', oddsBps: 500, payout: '5%', chance: '15%', tier: 'medium' as const },
  { emoji: '🔔', name: 'Bell', oddsBps: 1000, payout: '10%', chance: '7%', tier: 'big' as const },
  { emoji: '7️⃣', name: 'Seven', oddsBps: 2500, payout: '25%', chance: '2.5%', tier: 'mega' as const },
  { emoji: '💎', name: 'Diamond', oddsBps: 5000, payout: '50%', chance: '0.5%', tier: 'jackpot' as const },
] as const;

type SlotSymbol = typeof SLOT_SYMBOLS[number];

// ============================================
// UTILITY FUNCTIONS
// ============================================

const toBigInt = (value: bigint | number) =>
  typeof value === "bigint" ? value : BigInt(value);

const formatTokenAmount = (
  value: bigint,
  decimals: number,
  maximumFractionDigits = 2,
) => {
  if (value === 0n) return "0";
  const asNumber = Number(formatUnits(value, decimals));
  if (!Number.isFinite(asNumber)) {
    return formatUnits(value, decimals);
  }
  return asNumber.toLocaleString(undefined, {
    maximumFractionDigits,
  });
};

const formatEth = (value: bigint, maximumFractionDigits = 4) => {
  if (value === 0n) return "0";
  const asNumber = Number(formatEther(value));
  if (!Number.isFinite(asNumber)) {
    return formatEther(value);
  }
  return asNumber.toLocaleString(undefined, {
    maximumFractionDigits,
  });
};


// ============================================
// SLOT REEL COMPONENT
// ============================================

// Generate array of symbols for the reel strip
const REEL_SYMBOLS = [...SLOT_SYMBOLS, ...SLOT_SYMBOLS, ...SLOT_SYMBOLS]; // 18 symbols

function SlotReel({
  isSpinning,
  isIdleSpin = false,
  symbol,
  delay = 0,
  isWinning = false,
  idleSpeed = 0.04,
  showResult = false,
}: {
  isSpinning: boolean;
  isIdleSpin?: boolean;
  symbol: GlobalSlotSymbol | null;
  delay?: number;
  isWinning?: boolean;
  idleSpeed?: number;
  showResult?: boolean;
}) {
  const [displaySymbol, setDisplaySymbol] = useState<GlobalSlotSymbol>(SLOT_SYMBOLS[0]);
  const [landed, setLanded] = useState(false);
  const [reelOffset, setReelOffset] = useState(0);
  const animationRef = useRef<number | null>(null);
  const wasSpinningRef = useRef(false);
  const hasInitialized = useRef(false);

  // Set random initial offset on client only to avoid hydration mismatch
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      setReelOffset(Math.random() * REEL_SYMBOLS.length * 48);
    }
  }, []);

  // Single animation loop that handles both idle and active spinning
  useEffect(() => {
    // Cleanup previous animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (isSpinning) {
      // Fast spin
      wasSpinningRef.current = true;
      setLanded(false);
      let lastTime = performance.now();
      const animate = (currentTime: number) => {
        const delta = currentTime - lastTime;
        lastTime = currentTime;
        setReelOffset(prev => (prev + delta * 1.5) % (REEL_SYMBOLS.length * 48));
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else if (showResult && symbol) {
      // Show result - don't animate, stay on symbol
      // Animation is stopped, symbol prop is displayed via getVisibleSymbols
    } else if (isIdleSpin) {
      // Slow idle drift with variable speed
      let lastTime = performance.now();
      const animate = (currentTime: number) => {
        const delta = currentTime - lastTime;
        lastTime = currentTime;
        setReelOffset(prev => (prev + delta * idleSpeed) % (REEL_SYMBOLS.length * 48));
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isSpinning, isIdleSpin, idleSpeed, showResult, symbol]);

  // Handle landing on symbol when spin ends
  useEffect(() => {
    if (!isSpinning && symbol && wasSpinningRef.current) {
      const timer = setTimeout(() => {
        setDisplaySymbol(symbol);
        setLanded(true);
      }, delay);
      wasSpinningRef.current = false;
      return () => clearTimeout(timer);
    } else if (!isSpinning && symbol && !wasSpinningRef.current) {
      setDisplaySymbol(symbol);
    }
  }, [isSpinning, symbol, delay]);

  // Get symbols for vertical strip display
  const getVisibleSymbols = () => {
    // When showing result, use the symbol prop directly
    if (showResult && symbol) {
      const symIdx = SLOT_SYMBOLS.findIndex(s => s.emoji === symbol.emoji);
      const prevIdx = (symIdx - 1 + SLOT_SYMBOLS.length) % SLOT_SYMBOLS.length;
      const nextIdx = (symIdx + 1) % SLOT_SYMBOLS.length;
      return [SLOT_SYMBOLS[prevIdx], symbol, SLOT_SYMBOLS[nextIdx]];
    }
    const baseIndex = Math.floor(reelOffset / 48) % REEL_SYMBOLS.length;
    return [
      REEL_SYMBOLS[(baseIndex + REEL_SYMBOLS.length - 1) % REEL_SYMBOLS.length],
      REEL_SYMBOLS[baseIndex],
      REEL_SYMBOLS[(baseIndex + 1) % REEL_SYMBOLS.length],
    ];
  };

  const visibleSymbols = getVisibleSymbols();
  const subOffset = (showResult && symbol) ? 0 : reelOffset % 48;

  return (
    <div className={cn(
      "relative w-[72px] h-[80px] overflow-hidden rounded-lg",
      "bg-zinc-800/50",
      isSpinning ? "ring-1 ring-yellow-500/50" : "",
      isWinning && landed && "ring-2 ring-yellow-400"
    )}>
      {/* Reel strip container */}
      <div
        className="absolute inset-x-0 flex flex-col items-center"
        style={{
          transform: `translateY(${-subOffset + 16}px)`,
        }}
      >
        {visibleSymbols.map((sym, idx) => (
          <div
            key={`${sym.emoji}-${idx}`}
            className={cn(
              "flex items-center justify-center w-full h-12 text-3xl",
              isSpinning && "blur-[1px]"
            )}
          >
            {sym.emoji}
          </div>
        ))}
      </div>

      {/* Win glow */}
      {isWinning && landed && (
        <div className="absolute inset-0 bg-yellow-400/10 animate-pulse pointer-events-none" />
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function DonutardioPage() {
  const readyRef = useRef(false);
  const autoConnectAttempted = useRef(false);
  const [context, setContext] = useState<MiniAppContext | null>(null);
  const [ethUsdPrice, setEthUsdPrice] = useState<number>(3500);

  // Global spin state from blockchain events
  const { isGlobalSpinning, lastWin, showWinResult } = useGlobalSpin();

  // Local spin state management (for the user's own transaction)
  const [localSpinState, setLocalSpinState] = useState<SpinState>('idle');
  const [pendingEpochId, setPendingEpochId] = useState<bigint | null>(null);

  // Combined spinning state: either global (from blockchain) or local (user's tx pending)
  const isSpinning = isGlobalSpinning || localSpinState === 'pending' || localSpinState === 'confirming' || localSpinState === 'waiting_vrf';

  // Display symbols - show last win symbol (persists until next spin starts)
  // When spinning, symbol is null so reels animate randomly
  // When not spinning, show the last winning symbol
  const displaySymbol: GlobalSlotSymbol | null = isSpinning ? null : (lastWin?.symbol ?? null);

  // VRF timeout ref
  const vrfTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const balancePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const preSpinBalanceRef = useRef<bigint | null>(null);

  // Prize pool interpolation
  const [interpolatedPrizePool, setInterpolatedPrizePool] = useState<bigint | null>(null);

  // ============================================
  // SDK INITIALIZATION
  // ============================================

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

  // Fetch ETH price
  useEffect(() => {
    const fetchPrice = async () => {
      const price = await getEthPrice();
      setEthUsdPrice(price);
    };
    fetchPrice();
    const interval = setInterval(fetchPrice, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup timeouts and intervals
  useEffect(() => {
    return () => {
      if (vrfTimeoutRef.current) clearTimeout(vrfTimeoutRef.current);
      if (balancePollRef.current) clearInterval(balancePollRef.current);
    };
  }, []);

  // ============================================
  // WALLET CONNECTION
  // ============================================

  const { address, isConnected } = useAccount();
  const { connectors, connectAsync, isPending: isConnecting } = useConnect();
  const primaryConnector = connectors[0];

  useEffect(() => {
    if (
      autoConnectAttempted.current ||
      isConnected ||
      !primaryConnector ||
      isConnecting
    ) {
      return;
    }
    autoConnectAttempted.current = true;
    connectAsync({
      connector: primaryConnector,
      chainId: base.id,
    }).catch(() => {});
  }, [connectAsync, isConnected, isConnecting, primaryConnector]);

  // ============================================
  // CONTRACT READS
  // ============================================

  const { data: rawRigState, refetch: refetchRigState } = useReadContract({
    address: CONTRACT_ADDRESSES.multicall as Address,
    abi: MULTICALL_ABI,
    functionName: "getRig",
    args: [address ?? zeroAddress],
    chainId: base.id,
    query: {
      refetchInterval: 3_000,
    },
  });

  const rigState = useMemo(() => {
    if (!rawRigState) return undefined;
    return rawRigState as unknown as RigState;
  }, [rawRigState]);

  const { data: entropyFee } = useReadContract({
    address: CONTRACT_ADDRESSES.multicall as Address,
    abi: MULTICALL_ABI,
    functionName: "getEntropyFee",
    chainId: base.id,
    query: {
      refetchInterval: 30_000,
    },
  });

  useEffect(() => {
    if (!readyRef.current && rigState) {
      readyRef.current = true;
      sdk.actions.ready().catch(() => {});
    }
  }, [rigState]);

  // ============================================
  // PRIZE POOL INTERPOLATION
  // ============================================

  useEffect(() => {
    if (!rigState) {
      setInterpolatedPrizePool(null);
      return;
    }

    // Start with fetched value + pending emissions
    const totalPool = rigState.prizePool + rigState.pendingEmissions;
    setInterpolatedPrizePool(totalPool);

    // Update every second with interpolated value based on ups
    const interval = setInterval(() => {
      if (rigState.ups > 0n) {
        setInterpolatedPrizePool((prev) => {
          if (!prev) return totalPool;
          return prev + rigState.ups;
        });
      }
    }, 1_000);

    return () => clearInterval(interval);
  }, [rigState]);

  // ============================================
  // TRANSACTION HANDLING
  // ============================================

  const {
    data: txHash,
    writeContract,
    isPending: isWriting,
    reset: resetWrite,
  } = useWriteContract();

  const {
    data: receipt,
    isLoading: isConfirming,
  } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: base.id,
  });

  // ============================================
  // VRF EVENT WATCHING
  // ============================================

  // Note: Event watching is unreliable in some environments, so we use balance polling as primary detection
  // This event watcher is kept as a faster detection method when it works
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.rig as Address,
    abi: RIG_ABI,
    eventName: 'Rig__Win',
    chainId: base.id,
    onLogs(logs) {
      for (const log of logs) {
        const { spinner } = log.args as {
          spinner: Address;
          epochId: bigint;
          oddsPercent: bigint;
          amount: bigint;
        };

        // Check if this win is for our address
        if (spinner?.toLowerCase() === address?.toLowerCase() && localSpinState === 'waiting_vrf') {
          console.log('Win detected via event for current user');
          handleWinDetected();
          break;
        }
      }
    },
    enabled: localSpinState === 'waiting_vrf' && !!address,
  });

  // ============================================
  // SPIN HANDLER
  // ============================================

  const handleSpin = useCallback(async () => {
    if (!rigState || localSpinState !== 'idle') return;

    try {
      let targetAddress = address;
      if (!targetAddress) {
        if (!primaryConnector) {
          throw new Error("Wallet connector not available yet.");
        }
        const result = await connectAsync({
          connector: primaryConnector,
          chainId: base.id,
        });
        targetAddress = result.accounts[0];
      }
      if (!targetAddress) {
        throw new Error("Unable to determine wallet address.");
      }

      setLocalSpinState('pending');

      // Store pre-spin balance for fallback detection
      preSpinBalanceRef.current = rigState.unitBalance;

      const price = rigState.price;
      const epochId = toBigInt(rigState.epochId);
      const deadline = BigInt(
        Math.floor(Date.now() / 1000) + DEADLINE_BUFFER_SECONDS,
      );
      const maxPrice = price === 0n ? 0n : (price * 105n) / 100n;

      // Calculate total value: spin price + entropy fee
      const fee = entropyFee ?? 0n;
      const totalValue = price + fee;

      setPendingEpochId(epochId);

      await writeContract({
        account: targetAddress as Address,
        address: CONTRACT_ADDRESSES.multicall as Address,
        abi: MULTICALL_ABI,
        functionName: "spin",
        args: [epochId, deadline, maxPrice],
        value: totalValue,
        chainId: base.id,
      });

      setLocalSpinState('confirming');
    } catch (error) {
      console.error("Spin failed:", error);
      setLocalSpinState('idle');
      resetWrite();
    }
  }, [
    address,
    connectAsync,
    entropyFee,
    primaryConnector,
    resetWrite,
    rigState,
    localSpinState,
    writeContract,
  ]);

  // Helper to handle detected win (simplified - global hook handles display)
  const handleWinDetected = useCallback(() => {
    // Clear all pending timeouts/intervals
    if (vrfTimeoutRef.current) {
      clearTimeout(vrfTimeoutRef.current);
      vrfTimeoutRef.current = null;
    }
    if (balancePollRef.current) {
      clearInterval(balancePollRef.current);
      balancePollRef.current = null;
    }

    setLocalSpinState('idle');
    preSpinBalanceRef.current = null;
    refetchRigState();
    resetWrite();
  }, [refetchRigState, resetWrite]);

  // Handle transaction receipt
  useEffect(() => {
    if (!receipt) return;

    if (receipt.status === "success") {
      setLocalSpinState('waiting_vrf');

      // Set VRF timeout
      vrfTimeoutRef.current = setTimeout(() => {
        // Clear balance polling
        if (balancePollRef.current) {
          clearInterval(balancePollRef.current);
          balancePollRef.current = null;
        }
        setLocalSpinState('idle');
        preSpinBalanceRef.current = null;
        resetWrite();
        refetchRigState();
      }, VRF_TIMEOUT_MS);

      // Start balance polling as fallback for event detection
      balancePollRef.current = setInterval(() => {
        refetchRigState();
      }, BALANCE_POLL_INTERVAL_MS);

    } else if (receipt.status === "reverted") {
      setLocalSpinState('idle');
      preSpinBalanceRef.current = null;
      resetWrite();
    }
  }, [receipt, refetchRigState, resetWrite]);

  // Balance change detection (fallback when event watching fails)
  useEffect(() => {
    if (localSpinState !== 'waiting_vrf' || !rigState || preSpinBalanceRef.current === null) {
      return;
    }

    const preBalance = preSpinBalanceRef.current;
    const currentBalance = rigState.unitBalance;

    // Check if balance increased (indicating a win)
    if (currentBalance > preBalance) {
      console.log('Win detected via balance change');
      handleWinDetected();
    }
  }, [localSpinState, rigState, handleWinDetected]);

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const prizePoolDisplay = interpolatedPrizePool !== null
    ? formatTokenAmount(interpolatedPrizePool, DOTARD_DECIMALS, 2)
    : "—";

  // Calculate prize pool USD using hardcoded DOTARD price
  const prizePoolUsd = interpolatedPrizePool !== null
    ? Number(formatUnits(interpolatedPrizePool, DOTARD_DECIMALS)) * DOTARD_PRICE_USD
    : 0;

  const jackpotAmount = interpolatedPrizePool !== null
    ? interpolatedPrizePool / 2n
    : 0n;

  const jackpotDisplay = jackpotAmount > 0n
    ? formatTokenAmount(jackpotAmount, DOTARD_DECIMALS, 2)
    : "—";

  // Jackpot USD using hardcoded price
  const jackpotUsdDisplay = jackpotAmount > 0n
    ? (Number(formatUnits(jackpotAmount, DOTARD_DECIMALS)) * DOTARD_PRICE_USD).toFixed(2)
    : "0.00";

  // Minimum win (1% of pool)
  const minWinAmount = interpolatedPrizePool !== null
    ? interpolatedPrizePool / 100n
    : 0n;

  const minWinDisplay = minWinAmount > 0n
    ? formatTokenAmount(minWinAmount, DOTARD_DECIMALS, 2)
    : "—";

  const minWinUsd = minWinAmount > 0n
    ? (Number(formatUnits(minWinAmount, DOTARD_DECIMALS)) * DOTARD_PRICE_USD).toFixed(2)
    : "0.00";

  const spinPriceDisplay = rigState
    ? `Ξ${formatEth(rigState.price, 6)}`
    : "Ξ—";

  const spinPriceUsdDisplay = rigState
    ? (Number(formatEther(rigState.price)) * ethUsdPrice).toFixed(2)
    : "0.00";

  const upsDisplay = rigState
    ? formatTokenAmount(rigState.ups, DOTARD_DECIMALS, 4)
    : "—";

  const userBalanceDisplay = rigState
    ? formatTokenAmount(rigState.unitBalance, DOTARD_DECIMALS, 2)
    : "—";

  const userBalanceUsd = rigState
    ? (Number(formatUnits(rigState.unitBalance, DOTARD_DECIMALS)) * DOTARD_PRICE_USD).toFixed(2)
    : "0.00";

  const ethBalanceDisplay = rigState
    ? formatEth(rigState.ethBalance, 4)
    : "—";

  const buttonLabel = useMemo(() => {
    if (!rigState) return "Loading...";
    if (localSpinState === 'pending') return "SPINNING...";
    if (localSpinState === 'confirming') return "CONFIRMING...";
    if (localSpinState === 'waiting_vrf') return "WAITING...";
    return "SPIN";
  }, [rigState, localSpinState]);

  const isSpinDisabled =
    !rigState ||
    localSpinState !== 'idle' ||
    isWriting ||
    isConfirming ||
    isGlobalSpinning ||
    (rigState && rigState.ethBalance < rigState.price);

  return (
    <main className="flex h-screen w-screen justify-center overflow-hidden bg-black font-mono text-white">
      <div
        className="relative flex h-full w-full max-w-[520px] flex-1 flex-col overflow-hidden rounded-[28px] bg-black px-2 pb-4 shadow-inner"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 100px)",
        }}
      >
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header - Jackpot left, Min Win right */}
          <div className="flex items-start justify-between gap-2 mb-2">
            {/* Jackpot - Top Left */}
            <div className={cn(
              "flex-1 rounded-lg py-1.5 px-2",
              showWinResult && lastWin?.symbol.tier === 'jackpot'
                ? "animate-jackpot"
                : "bg-gradient-to-br from-yellow-600 to-yellow-500"
            )}>
              <div className="text-[9px] font-bold text-black/70 tracking-wider">
                JACKPOT (50%)
              </div>
              <div className="text-lg font-black text-black leading-tight">
                <DonutSymbol /> {jackpotDisplay}
              </div>
              <div className="text-[10px] text-black/70">
                ${jackpotUsdDisplay}
              </div>
            </div>

            {/* Min Win - Top Right */}
            <div className="flex-1 text-right bg-zinc-900/50 rounded-lg py-1.5 px-2">
              <div className="text-[9px] text-gray-400 tracking-wider">
                MIN WIN (1%)
              </div>
              <div className="text-lg font-bold text-green-400 leading-tight">
                <DonutSymbol /> {minWinDisplay}
              </div>
              <div className="text-[10px] text-gray-400">
                ${minWinUsd}
              </div>
            </div>
          </div>

          {/* Slot Machine */}
          <div className={cn(
            "relative rounded-xl overflow-hidden",
            "bg-zinc-900/50 border",
            isSpinning ? "border-yellow-500/50" : "border-zinc-800/50",
            showWinResult && "animate-win-shake"
          )}>
            {/* Reels */}
            <div className="flex justify-center items-center gap-3 p-4">
              <SlotReel
                isSpinning={isSpinning}
                isIdleSpin={true}
                symbol={displaySymbol}
                delay={0}
                isWinning={showWinResult}
                idleSpeed={0.035}
                showResult={showWinResult}
              />
              <SlotReel
                isSpinning={isSpinning}
                isIdleSpin={true}
                symbol={displaySymbol}
                delay={100}
                isWinning={showWinResult}
                idleSpeed={0.045}
                showResult={showWinResult}
              />
              <SlotReel
                isSpinning={isSpinning}
                isIdleSpin={true}
                symbol={displaySymbol}
                delay={200}
                isWinning={showWinResult}
                idleSpeed={0.055}
                showResult={showWinResult}
              />
            </div>
          </div>

          {/* Prize Pool and Spin Price */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="bg-zinc-900/50 rounded-lg py-2 px-3">
              <div className="flex justify-between items-center">
                <div className="text-[10px] text-gray-400 tracking-wider">
                  PRIZE POOL
                </div>
                <div className="text-[10px] text-green-400">
                  +{upsDisplay}/sec
                </div>
              </div>
              <div className="text-lg font-bold text-white">
                <DonutSymbol /> {prizePoolDisplay}
              </div>
              <div className="text-xs text-gray-400">
                ${prizePoolUsd.toFixed(2)}
              </div>
            </div>
            <div className="bg-zinc-900/50 rounded-lg py-2 px-3 text-right">
              <div className="text-[10px] text-gray-400 tracking-wider">
                SPIN PRICE
              </div>
              <div className="text-lg font-bold text-yellow-400">
                {spinPriceDisplay}
              </div>
              <div className="text-xs text-gray-400">
                ${spinPriceUsdDisplay}
              </div>
            </div>
          </div>

          {/* Spin Button */}
          <div className="mt-3">
            <Button
              className={cn(
                "w-full rounded-2xl py-4 text-lg font-black shadow-lg transition-all",
                localSpinState !== 'idle'
                    ? "bg-zinc-700 text-zinc-400"
                    : "animate-gradient text-black hover:scale-[1.02]",
                "disabled:cursor-not-allowed disabled:opacity-50"
              )}
              onClick={handleSpin}
              disabled={isSpinDisabled}
            >
              {buttonLabel}
            </Button>

            {/* Balances under spin button - DOTARD left, ETH right */}
            <div className="mt-2 flex justify-between items-center text-xs">
              <div className="text-left">
                <span className="text-gray-500">Your </span>
                <span className="text-orange-400 font-bold"><DonutSymbol /> {userBalanceDisplay}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-500">Your </span>
                <span className="text-white font-bold">Ξ{ethBalanceDisplay}</span>
                {rigState && rigState.ethBalance < rigState.price && (
                  <span className="text-red-400 ml-1">(Low)</span>
                )}
              </div>
            </div>
          </div>

          {/* Global Activity Feed */}
          <ActivityFeed />
        </div>
      </div>
      <NavBar />
    </main>
  );
}
