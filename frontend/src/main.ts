import App from './App.svelte';
import Rules from './pages/Rules.svelte';

// Simple routing: check if we're on the rules page
const path = window.location.pathname;
let app;

if (path === '/rules') {
  app = new Rules({
    target: document.getElementById('app')!
  });
} else {
  app = new App({
    target: document.getElementById('app')!
  });
}

export default app;
