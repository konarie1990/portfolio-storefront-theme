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
      // Fall back to manual parsing
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

if (!SHOPIFY_ADMIN_ACCESS_TOKEN) {
  console.error('Error: SHOPIFY_ADMIN_ACCESS_TOKEN is missing from .env or environment.');
  process.exit(1);
}

const GRAPHQL_ENDPOINT = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

// 2. GraphQL Helper
async function shopifyGraphQL(query, variables = {}) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify API HTTP error ${response.status} ${response.statusText}: ${text}`);
  }

  const json = await response.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors, null, 2)}`);
  }
  return json.data;
}

// 3. Ollama Generator Helper
async function generateProductDescription(productTitle) {
  const prompt = `You are a senior robotics hardware engineer writing official product catalog descriptions for an ultra-high-end developer portfolio and robotics components store.
The product title is: "${productTitle}"

Creative Guidelines:
- Tone: Slightly humorous, deadpan, and dry, but using authentic, legitimate-sounding robotics engineering terminology.
- Theme: Realistic robotics hardware, actuators, sensory arrays, kinematics, edge compute modules, and precision mechanics.
- Context: Developer portfolio store; products are fake but the technical specs must sound like real engineering documentation.
- Formatting: Clean, valid HTML ONLY (e.g., <p>...</p> and <ul><li><strong>Spec Name:</strong> details</li></ul>).
- Do NOT output markdown code blocks (do not wrap in \`\`\`html or \`\`\`).
- Output structure:
  1. An introductory paragraph (<p>...</p>) describing the module, its operational purpose, and a witty, dry observation on robotics or engineering reality.
  2. An unordered list (<ul>...</ul>) containing 3 to 4 technical specifications with bold titles (e.g. <li><strong>Operating Voltage:</strong> ...</li>, <li><strong>Kinematic Precision:</strong> ...</li>, <li><strong>Bus Protocol:</strong> CAN FD / EtherCAT</li>, <li><strong>Thermal Rating:</strong> ...</li>).
  3. A short closing paragraph (<p>...</p>) with an integration note or dry compliance/existential disclaimer.

Generate the HTML description now:`;

  const response = await fetch(OLLAMA_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama HTTP error ${response.status} ${response.statusText}: ${text}`);
  }

  const data = await response.json();
  let generatedText = data.response || '';

  // Clean any markdown code fences if Ollama added them
  generatedText = generatedText.replace(/^```(?:html)?\s*/i, '');
  generatedText = generatedText.replace(/\s*```$/i, '');
  return generatedText.trim();
}

// 4. Check for blank description
function isBlankDescription(descriptionHtml) {
  if (!descriptionHtml) return true;
  const stripped = descriptionHtml.replace(/<[^>]*>/g, '').trim();
  return stripped.length === 0;
}

// 5. Query Products
const GET_PRODUCTS_QUERY = `
query GetProducts {
  products(first: 50) {
    edges {
      node {
        id
        title
        descriptionHtml
        handle
      }
    }
  }
}
`;

// 6. Update Product Mutation
const UPDATE_PRODUCT_MUTATION = `
mutation UpdateProductDescription($input: ProductInput!) {
  productUpdate(input: $input) {
    product {
      id
      title
      descriptionHtml
    }
    userErrors {
      field
      message
    }
  }
}
`;

async function main() {
  const args = process.argv.slice(2);
  const isSingle = args.includes('--single');
  const isAll = args.includes('--all');
  const isDryRun = args.includes('--dry-run');

  if (!isSingle && !isAll && !isDryRun) {
    console.log(`
Usage:
  node scripts/update-product-descriptions.mjs --single [--dry-run]
  node scripts/update-product-descriptions.mjs --all [--dry-run]
  node scripts/update-product-descriptions.mjs --dry-run

Flags:
  --single    Process exactly one product with a blank description.
  --all       Process all products with blank descriptions.
  --dry-run   Generate copy and output mutation payload without updating Shopify.
`);
    process.exit(0);
  }

  console.log('Fetching products from Shopify Admin GraphQL API...');
  console.log(`Store: ${SHOPIFY_STORE_DOMAIN} (API Version: ${SHOPIFY_API_VERSION})`);
  
  const data = await shopifyGraphQL(GET_PRODUCTS_QUERY);
  const allProducts = data.products.edges.map(e => e.node);
  console.log(`Total products fetched: ${allProducts.length}`);

  const blankProducts = allProducts.filter(p => isBlankDescription(p.descriptionHtml));
  console.log(`Products with blank or empty descriptions: ${blankProducts.length}`);

  if (blankProducts.length === 0) {
    console.log('No products found with blank descriptions. Everything is up to date!');
    return;
  }

  const targets = isSingle ? [blankProducts[0]] : blankProducts;
  console.log(`Selected ${targets.length} product(s) for processing (Mode: ${isSingle ? 'SINGLE' : 'ALL'}).\n`);

  for (let i = 0; i < targets.length; i++) {
    const product = targets[i];
    console.log('=======================================================');
    console.log(`[${i + 1}/${targets.length}] Processing Product: ${product.title}`);
    console.log(`ID:     ${product.id}`);
    console.log(`Handle: ${product.handle}`);
    console.log(`Current Description: ${product.descriptionHtml ? JSON.stringify(product.descriptionHtml) : '(empty)'}`);
    console.log('Generating description with Ollama (' + OLLAMA_MODEL + ')...');

    const newDescriptionHtml = await generateProductDescription(product.title);

    console.log('\n--- Generated HTML Description ---');
    console.log(newDescriptionHtml);
    console.log('----------------------------------\n');

    const mutationVariables = {
      input: {
        id: product.id,
        descriptionHtml: newDescriptionHtml,
      },
    };

    if (isDryRun) {
      console.log('[DRY-RUN] Mutation payload prepared (NOT executing mutation):');
      console.log(JSON.stringify(mutationVariables, null, 2));
    } else {
      console.log(`Executing productUpdate mutation for product ${product.id}...`);
      const mutationResult = await shopifyGraphQL(UPDATE_PRODUCT_MUTATION, mutationVariables);
      const updateResult = mutationResult.productUpdate;

      if (updateResult.userErrors && updateResult.userErrors.length > 0) {
        console.error('Mutation UserErrors:', JSON.stringify(updateResult.userErrors, null, 2));
        throw new Error(`Failed to update product ${product.id}`);
      }

      console.log('Mutation succeeded!');
      console.log('Updated Product Result:', JSON.stringify(updateResult.product, null, 2));
    }
    console.log('=======================================================\n');
  }

  console.log('Task completed.');
}

main().catch(err => {
  console.error('\nFatal Error:', err.message);
  process.exit(1);
});
