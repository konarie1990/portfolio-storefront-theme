import fs from 'node:fs';
import path from 'node:path';

// 1. Environment Loading (Native Node.js without third-party dependencies)
function loadEnv(envPath = '.env') {
  const resolvedPath = path.resolve(process.cwd(), envPath);
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(resolvedPath);
      return;
    } catch {
      // Fallback to manual parser
    }
  }

  if (fs.existsSync(resolvedPath)) {
    const content = fs.readFileSync(resolvedPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || 'ron-hajewski-dev-theme.myshopify.com';
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:latest';

const GRAPHQL_ENDPOINT = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

// 2. Ollama Generator Helper
async function generateEnhancedCopy(sectionName, originalText) {
  const prompt = `You are a senior Shopify Plus architect and engineering leader refining copy for your developer portfolio storefront.
This entire storefront is built and maintained using autonomous multi-model AI coding agents.

Section: "${sectionName}"
Original Copy:
"""
${originalText}
"""

Guidelines for the Rewrite:
1. Highlight that this entire storefront is built and maintained using autonomous multi-model AI coding workflows.
2. Emphasize automation as a business accelerator. You MUST integrate this specific scenario:
   "I batch process product data to update the entire store in minutes rather than hours — imagine your company has a spreadsheet of product data updates and the bottleneck is making each one of those updates manually in the admin. I build automated pipelines that turn hours of tedious admin updates into a single script."
3. Tone: Confident, pragmatic, senior developer voice. Professional yet punchy.
4. If original was HTML (<p>...</p>), preserve valid HTML tags (<p>, <strong>, etc.). If original was plain text, output clean plain text without HTML tags.
5. Do NOT enclose your output in triple quotes, markdown code fences, or add conversational commentary. Return ONLY the rewritten text/HTML.`;

  const response = await fetch(OLLAMA_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.6,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama HTTP error ${response.status}: ${text}`);
  }

  const data = await response.json();
  let generatedText = (data.response || '').trim();
  generatedText = generatedText.replace(/^```(?:html)?\s*/i, '');
  generatedText = generatedText.replace(/\s*```$/i, '');
  generatedText = generatedText.replace(/^["'\s]+|["'\s]+$/g, '');
  return generatedText.trim();
}

// 3. Targets Definition
const TARGETS = [
  {
    id: 'index-hero',
    name: 'Homepage Hero Banner (templates/index.json)',
    file: 'templates/index.json',
    locator: (json) => {
      // Find image-banner text block in 6a3bb789-ce10-45f5-ae67-e2063ef8c76b
      const banner = json.sections?.['6a3bb789-ce10-45f5-ae67-e2063ef8c76b'];
      if (!banner) return null;
      for (const [blockId, block] of Object.entries(banner.blocks || {})) {
        if (block.type === 'text') {
          return {
            get: () => block.settings.text,
            set: (val) => { block.settings.text = val; },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'about-hero',
    name: 'About Me Banner Subtext (templates/page.about-me.json)',
    file: 'templates/page.about-me.json',
    locator: (json) => {
      const banner = json.sections?.['image_banner_pUkM6y'];
      if (!banner) return null;
      for (const [blockId, block] of Object.entries(banner.blocks || {})) {
        if (block.type === 'text') {
          return {
            get: () => block.settings.text,
            set: (val) => { block.settings.text = val; },
          };
        }
      }
      return null;
    },
  },
  {
    id: 'about-workflows',
    name: 'About Me - AI-Accelerated Workflows Accordion (templates/page.about-me.json)',
    file: 'templates/page.about-me.json',
    locator: (json) => {
      const accordion = json.sections?.['collapsible_content_rAkKXN'];
      if (!accordion) return null;
      const block = accordion.blocks?.['collapsible_row_38GhnM'];
      if (!block) return null;
      return {
        get: () => block.settings.row_content,
        set: (val) => { block.settings.row_content = val; },
      };
    },
  },
];

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const isDryRun = !isApply || args.includes('--dry-run');
  const targetArg = args.find(a => a.startsWith('--target='));
  const targetId = targetArg ? targetArg.split('=')[1] : 'index-hero';

  console.log('===============================================================');
  console.log(`Storewide Content Rewrite Pipeline`);
  console.log(`Mode:    ${isDryRun ? 'DRY-RUN (Safe Preview)' : 'APPLY (Write Changes)'}`);
  console.log(`Model:   ${OLLAMA_MODEL}`);
  console.log(`Target:  ${targetId}`);
  console.log('===============================================================\n');

  const selectedTargets = targetId === 'all' 
    ? TARGETS 
    : TARGETS.filter(t => t.id === targetId);

  if (selectedTargets.length === 0) {
    console.error(`Error: Unknown target "${targetId}". Valid targets: ${TARGETS.map(t => t.id).join(', ')}, all`);
    process.exit(1);
  }

  for (const target of selectedTargets) {
    console.log(`>>> Inspecting Target: ${target.name}`);
    const filePath = path.resolve(process.cwd(), target.file);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      continue;
    }

    const rawContent = fs.readFileSync(filePath, 'utf8');
    // Remove potential leading multi-line comments before parsing JSON
    const jsonStartIdx = rawContent.indexOf('{');
    const commentsPrefix = rawContent.slice(0, jsonStartIdx);
    const jsonContent = rawContent.slice(jsonStartIdx);

    const json = JSON.parse(jsonContent);
    const accessor = target.locator(json);

    if (!accessor) {
      console.error(`Could not locate target text block in ${target.file}`);
      continue;
    }

    const originalText = accessor.get();
    const isPlainTextField = !originalText.includes('<');
    console.log('\n--- [ORIGINAL COPY] ---');
    console.log(originalText);
    console.log('------------------------\n');

    console.log('Generating AI-enhanced automation copy with Ollama...');
    let rewrittenCopy = await generateEnhancedCopy(target.name, originalText);

    if (isPlainTextField) {
      rewrittenCopy = rewrittenCopy.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    console.log('\n+++ [REWRITTEN COPY] +++');
    console.log(rewrittenCopy);
    console.log('++++++++++++++++++++++++\n');

    if (isDryRun) {
      console.log(`[DRY-RUN] No files were modified. Run with --apply to commit this change.\n`);
    } else {
      console.log(`[APPLY] Writing updated copy to ${target.file}...`);
      accessor.set(rewrittenCopy);
      const updatedFullContent = commentsPrefix + JSON.stringify(json, null, 2) + '\n';
      fs.writeFileSync(filePath, updatedFullContent, 'utf8');
      console.log(`Successfully updated ${target.file}!\n`);
    }
  }

  console.log('Done.');
}

main().catch(err => {
  console.error('\nFatal Error:', err.message);
  process.exit(1);
});
