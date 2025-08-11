#!/usr/bin/env ts-node

import * as fs from "fs";
import * as path from "path";
import { Octokit } from "@octokit/rest";

const token = process.env.GITHUB_TOKEN || "";
if (!token || !process.env.GITHUB_REPOSITORY || !process.env.GITHUB_REF) {
  console.log("Missing PR context; skipping comment.");
  process.exit(0);
}

const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
const ref = process.env.GITHUB_REF;
const prNumber = Number(process.env.GITHUB_REF?.split("/").pop()) || Number(process.env.PR_NUMBER || 0);

const octokit = new Octokit({ auth: token });

function readJSON(p: string): any | undefined {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return undefined; }
}

function readText(p: string): string | undefined {
  try { return fs.readFileSync(p, "utf8"); } catch { return undefined; }
}

function calculateCoverage(cov: any): { lines: string; statements: string } {
  if (!cov) return { lines: "—", statements: "—" };
  
  let totalLines = 0;
  let coveredLines = 0;
  let totalStatements = 0;
  let coveredStatements = 0;
  
  Object.values(cov).forEach((file: any) => {
    if (file.l) {
      Object.values(file.l).forEach((hit: any) => {
        totalLines++;
        if (hit > 0) coveredLines++;
      });
    }
    if (file.s) {
      Object.values(file.s).forEach((hit: any) => {
        totalStatements++;
        if (hit > 0) coveredStatements++;
      });
    }
  });
  
  const linesPct = totalLines > 0 ? (coveredLines * 100 / totalLines).toFixed(1) : "—";
  const stmtsPct = totalStatements > 0 ? (coveredStatements * 100 / totalStatements).toFixed(1) : "—";
  
  return { lines: linesPct, statements: stmtsPct };
}

const cov = readJSON(path.resolve("coverage.json"));
const gas = readText(path.resolve("gas-report.txt"));

const coverage = calculateCoverage(cov);
const linesPct = coverage.lines;
const stmtsPct = coverage.statements;
const gasTop = gas ? gas.split("\n").slice(0, 40).join("\n") : "No gas report found.";

const body = [
  "### ✅ CI Summary",
  "",
  `**Coverage:** lines **${linesPct}%**, statements **${stmtsPct}%**`,
  "",
  "<details><summary>Gas Report (top)</summary>",
  "",
  "```txt",
  gasTop,
  "```",
  "",
  "</details>"
].join("\n");

(async () => {
  try {
    if (!prNumber) {
      console.log("No PR number available; skipping comment.");
      return;
    }
    await octokit.issues.createComment({ owner, repo, issue_number: prNumber, body });
    console.log("Posted PR comment.");
  } catch (e) {
    console.log("PR comment skipped:", (e as Error).message);
  }
})();
