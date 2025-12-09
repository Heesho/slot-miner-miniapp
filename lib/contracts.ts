export const CONTRACT_ADDRESSES = {
  // Slot machine contracts (Donatardio)
  unit: "0x1bFD334638F2929a1C8b1437A06992cC01C5A315",
  rig: "0x9C8959C9675f26852Ed9E048c92C5d32C9eE7513",
  multicall: "0x027F9C2306f998a2994005eEc1a5F61c2259Af8D",
} as const;

// Multicall ABI for slot machine
export const MULTICALL_ABI = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "epochId",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "maxPrice",
        type: "uint256",
      },
    ],
    name: "spin",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "getRig",
    outputs: [
      {
        components: [
          {
            internalType: "uint256",
            name: "ups",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "unitPrice",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "unitBalance",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "ethBalance",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "wethBalance",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "prizePool",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "pendingEmissions",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "epochId",
            type: "uint256",
          },
          {
            internalType: "uint256",
            name: "price",
            type: "uint256",
          },
        ],
        internalType: "struct Multicall.RigState",
        name: "state",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getEntropyFee",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getOdds",
    outputs: [
      {
        internalType: "uint256[]",
        name: "",
        type: "uint256[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Rig contract ABI for event watching
export const RIG_ABI = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "spinner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "epochId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "oddsPercent",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "Rig__Win",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "spinner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "uint256",
        name: "epochId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "price",
        type: "uint256",
      },
    ],
    name: "Rig__Spin",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "epochId",
        type: "uint256",
      },
      {
        indexed: true,
        internalType: "uint64",
        name: "sequenceNumber",
        type: "uint64",
      },
    ],
    name: "Rig__EntropyRequested",
    type: "event",
  },
] as const;
