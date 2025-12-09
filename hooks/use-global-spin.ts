"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePublicClient } from "wagmi";
import { base } from "wagmi/chains";
import { formatUnits, type Address, parseAbiItem } from "viem";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";

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

const SPIN_EVENT = parseAbiItem('event Rig__Spin(address indexed sender, address indexed spinner, uint256 indexed epochId, uint256 price)');
const WIN_EVENT = parseAbiItem('event Rig__Win(address indexed spinner, uint256 indexed epochId, uint256 oddsPercent, uint256 amount)');
const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds

export function useGlobalSpin() {
  const [activeSpin, setActiveSpin] = useState<GlobalSpinState | null>(null);
  const [lastWin, setLastWin] = useState<GlobalWinState | null>(null);
  const [isGlobalSpinning, setIsGlobalSpinning] = useState(false);
  const [showWinResult, setShowWinResult] = useState(false);

  const lastProcessedBlockRef = useRef<bigint | null>(null);
  const lastWinIdRef = useRef<string | null>(null);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winDisplayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const publicClient = usePublicClient({ chainId: base.id });

  // Process a win event
  const processWinEvent = useCallback(async (
    spinner: Address,
    epochId: bigint,
    oddsPercent: bigint,
    amount: bigint,
    txHash: string,
    isNew: boolean
  ) => {
    const winId = `win-${spinner}-${epochId.toString()}-${txHash}`;

    // Skip if we already processed this win
    if (lastWinIdRef.current === winId) return;
    lastWinIdRef.current = winId;

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

    // Only show win animation for new wins (not on page load)
    if (isNew) {
      setShowWinResult(true);

      // Hide win result after delay
      if (winDisplayRef.current) clearTimeout(winDisplayRef.current);
      winDisplayRef.current = setTimeout(() => {
        setShowWinResult(false);
      }, 10000);
    }

    // Fetch user info async
    const user = await fetchUserByAddress(spinner);
    if (user) {
      setLastWin(prev => prev?.id === winId ? { ...prev, user } : prev);
    }
  }, []);

  // Process a spin event
  const processSpinEvent = useCallback(async (
    spinner: Address,
    epochId: bigint
  ) => {
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
  }, []);

  // Poll for new events
  useEffect(() => {
    if (!publicClient) return;

    const pollForEvents = async () => {
      try {
        const currentBlock = await publicClient.getBlockNumber();

        // On first run, look back ~2 hours (3600 blocks at 2s/block) to find last win
        if (lastProcessedBlockRef.current === null) {
          const fromBlock = currentBlock - BigInt(3600);

          // Fetch recent win for initial display
          const winLogs = await publicClient.getLogs({
            address: CONTRACT_ADDRESSES.rig as Address,
            event: WIN_EVENT,
            fromBlock: fromBlock > 0n ? fromBlock : 0n,
            toBlock: currentBlock,
          });

          if (winLogs.length > 0) {
            const latestLog = winLogs[winLogs.length - 1];
            const args = latestLog.args as {
              spinner: Address;
              epochId: bigint;
              oddsPercent: bigint;
              amount: bigint;
            };
            await processWinEvent(
              args.spinner,
              args.epochId,
              args.oddsPercent,
              args.amount,
              latestLog.transactionHash,
              false // not new, don't show animation
            );
          }

          lastProcessedBlockRef.current = currentBlock;
          return;
        }

        // Only look at new blocks
        const fromBlock = lastProcessedBlockRef.current + 1n;
        if (fromBlock > currentBlock) return;

        // Check for spin events
        const spinLogs = await publicClient.getLogs({
          address: CONTRACT_ADDRESSES.rig as Address,
          event: SPIN_EVENT,
          fromBlock,
          toBlock: currentBlock,
        });

        for (const log of spinLogs) {
          const args = log.args as {
            sender: Address;
            spinner: Address;
            epochId: bigint;
            price: bigint;
          };
          await processSpinEvent(args.spinner, args.epochId);
        }

        // Check for win events
        const winLogs = await publicClient.getLogs({
          address: CONTRACT_ADDRESSES.rig as Address,
          event: WIN_EVENT,
          fromBlock,
          toBlock: currentBlock,
        });

        for (const log of winLogs) {
          const args = log.args as {
            spinner: Address;
            epochId: bigint;
            oddsPercent: bigint;
            amount: bigint;
          };
          await processWinEvent(
            args.spinner,
            args.epochId,
            args.oddsPercent,
            args.amount,
            log.transactionHash,
            true // new win, show animation
          );
        }

        lastProcessedBlockRef.current = currentBlock;
      } catch (error) {
        console.error('Failed to poll for events:', error);
      }
    };

    // Initial poll
    pollForEvents();

    // Set up polling interval
    pollIntervalRef.current = setInterval(pollForEvents, POLL_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [publicClient, processWinEvent, processSpinEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
      if (winDisplayRef.current) clearTimeout(winDisplayRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  return {
    activeSpin,
    lastWin,
    isGlobalSpinning,
    showWinResult,
  };
}
