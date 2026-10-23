<script lang="ts">
  import Icon from './Icon.svelte';
  import { actions, type ActionId } from './actions';
  let { dark, busy, onselect }: { dark: boolean; busy: ActionId | null; onselect: (id: ActionId) => void } = $props();
</script>

<div class="test-list">
  {#each actions as action}
    <button class="test-row" aria-label={action.id === 'theme' ? (dark ? 'Ativar tema claro' : 'Ativar tema escuro') : action.label} disabled={busy !== null} onclick={() => onselect(action.id)}>
      <span class="row-icon"><Icon name={action.id === 'theme' && dark ? 'moon' : action.icon} /></span>
      <span class="row-copy"><strong>{action.id === 'theme' ? (dark ? 'Ativar tema claro' : 'Ativar tema escuro') : action.title}</strong><span>{action.description}</span></span>
      <Icon name="chevron" size={18} />
    </button>
  {/each}
</div>
