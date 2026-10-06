<script lang="ts">
  // Barra de progresso estática (sem JS no cliente): o servidor já sabe o valor.
  interface Props {
    valor: number;
    maximo: number;
    // Nome acessível da barra, ex.: "Progresso do Objetivo".
    rotulo: string;
    // O valor em palavras, lido pelo leitor de tela, ex.: "4h 30min de 10h".
    texto: string;
    apagada?: boolean;
  }

  let { valor, maximo, rotulo, texto, apagada = false }: Props = $props();

  const fracao = $derived(maximo > 0 ? Math.min(1, Math.max(0, valor / maximo)) : 0);
</script>

<div
  class="barra"
  class:apagada
  class:comecou={valor > 0}
  role="progressbar"
  aria-label={rotulo}
  aria-valuemin={0}
  aria-valuemax={maximo}
  aria-valuenow={Math.min(valor, maximo)}
  aria-valuetext={texto}
  style:--fracao={fracao}
></div>

<style>
  .barra {
    height: 0.5rem;
    border-radius: 999px;
    background: var(--linha);
  }

  .barra::before {
    content: '';
    display: block;
    width: calc(var(--fracao) * 100%);
    height: 100%;
    border-radius: inherit;
    background: var(--destaque);
  }

  /* Qualquer minuto estudado já aparece na barra: toda hora conta. */
  .comecou::before {
    min-width: 0.5rem;
  }

  .apagada::before {
    background: var(--texto-suave);
  }
</style>
