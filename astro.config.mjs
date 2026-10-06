// @ts-check
import { defineConfig, envField } from 'astro/config';
import svelte from '@astrojs/svelte';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [svelte()],
  env: {
    schema: {
      // Lida em tempo de execução, só no servidor; nunca vai para o navegador.
      EMAILS_PERMITIDOS: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
