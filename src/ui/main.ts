import { mount } from 'svelte';
import { RAIL_WIDTH, TITLE_BAR_HEIGHT } from '../shared/chrome.ts';
import './tokens.css';
import './dialog.css';
import App from './App.svelte';
import Overlay from './Overlay.svelte';
import FindBar from './FindBar.svelte';

const target = document.getElementById('app');
if ( !target ) throw new Error('index.html has no #app');

// main lays the service views out from the same numbers
document.documentElement.style.setProperty('--rx-rail-width', RAIL_WIDTH + 'px');
document.documentElement.style.setProperty('--rx-titlebar-height', TITLE_BAR_HEIGHT + 'px');

const viewOverServices = { '#overlay': Overlay, '#find': FindBar }[location.hash];
document.documentElement.classList.toggle('overlay', viewOverServices !== undefined);
mount(viewOverServices ?? App, { target });
