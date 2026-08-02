import { network } from "hardhat";
import { formatEther } from "viem";

async function main() {
  const conn = await network.connect();
  const viemClient = conn.viem;

  const walletClient = await viemClient.getWalletClient();
  const [deployer] = await walletClient.getAddresses();
  console.log(`Deploying from: ${deployer}`);

  const publicClient = await viemClient.getPublicClient();
  const balance = await publicClient.getBalance({ address: deployer });
  console.log(`Balance: ${formatEther(balance)} ETH`);

  const mockToken = await viemClient.deployContract("MockERC20", [
    "Sepolia USDC",
    "sUSDC",
  ]);
  console.log(`MockERC20 deployed at: ${mockToken.address}`);

  const vault = await viemClient.deployContract("PrivateVault", [
    "Private Vault Shares",
    "pvUSD",
    "https://privatevault.xyz/metadata",
    mockToken.address,
  ]);
  console.log(`PrivateVault deployed at: ${vault.address}`);

  console.log("\nDeployment complete!");
  console.log(`MockERC20: ${mockToken.address}`);
  console.log(`PrivateVault: ${vault.address}`);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
