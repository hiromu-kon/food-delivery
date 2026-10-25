import expoConfig from 'eslint-config-expo/flat.js';
import { defineConfig } from 'eslint/config';

import base from './base.js';
import client from './client.js';

export default defineConfig([...expoConfig, ...base, ...client]);
