#!/usr/bin/env ts-node

/**
 * Fixture Freshness Check
 * 
 * Checks that frozen fixtures are not older than 30 days
 * Usage: ts-node scripts/fixtures/check.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const FIXTURE_DIR = path.join(process.cwd(), 'pricing-fixtures');
const MAX_AGE_DAYS = 30;

interface FixtureData {
  name: string;
  asOf: number;
}

function checkFixtureFreshness(): void {
  console.log("🔍 Checking frozen fixture freshness...");
  
  if (!fs.existsSync(FIXTURE_DIR)) {
    console.error("❌ Fixture directory not found:", FIXTURE_DIR);
    process.exit(1);
  }
  
  const files = fs.readdirSync(FIXTURE_DIR).filter(f => f.endsWith('-frozen.json'));
  
  if (files.length === 0) {
    console.error("❌ No frozen fixtures found");
    process.exit(1);
  }
  
  const currentTime = Math.floor(Date.now() / 1000);
  
  for (const file of files) {
    const fixturePath = path.join(FIXTURE_DIR, file);
    const fixtureData: FixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    
    const daysOld = Math.floor((currentTime - fixtureData.asOf) / 86400);
    
    console.log(`📅 ${fixtureData.name}: asOf=${fixtureData.asOf}, ${daysOld} days old`);
    
    if (daysOld > MAX_AGE_DAYS) {
      console.error(`❌ Fixture ${fixtureData.name} is ${daysOld} days old (>${MAX_AGE_DAYS} days)`);
      console.error("💡 Run: yarn fixtures:freeze && yarn fixtures:hashcheck");
      process.exit(1);
    }
  }
  
  console.log("✅ All frozen fixtures are fresh");
}

checkFixtureFreshness();
