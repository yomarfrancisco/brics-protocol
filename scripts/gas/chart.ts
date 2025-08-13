#!/usr/bin/env ts-node

/**
 * Gas Trend Chart Generator
 * 
 * Generates time-series charts from gas trend CSV data
 * Usage: ts-node scripts/gas/chart.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface GasDataPoint {
  date: string;
  sha: string;
  suite: string;
  function: string;
  gas: number;
}

const GAS_CSV_PATH = path.join(process.cwd(), 'dist', 'gas', 'gas-trend.csv');
const CHART_SVG_PATH = path.join(process.cwd(), 'dist', 'gas', 'gas-trend.svg');

function parseCSV(): GasDataPoint[] {
  if (!fs.existsSync(GAS_CSV_PATH)) {
    console.error("❌ Gas trend CSV not found:", GAS_CSV_PATH);
    return [];
  }
  
  const csv = fs.readFileSync(GAS_CSV_PATH, 'utf8');
  const lines = csv.split('\n').filter(line => line.trim());
  const data: GasDataPoint[] = [];
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 5) {
      data.push({
        date: parts[0],
        sha: parts[1],
        suite: parts[2],
        function: parts[3],
        gas: parseInt(parts[4])
      });
    }
  }
  
  return data;
}

function generateSVGChart(data: GasDataPoint[]): string {
  if (data.length === 0) {
    return '<svg width="800" height="400"><text x="400" y="200" text-anchor="middle">No data available</text></svg>';
  }
  
  const width = 800;
  const height = 400;
  const margin = { top: 20, right: 20, bottom: 60, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  
  // Group by function for different colors
  const functions = [...new Set(data.map(d => d.function))];
  const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b'];
  
  // Calculate scales
  const dates = [...new Set(data.map(d => d.date))].sort();
  const gasValues = data.map(d => d.gas);
  const minGas = Math.min(...gasValues);
  const maxGas = Math.max(...gasValues);
  
  const xScale = (date: string) => {
    const index = dates.indexOf(date);
    return margin.left + (index / (dates.length - 1)) * chartWidth;
  };
  
  const yScale = (gas: number) => {
    return margin.top + chartHeight - ((gas - minGas) / (maxGas - minGas)) * chartHeight;
  };
  
  // Generate SVG
  let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">\n`;
  
  // Background
  svg += `  <rect width="${width}" height="${height}" fill="#f8f9fa"/>\n`;
  
  // Title
  svg += `  <text x="${width/2}" y="15" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold">Gas Usage Trends</text>\n`;
  
  // Y-axis
  svg += `  <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + chartHeight}" stroke="#333" stroke-width="2"/>\n`;
  svg += `  <text x="${margin.left - 10}" y="${margin.top + chartHeight/2}" text-anchor="end" transform="rotate(-90 ${margin.left - 10} ${margin.top + chartHeight/2})" font-family="Arial" font-size="12">Gas Usage</text>\n`;
  
  // X-axis
  svg += `  <line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${margin.left + chartWidth}" y2="${margin.top + chartHeight}" stroke="#333" stroke-width="2"/>\n`;
  
  // Plot data points
  functions.forEach((func, funcIndex) => {
    const funcData = data.filter(d => d.function === func);
    const color = colors[funcIndex % colors.length];
    
    // Draw lines
    for (let i = 1; i < funcData.length; i++) {
      const prev = funcData[i-1];
      const curr = funcData[i];
      svg += `  <line x1="${xScale(prev.date)}" y1="${yScale(prev.gas)}" x2="${xScale(curr.date)}" y2="${yScale(curr.gas)}" stroke="${color}" stroke-width="2"/>\n`;
    }
    
    // Draw points
    funcData.forEach(point => {
      svg += `  <circle cx="${xScale(point.date)}" cy="${yScale(point.gas)}" r="3" fill="${color}"/>\n`;
    });
  });
  
  // Legend
  functions.forEach((func, funcIndex) => {
    const color = colors[funcIndex % colors.length];
    const y = margin.top + chartHeight + 20 + (funcIndex * 20);
    svg += `  <rect x="${margin.left}" y="${y-5}" width="15" height="10" fill="${color}"/>\n`;
    svg += `  <text x="${margin.left + 20}" y="${y}" font-family="Arial" font-size="10">${func}</text>\n`;
  });
  
  svg += '</svg>';
  return svg;
}

function main(): void {
  console.log("📊 Generating gas trend chart...");
  
  const data = parseCSV();
  if (data.length === 0) {
    console.warn("⚠️  No data to chart");
    return;
  }
  
  const svg = generateSVGChart(data);
  
  // Ensure directory exists
  const chartDir = path.dirname(CHART_SVG_PATH);
  if (!fs.existsSync(chartDir)) {
    fs.mkdirSync(chartDir, { recursive: true });
  }
  
  fs.writeFileSync(CHART_SVG_PATH, svg);
  console.log(`✅ Chart generated: ${CHART_SVG_PATH}`);
  console.log(`📈 Data points: ${data.length}`);
  console.log(`📅 Date range: ${data[0].date} to ${data[data.length-1].date}`);
}

main();
