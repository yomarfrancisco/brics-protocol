const fs = require('fs');

// Read the Slither JSON output
const slither = JSON.parse(fs.readFileSync('audit/slither.json', 'utf8'));

// Filter for high severity findings
const highs = slither.results.detectors.filter(r => 
  r.check === 'divide-before-multiply' || 
  r.check === 'missing-zero-address-validation' || 
  r.check === 'calls-inside-a-loop'
);

// Create filtered JSON
fs.writeFileSync('audit/slither-highs.json', JSON.stringify({results: {detectors: highs}}, null, 2));

// Create markdown report
let md = '# Slither High Severity Findings\n\n';
md += 'This report contains only high severity findings that need immediate attention.\n\n';

highs.forEach((finding, i) => {
  const contract = finding.elements[0]?.name || 'Unknown';
  const functionName = finding.elements[0]?.type === 'function' ? finding.elements[0].name : 'N/A';
  const sourceFile = finding.elements[0]?.source_mapping?.filename_relative || 'Unknown';
  const line = finding.elements[0]?.source_mapping?.lines?.[0] || 'Unknown';
  
  md += `## ${i+1}. ${finding.check} - ${contract}\n\n`;
  md += `**Severity:** ${finding.impact}\n`;
  md += `**Contract:** ${contract}\n`;
  md += `**Function:** ${functionName}\n`;
  md += `**Source:** ${sourceFile}:${line}\n\n`;
  
  if (finding.description) {
    md += `**Description:** ${finding.description}\n\n`;
  }
  
  if (finding.elements && finding.elements.length > 0) {
    md += `**Code Snippet:**\n`;
    finding.elements.forEach(elem => {
      if (elem.type === 'node') {
        md += `\`\`\`solidity\n${elem.name}\n\`\`\`\n\n`;
      }
    });
  }
  
  md += `**Risk Summary:** ${finding.description || 'High severity security issue requiring immediate attention.'}\n\n`;
  md += '---\n\n';
});

fs.writeFileSync('audit/slither-highs.md', md);
console.log(`Extracted ${highs.length} high severity findings`);
