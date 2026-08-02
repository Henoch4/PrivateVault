import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { defineConfig } from "hardhat/config";
import noxPlugin from "@iexec-nox/nox-hardhat-plugin";

const sepoliaUrl = process.env.SEPOLIA_RPC_URL;
const sepoliaKey = process.env.SEPOLIA_PRIVATE_KEY;

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin, noxPlugin],
  solidity: "0.8.35",
  networks: {
    default: {
      type: "edr-simulated",
      chainType: "op",
      allowUnlimitedContractSize: true,
    },
    ...(sepoliaUrl
      ? {
          sepolia: {
            type: "http" as const,
            chainType: "l1" as const,
            url: sepoliaUrl,
            accounts: sepoliaKey ? [sepoliaKey] : [],
          },
        }
      : {}),
  },
});
