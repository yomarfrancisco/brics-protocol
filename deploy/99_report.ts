import { readFileSync } from "fs";
async function main() {
  const path = `deployments-${hre.network.name}.json`;
  console.log("\n=== Deployment Report ===");
  console.log(readFileSync(path, "utf-8"));
}
main().catch((e) => { console.error(e); process.exit(1); });
