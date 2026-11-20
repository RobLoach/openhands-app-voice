// Canvas loads an app from one file, so the modules in src/ and Readium
// Speech, with the voice data it loads per language, are built into
// extension.js, which is checked in for Canvas to install. The licenses of
// the packages it bundles go beside it, in THIRD_PARTY_LICENSES.txt.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const LICENSES = 'THIRD_PARTY_LICENSES.txt';

// A package's license file, or else what its package.json says.
function licenseOf(name) {
  const dir = join('node_modules', name);
  const meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const file = readdirSync(dir).find((entry) => /^licen[cs]e/i.test(entry));
  const text = file
    ? readFileSync(join(dir, file), 'utf8').trim()
    : `${meta.license}${meta.author ? `, ${meta.author.name ?? meta.author}` : ''}`;
  return `${name}@${meta.version}\n\n${text}`;
}

function thirdPartyLicenses() {
  return {
    name: 'third-party-licenses',
    writeBundle(options, bundle) {
      const names = new Set();
      for (const chunk of Object.values(bundle)) {
        for (const id of Object.keys(chunk.modules ?? {})) {
          const name = [...id.matchAll(/node_modules\/((?:@[^/]+\/)?[^/@.][^/]*)/g)].at(-1)?.[1];
          if (name && existsSync(join('node_modules', name, 'package.json'))) names.add(name);
        }
      }
      const texts = [...names].sort().map(licenseOf);
      writeFileSync(
        LICENSES,
        `extension.js bundles these packages, under their licenses:\n\n${texts.join(`\n\n${'-'.repeat(72)}\n\n`)}\n`,
      );
    },
  };
}

export default {
  input: 'src/index.js',
  plugins: [nodeResolve({ browser: true }), thirdPartyLicenses()],
  // Readium's own dependencies warn about their circular imports and their
  // TypeScript helpers' "this", which they don't rely on.
  onwarn(warning, warn) {
    const ids = [warning.id, ...(warning.ids ?? [])].join();
    const quiet = ['CIRCULAR_DEPENDENCY', 'THIS_IS_UNDEFINED'].includes(warning.code);
    if (!(quiet && ids.includes('node_modules'))) warn(warning);
  },
  output: {
    file: 'extension.js',
    format: 'es',
    inlineDynamicImports: true,
    banner: `// Built from src/ and @readium/speech by \`npm run build\`; edit src/ instead.\n// It bundles packages under their own licenses, in ${LICENSES}.`,
  },
};
