<script lang="ts">
  // Só mostra o tempo contando. Quem sabe quanto foi estudado é o servidor:
  // a contagem parte do valor que veio na página e anda com o relógio local.
  interface Props {
    estudadoMs: number;
    pausado: boolean;
    trilha: string;
  }

  let { estudadoMs, pausado, trilha }: Props = $props();

  const carregadoEm = performance.now();
  let agora = $state(carregadoEm);

  $effect(() => {
    if (pausado) return;
    const id = setInterval(() => (agora = performance.now()), 250);
    return () => clearInterval(id);
  });

  const total = $derived(pausado ? estudadoMs : estudadoMs + (agora - carregadoEm));
  const segundos = $derived(Math.max(0, Math.floor(total / 1000)));
  const texto = $derived(
    [Math.floor(segundos / 3600), Math.floor(segundos / 60) % 60, segundos % 60]
      .map((n) => String(n).padStart(2, '0'))
      .join(':'),
  );

  // O tempo aparece também no título da aba do navegador.
  $effect(() => {
    document.title = `${pausado ? 'Pausado' : texto} · ${trilha}`;
  });
</script>

<time class="cronometro" class:pausado datetime={`PT${segundos}S`}>{texto}</time>

<style>
  .cronometro {
    display: block;
    font-size: clamp(3rem, 14vw, 5.5rem);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.04em;
    line-height: 1;
  }

  .pausado {
    color: var(--texto-suave);
  }
</style>
