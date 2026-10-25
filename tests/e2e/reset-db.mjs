// Starts every E2E run with an empty embedded database.
import { rmSync } from 'node:fs';

rmSync('.data/e2e', { recursive: true, force: true });
