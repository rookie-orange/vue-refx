<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import AdvancedField from "./AdvancedField.vue";
import MyInput from "./MyInput.vue";

interface AdvancedFieldHandle {
  focus(): void;
  blur(): void;
  select(): void;
  clear(): void;
  fill(value: string): void;
  getValue(): string;
}

const basicInput = ref<HTMLInputElement | null>(null);
const advancedApi = ref<AdvancedFieldHandle | null>(null);
const advancedInput = ref<HTMLInputElement | null>(null);
const lastParentAction = ref("waiting for mount");
const sampleIndex = ref(0);

const samples = ["Forwarded ref is live", "Factory expose merged", "Vue runtime stays untouched"];

function setAdvancedInput(element: HTMLInputElement | null) {
  advancedInput.value = element;
}

function focusBasicInput() {
  basicInput.value?.focus();
  lastParentAction.value = "basic DOM focus";
}

function focusAdvanced() {
  advancedApi.value?.focus();
  lastParentAction.value = "factory focus";
}

function selectAdvanced() {
  advancedApi.value?.select();
  lastParentAction.value = "factory select";
}

function fillAdvanced() {
  const nextValue = samples[sampleIndex.value % samples.length];

  sampleIndex.value += 1;
  advancedApi.value?.fill(nextValue);
  lastParentAction.value = `fill: ${nextValue}`;
}

function clearAdvanced() {
  advancedApi.value?.clear();
  lastParentAction.value = "factory clear";
}

function blurAdvanced() {
  advancedApi.value?.blur();
  lastParentAction.value = "factory blur";
}

function readAdvancedValue() {
  lastParentAction.value = `read: ${advancedApi.value?.getValue() || "empty"}`;
}

onMounted(() => {
  focusBasicInput();
});
</script>

<template>
  <main class="playground">
    <section class="workbench" aria-labelledby="title">
      <header class="masthead">
        <div>
          <p>vue-refx</p>
          <h1 id="title">Forwarded Ref Playground</h1>
        </div>
        <output>{{ lastParentAction }}</output>
      </header>

      <div class="grid">
        <section class="panel basic-panel">
          <div class="panel-title">
            <span>01</span>
            <h2>DOM ref</h2>
          </div>

          <label class="field-label">
            Forwarded input
            <MyInput ref="basicInput" />
          </label>

          <button type="button" @click="focusBasicInput">Focus DOM input</button>
        </section>

        <section class="panel advanced-panel">
          <div class="panel-title">
            <span>02</span>
            <h2>Factory handle</h2>
          </div>

          <AdvancedField ref="advancedApi" :__forwarded_ref__="setAdvancedInput" />

          <div class="actions" aria-label="Factory commands">
            <button type="button" @click="focusAdvanced">Focus</button>
            <button type="button" @click="selectAdvanced">Select</button>
            <button type="button" @click="fillAdvanced">Fill</button>
            <button type="button" @click="clearAdvanced">Clear</button>
            <button type="button" @click="blurAdvanced">Blur</button>
            <button type="button" @click="readAdvancedValue">Read</button>
          </div>

          <dl class="inspector">
            <div>
              <dt>Forwarded DOM</dt>
              <dd>{{ advancedInput?.tagName?.toLowerCase() || "none" }}</dd>
            </div>
            <div>
              <dt>Exposed API</dt>
              <dd>{{ advancedApi ? "ready" : "pending" }}</dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  </main>
</template>

<style scoped>
.playground {
  --paper: #eef2ef;
  --ink: #17211d;
  --muted: #65726d;
  --line: #dde5e1;
  --line-strong: #bccac4;
  --accent-blue: #1e6bff;
  --accent-green: #13a66f;
  --accent-orange: #f26a3d;

  display: grid;
  min-height: 100vh;
  place-items: center;
  background:
    linear-gradient(90deg, rgb(23 33 29 / 5%) 1px, transparent 1px),
    linear-gradient(180deg, rgb(23 33 29 / 5%) 1px, transparent 1px), var(--paper);
  background-size: 34px 34px;
  color: var(--ink);
  font-family: "Avenir Next", "Segoe UI", ui-sans-serif, sans-serif;
  padding: 32px;
}

.workbench {
  width: min(980px, 100%);
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background: rgb(255 255 255 / 82%);
  box-shadow: 0 24px 80px rgb(25 32 30 / 16%);
  overflow: hidden;
}

.masthead {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 1px solid var(--line);
  background:
    linear-gradient(120deg, rgb(30 107 255 / 11%), transparent 34%),
    linear-gradient(260deg, rgb(242 106 61 / 12%), transparent 36%), #fbfdfc;
  padding: 24px;
}

.masthead p,
.masthead h1 {
  margin: 0;
}

.masthead p {
  color: var(--accent-orange);
  font-size: 12px;
  font-weight: 850;
  text-transform: uppercase;
}

.masthead h1 {
  margin-top: 6px;
  font-size: 28px;
  font-weight: 850;
  line-height: 1.05;
}

.masthead output {
  max-width: 320px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #ffffff;
  color: var(--muted);
  font-size: 13px;
  font-weight: 800;
  padding: 9px 13px;
  text-align: right;
}

.grid {
  display: grid;
  grid-template-columns: minmax(260px, 0.78fr) minmax(340px, 1.22fr);
}

.panel {
  display: grid;
  align-content: start;
  gap: 18px;
  min-width: 0;
  padding: 24px;
}

.basic-panel {
  border-right: 1px solid var(--line);
  background: #f8faf9;
}

.advanced-panel {
  background: #ffffff;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-title span {
  display: inline-grid;
  place-items: center;
  block-size: 28px;
  inline-size: 28px;
  border-radius: 999px;
  background: var(--ink);
  color: #ffffff;
  font-size: 12px;
  font-weight: 900;
}

.panel-title h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 850;
}

.field-label {
  display: grid;
  gap: 10px;
  color: #26312d;
  font-size: 13px;
  font-weight: 800;
}

button {
  min-block-size: 40px;
  border: 1px solid var(--line-strong);
  border-radius: 7px;
  background: #17211d;
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 850;
  padding: 0 14px;
  transition:
    background 140ms ease,
    border-color 140ms ease,
    transform 140ms ease;
}

button:hover {
  background: #24312c;
  border-color: #24312c;
  transform: translateY(-1px);
}

button:focus-visible {
  outline: 3px solid rgb(30 107 255 / 22%);
  outline-offset: 2px;
}

.actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.actions button:nth-child(3) {
  background: var(--accent-blue);
  border-color: var(--accent-blue);
}

.actions button:nth-child(4) {
  background: var(--accent-orange);
  border-color: var(--accent-orange);
}

.inspector {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

.inspector > div {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: #f8faf9;
  padding: 11px;
}

dt {
  color: var(--muted);
  font-size: 11px;
  font-weight: 850;
  text-transform: uppercase;
}

dd {
  margin: 5px 0 0;
  color: var(--ink);
  font-size: 14px;
  font-weight: 850;
}

@media (max-width: 760px) {
  .playground {
    padding: 18px;
  }

  .masthead {
    align-items: start;
    flex-direction: column;
  }

  .masthead output {
    max-width: none;
    text-align: left;
    width: 100%;
    box-sizing: border-box;
  }

  .grid,
  .actions,
  .inspector {
    grid-template-columns: 1fr;
  }

  .basic-panel {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
}
</style>
