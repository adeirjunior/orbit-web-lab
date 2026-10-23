<script module lang="ts">
  export type IconName = 'orbit' | 'toast' | 'bell' | 'layers' | 'sun' | 'moon' | 'download' | 'wifi' | 'expand' | 'play' | 'close' | 'check' | 'info' | 'arrow' | 'monitor';
</script>
<script lang="ts">
  let { name, size = 22 }: { name: IconName; size?: number } = $props();
  const paths: Record<string, string> = {
    toast: 'M4 4h16v16H4z M4 9h16 M8 13h5 M8 16h3',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
    layers: 'm12 3 10 6-10 6L2 9z M2 13l10 6 10-6 M2 17l10 6 10-6',
    sun: 'M12 1v2 M12 21v2 M1 12h2 M21 12h2 M4.2 4.2l1.4 1.4 M18.4 18.4l1.4 1.4 M4.2 19.8l1.4-1.4 M18.4 5.6l1.4-1.4',
    moon: 'M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z',
    download: 'M12 3v12 m-5-5 5 5 5-5 M4 15v5h16v-5',
    wifi: 'M2 8a16 16 0 0 1 20 0 M5 12a11 11 0 0 1 14 0 M8 16a6 6 0 0 1 8 0 M12 20h.01',
    expand: 'M8 3H3v5 M3 3l6 6 M16 3h5v5 M21 3l-6 6 M3 16v5h5 M3 21l6-6 M16 21h5v-5 M21 21l-6-6',
    play: 'm8 4 12 8-12 8z',
    close: 'm6 6 12 12 M6 18 18 6',
    check: 'm5 12 4 4L19 6',
    info: 'M12 11v6 M12 7h.01',
    arrow: 'M4 12h16 m-6-6 6 6-6 6',
    monitor: 'M3 3h18v14H3z M8 21h8 M12 17v4'
  };
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name === 'orbit'}
    <circle cx="12" cy="12" r="7" /><ellipse cx="12" cy="12" rx="12" ry="4.5" transform="rotate(-38 12 12)" /><circle cx="20" cy="4" r="2" fill="currentColor" stroke="none" />
  {:else}
    <path d={paths[name]} />
    {#if name === 'sun'}<circle cx="12" cy="12" r="5" />{/if}
    {#if name === 'info'}<circle cx="12" cy="12" r="9" />{/if}
  {/if}
</svg>
