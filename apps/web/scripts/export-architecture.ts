/** Writes docs/architecture.svg from the same source as the case-study page: `pnpm architecture:svg`. */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { architectureSvg, STATIC_COLORS } from '../lib/architecture-svg';

const target = join(import.meta.dirname, '../../../docs/architecture.svg');
writeFileSync(target, `${architectureSvg(STATIC_COLORS)}\n`);
console.log(`Wrote ${target}`);
