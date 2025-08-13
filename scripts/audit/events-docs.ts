#!/usr/bin/env ts-node

/**
 * Events Documentation Generator
 * 
 * Walks artifacts and generates event documentation
 * Usage: ts-node scripts/audit/events-docs.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface EventInfo {
  contract: string;
  event: string;
  inputs: EventInput[];
  indexed: number;
  notes: string;
}

interface EventInput {
  name: string;
  type: string;
  indexed: boolean;
}

interface EventsInventory {
  timestamp: string;
  events: EventInfo[];
}

function parseABI(abi: any[]): EventInfo[] {
  const events: EventInfo[] = [];
  
  for (const item of abi) {
    if (item.type === 'event') {
      const inputs = item.inputs?.map((input: any) => ({
        name: input.name || 'unnamed',
        type: input.type,
        indexed: input.indexed || false
      })) || [];
      
      const indexedCount = inputs.filter((input: EventInput) => input.indexed).length;
      
      events.push({
        contract: '', // Will be set by caller
        event: item.name,
        inputs,
        indexed: indexedCount,
        notes: generateEventNotes(item.name, inputs)
      });
    }
  }
  
  return events;
}

function generateEventNotes(eventName: string, inputs: EventInput[]): string {
  const notes: string[] = [];
  
  // Common event patterns
  if (eventName.includes('Transfer')) {
    notes.push('Token transfer event');
  }
  if (eventName.includes('Approval')) {
    notes.push('Token approval event');
  }
  if (eventName.includes('Role')) {
    notes.push('Access control event');
  }
  if (eventName.includes('Paused') || eventName.includes('Unpaused')) {
    notes.push('Pause state change');
  }
  if (eventName.includes('Swap')) {
    notes.push('Swap operation event');
  }
  if (eventName.includes('Redeem')) {
    notes.push('Redemption event');
  }
  if (eventName.includes('Param')) {
    notes.push('Parameter update event');
  }
  if (eventName.includes('Emergency')) {
    notes.push('Emergency state change');
  }
  
  // Indexed inputs analysis
  const indexedInputs = inputs.filter(input => input.indexed);
  if (indexedInputs.length > 0) {
    notes.push(`${indexedInputs.length} indexed inputs for efficient filtering`);
  }
  
  return notes.join('; ');
}

function scanArtifacts(): EventInfo[] {
  const events: EventInfo[] = [];
  const artifactsDir = path.join(process.cwd(), 'artifacts', 'contracts');
  
  if (!fs.existsSync(artifactsDir)) {
    console.warn('Artifacts contracts directory not found');
    return events;
  }
  
  try {
    const contractDirs = fs.readdirSync(artifactsDir);
    
    for (const contractDir of contractDirs) {
      const contractPath = path.join(artifactsDir, contractDir);
      const stat = fs.statSync(contractPath);
      
      if (stat.isDirectory()) {
        const files = fs.readdirSync(contractPath);
        
        for (const file of files) {
          if (file.endsWith('.json') && !file.includes('dbg')) {
            const artifactPath = path.join(contractPath, file);
            const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
            
            if (artifact.abi && Array.isArray(artifact.abi)) {
              const contractName = path.basename(file, '.json');
              const contractEvents = parseABI(artifact.abi);
              
              // Set contract name for each event
              for (const event of contractEvents) {
                event.contract = contractName;
              }
              
              events.push(...contractEvents);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error scanning artifacts:', error);
  }
  
  return events;
}

function generateMarkdownTable(events: EventInfo[]): string {
  let markdown = '# Contract Events\n\n';
  markdown += 'This document is auto-generated from contract ABIs.\n\n';
  markdown += '| Contract | Event | Inputs | Indexed | Notes |\n';
  markdown += '|----------|-------|--------|---------|-------|\n';
  
  // Sort events by contract, then by event name
  const sortedEvents = events.sort((a, b) => {
    if (a.contract !== b.contract) {
      return a.contract.localeCompare(b.contract);
    }
    return a.event.localeCompare(b.event);
  });
  
  for (const event of sortedEvents) {
    const inputs = event.inputs.map(input => 
      `${input.name}: ${input.type}${input.indexed ? ' (indexed)' : ''}`
    ).join(', ');
    
    markdown += `| ${event.contract} | ${event.event} | ${inputs} | ${event.indexed} | ${event.notes} |\n`;
  }
  
  return markdown;
}

function generateEventsInventory(events: EventInfo[]): EventsInventory {
  return {
    timestamp: new Date().toISOString(),
    events
  };
}

function writeEventsDocumentation(events: EventInfo[]): void {
  const distDir = path.join(process.cwd(), 'dist', 'audit');
  const docsDir = path.join(process.cwd(), 'docs');
  const eventsPath = path.join(distDir, 'events.json');
  const markdownPath = path.join(docsDir, 'CONTRACT_EVENTS.md');
  
  // Ensure directories exist
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
  
  // Write JSON inventory
  const inventory = generateEventsInventory(events);
  fs.writeFileSync(eventsPath, JSON.stringify(inventory, null, 2));
  console.log(`Generated events inventory: ${eventsPath}`);
  
  // Write Markdown documentation
  const markdown = generateMarkdownTable(events);
  fs.writeFileSync(markdownPath, markdown);
  console.log(`Generated events documentation: ${markdownPath}`);
}

function main() {
  try {
    console.log('Generating events documentation...');
    const events = scanArtifacts();
    writeEventsDocumentation(events);
    
    console.log(`# Events documentation generated`);
    console.log(`# Events found: ${events.length}`);
    console.log(`# Contracts: ${new Set(events.map(e => e.contract)).size}`);
    
  } catch (error) {
    console.error('Error generating events documentation:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

