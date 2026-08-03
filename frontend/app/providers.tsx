"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConfig, http, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";
import type { Chain } from "wagmi/chains";

export const privateVaultChain = {
  id: 31337,
  name: "PrivateVault Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://localhost:8545"] },
    public: { http: ["http://localhost:8545"] },
  },
} as const satisfies Chain;

export const wagmiConfig = createConfig({
  chains: [privateVaultChain],
  transports: {
    [privateVaultChain.id]: http("http://localhost:8545"),
  },
  connectors: [injected()],
});

const queryClient = new QueryClient();

export const DEFAULT_NOX_COMPUTE = "0x75C6AF4430cc474b1bb9b8540b7E46D6f8e1C685";

interface AppConfig {
  vaultAddress: string;
  tokenAddress: string;
  noxComputeAddress: string;
  setVaultAddress: (value: string) => void;
  setTokenAddress: (value: string) => void;
  setNoxComputeAddress: (value: string) => void;
}

const AppConfigContext = createContext<AppConfig | null>(null);

export function Providers({ children }: { children: ReactNode }) {
  const [vaultAddress, setVaultAddress] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [noxComputeAddress, setNoxComputeAddress] = useState(DEFAULT_NOX_COMPUTE);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AppConfigContext.Provider
          value={{
            vaultAddress,
            tokenAddress,
            noxComputeAddress,
            setVaultAddress,
            setTokenAddress,
            setNoxComputeAddress,
          }}
        >
          {children}
        </AppConfigContext.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function useAppConfig(): AppConfig {
  const context = useContext(AppConfigContext);
  if (!context) {
    throw new Error("useAppConfig must be used within Providers");
  }
  return context;
}
