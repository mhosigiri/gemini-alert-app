<template>
  <router-view />
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
:root {
  --c-bg: #ffffff;
  --c-surface: #f5f5f5;
  --c-text: #000000;
  --c-text-soft: #555555;
  --c-border: #e0e0e0;
  --c-good: #22c55e;
  --c-bad: #ef4444;

  --fs-xs: 0.72rem;
  --fs-sm: 0.82rem;
  --fs-base: 0.92rem;
  --fs-md: 1.1rem;
  --fs-lg: 1.35rem;
  --fs-xl: 1.75rem;

  --sp-xs: 0.25rem;
  --sp-sm: 0.5rem;
  --sp-md: 1rem;
  --sp-lg: 1.5rem;
  --sp-xl: 2.5rem;

  --radius-pill: 999px;
  --radius-round: 24px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --c-bg: #000000;
    --c-surface: #111111;
    --c-text: #ffffff;
    --c-text-soft: #aaaaaa;
    --c-border: #222222;
  }
}

body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background-color: var(--c-bg);
  color: var(--c-text);
  line-height: 1.5;
}

#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
}

h1, h2, h3, h4, h5, h6 {
  margin-top: 0;
  margin-bottom: var(--sp-sm);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

button {
  cursor: pointer;
  font-family: inherit;
}

* {
  box-sizing: border-box;
}

input, textarea, select {
  font-family: inherit;
}

:focus-visible {
  outline: 2px solid var(--c-text);
  outline-offset: 2px;
}
</style>
