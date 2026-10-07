import { serve } from '@hono/node-server';
import {app} from './app.js';

serve({ fetch: app.fetch, port: 3000 });
console.log('Webhook server on http://localhost:3000');