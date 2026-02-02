<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div id="app">
    <RouterView />
  </div>
</template>

<style>
/* Global styles for ADHD Focus Reader */
* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #000;
  color: #fff;
  overflow-x: hidden;
}

#app {
  min-height: 100vh;
}

/* Remove default button and input styles */
button, input, textarea {
  font-family: inherit;
  outline: none;
}

button:focus-visible, input:focus-visible, textarea:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

/* Ensure high contrast for accessibility */
::selection {
  background: #fff;
  color: #000;
}
</style>
