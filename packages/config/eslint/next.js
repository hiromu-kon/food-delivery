import nextVitals from 'eslint-config-next/core-web-vitals';
import { defineConfig } from 'eslint/config';

import base from './base.js';
import client from './client.js';

export default defineConfig([...nextVitals, ...base, ...client]);
