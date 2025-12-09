"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { base } from "wagmi/chains";
import { formatUnits, type Address, parseAbiItem } from "viem";
import { CONTRACT_ADDRESSES, RIG_ABI } from "@/lib/contracts";

// Slot symbols mapping
export type SlotSymbol = {
  emoji: string;
  name: string;
  oddsBps: number;
  payout: string;
  tier: 'small' | 'medium' | 'big' | 'mega' | 'jackpot';
};

export const SLOT_SYMBOLS: SlotSymbol[] = [
  { emoji: '🍒', name: 'Cherry', oddsBps: 100, payout: '1%', tier: 'small' },
  { emoji: '🍋', name: 'Lemon', oddsBps: 200, payout: '2%', tier: 'small' },
  { emoji: '📊', name: 'Bar', oddsBps: 500, payout: '5%', tier: 'medium' },
  { emoji: '🔔', name: 'Bell', oddsBps: 1000, payout: '10%', tier: 'big' },
  { emoji: '7️⃣', name: 'Seven', oddsBps: 2500, payout: '25%', tier: 'mega' },
  { emoji: '💎', name: 'Diamond', oddsBps: 5000, payout: '50%', tier: 'jackpot' },
];

const DOTARD_DECIMALS = 18;
const DOTARD_PRICE_USD = 0.10;
const SPIN_TIMEOUT_MS = 120_000;

export type UserInfo = {
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
};

export type GlobalSpinState = {
  id: string;
  spinner: Address;
  epochId: bigint;
  timestamp: number;
  user?: UserInfo;
};

export type GlobalWinState = {
  id: string;
  spinner: Address;
  epochId: bigint;
  oddsBps: number;
  amount: bigint;
  timestamp: number;
  user?: UserInfo;
  symbol: SlotSymbol;
  amountFormatted: string;
  usdValue: string;
};

export const getSymbolFromOdds = (oddsBps: number): SlotSymbol => {
  return SLOT_SYMBOLS.find(s => s.oddsBps === oddsBps) ?? SLOT_SYMBOLS[0];
};

export const getRandomSymbol = (): SlotSymbol => {
  return SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
};

const formatAmount = (value: bigint): string => {
  const num = Number(formatUnits(value, DOTARD_DECIMALS));
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  if (num >= 100) return num.toFixed(0);
  return num.toFixed(1);
};

async function fetchUserByAddress(address: string): Promise<UserInfo | null> {
  try {
    const res = await fetch(`/api/neynar/user?address=${address}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  } catch {
    return null;
  }
}

export function useGlobalSpin() {
  const [activeSpin, setActiveSpin] = useState<GlobalSpinState | null>(null);
  const [lastWin, setLastWin] = useState<GlobalWinState | null>(null);
  const [isGlobalSpinning, setIsGlobalSpinning] = useState(false);
  const [showWinResult, setShowWinResult] = useState(false);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winDisplayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFetchedInitial = useRef(false);

  const publicClient = usePublicClient({ chainId: base.id });

  // Fetch the most recent win on mount
  useEffect(() => {
    if (hasFetchedInitial.current || !publicClient) return;
    hasFetchedInitial.current = true;

    const fetchRecentWin = async () => {
      try {
        const currentBlock = await publicClient.getBlockNumber();
        // Look back ~1 hour of blocks (assuming ~2s block time on Base)
        const fromBlock = currentBlock - BigInt(1800);

        const logs = await publicClient.getLogs({
          address: CONTRACT_ADDRESSES.rig as Address,
          event: parseAbiItem('event Rig__Win(address indexed spinner, uint256 indexed epochId, uint256 oddsPercent, uint256 amount)'),
          fromBlock: fromBlock > 0n ? fromBlock : 0n,
          toBlock: currentBlock,
        });

        if (logs.length > 0) {
          // Get the most recent win
          const latestLog = logs[logs.length - 1];
          const { spinner, epochId, oddsPercent, amount } = latestLog.args as {
            spinner: Address;
            epochId: bigint;
            oddsPercent: bigint;
            amount: bigint;
          };

          const winId = `win-${spinner}-${epochId.toString()}-${latestLog.transactionHash}`;
          const symbol = getSymbolFromOdds(Number(oddsPercent));

          const newWin: GlobalWinState = {
            id: winId,
            spinner,
            epochId,
            oddsBps: Number(oddsPercent),
            amount,
            timestamp: Date.now(), // We don't have exact timestamp, use now
            symbol,
            amountFormatted: formatAmount(amount),
            usdValue: (Number(formatUnits(amount, DOTARD_DECIMALS)) * DOTARD_PRICE_USD).toFixed(2),
          };

          setLastWin(newWin);

          // Fetch user info
          const user = await fetchUserByAddress(spinner);
          if (user) {
            setLastWin(prev => prev?.id === winId ? { ...prev, user } : prev);
          }
        }
      } catch (error) {
        console.error('Failed to fetch recent win:', error);
      }
    };

    fetchRecentWin();
  }, [publicClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
      if (winDisplayRef.current) clearTimeout(winDisplayRef.current);
    };
  }, []);

  // Watch for global spin events
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.rig as Address,
    abi: RIG_ABI,
    eventName: 'Rig__Spin',
    chainId: base.id,
    onLogs: useCallback(async (logs: { args: unknown; transactionHash: string }[]) => {
      for (const log of logs) {
        const { spinner, epochId } = log.args as {
          sender: Address;
          spinner: Address;
          epochId: bigint;
          price: bigint;
        };

        const id = `spin-${spinner}-${epochId.toString()}`;

        const newSpin: GlobalSpinState = {
          id,
          spinner,
          epochId,
          timestamp: Date.now(),
        };

        setActiveSpin(newSpin);
        setIsGlobalSpinning(true);
        setShowWinResult(false);

        // Fetch user info async
        const user = await fetchUserByAddress(spinner);
        if (user) {
          setActiveSpin(prev => prev?.id === id ? { ...prev, user } : prev);
        }

        // Auto-clear after timeout
        if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
        spinTimeoutRef.current = setTimeout(() => {
          setActiveSpin(prev => prev?.id === id ? null : prev);
          setIsGlobalSpinning(false);
        }, SPIN_TIMEOUT_MS);
      }
    }, []),
  });

  // Watch for global win events
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.rig as Address,
    abi: RIG_ABI,
    eventName: 'Rig__Win',
    chainId: base.id,
    onLogs: useCallback(async (logs: { args: unknown; transactionHash: string }[]) => {
      for (const log of logs) {
        const { spinner, epochId, oddsPercent, amount } = log.args as {
          spinner: Address;
          epochId: bigint;
          oddsPercent: bigint;
          amount: bigint;
        };

        const winId = `win-${spinner}-${epochId.toString()}-${log.transactionHash}`;
        const symbol = getSymbolFromOdds(Number(oddsPercent));

        // Clear active spin
        if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
        setActiveSpin(null);
        setIsGlobalSpinning(false);

        const newWin: GlobalWinState = {
          id: winId,
          spinner,
          epochId,
          oddsBps: Number(oddsPercent),
          amount,
          timestamp: Date.now(),
          symbol,
          amountFormatted: formatAmount(amount),
          usdValue: (Number(formatUnits(amount, DOTARD_DECIMALS)) * DOTARD_PRICE_USD).toFixed(2),
        };

        setLastWin(newWin);
        setShowWinResult(true);

        // Fetch user info async
        const user = await fetchUserByAddress(spinner);
        if (user) {
          setLastWin(prev => prev?.id === winId ? { ...prev, user } : prev);
        }

        // Hide win result after delay (but keep lastWin for display)
        if (winDisplayRef.current) clearTimeout(winDisplayRef.current);
        winDisplayRef.current = setTimeout(() => {
          setShowWinResult(false);
        }, 10000);
      }
    }, []),
  });

  return {
    activeSpin,
    lastWin,
    isGlobalSpinning,
    showWinResult,
  };
}
