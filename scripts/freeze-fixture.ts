// scripts/freeze-fixture.ts
import { copyFileSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import crypto from "crypto";

const NAME = "ACME-LLC-30";
const base = join(process.cwd(), "pricing-fixtures");
const latest = join(base, `${NAME}-latest.json`);
const frozen = join(base, `${NAME}-frozen.json`);
const frozenSha = join(base, `${NAME}-frozen.sha256`);

copyFileSync(latest, frozen);

const data = readFileSync(frozen);
const sha = crypto.createHash("sha256").update(data).digest("hex");
writeFileSync(frozenSha, `${sha}\n`);
console.log(`Frozen ${NAME}: sha256=${sha}`);
