<script setup lang="ts">
import { computed, ref } from "vue";
import { defineForwardRef } from "vue-refx";

const value = ref("Compile-time factory");
const focused = ref(false);
const lastAction = ref("mounted");

function focus() {
  inputEl.value?.focus();
  lastAction.value = "focus()";
}

function blur() {
  inputEl.value?.blur();
  lastAction.value = "blur()";
}

function select() {
  inputEl.value?.select();
  lastAction.value = "select()";
}

function clear() {
  value.value = "";
  focus();
  lastAction.value = "clear()";
}

function fill(nextValue: string) {
  value.value = nextValue;
  focus();
  lastAction.value = "fill(value)";
}

function getValue() {
  return value.value;
}

const inputEl = defineForwardRef<HTMLInputElement>("input", () => ({
  focus,
  blur,
  select,
  clear,
  fill,
  getValue,
}));

const strength = computed(() => Math.min(100, Math.max(12, value.value.length * 7)));

function setFocused(nextFocused: boolean) {
  focused.value = nextFocused;
  lastAction.value = nextFocused ? "focus event" : "blur event";
}
</script>

<template>
  <section class="field-console" :data-focused="focused">
    <div class="console-header">
      <span class="status-dot" />
      <span>{{ focused ? "Focused" : "Idle" }}</span>
    </div>

    <label class="field-shell">
      <span>Command input</span>
      <input
        ref="input"
        v-model="value"
        placeholder="Type a forwarded value"
        @blur="setFocused(false)"
        @focus="setFocused(true)"
      />
    </label>

    <div class="value-meter" aria-hidden="true">
      <span :style="{ inlineSize: `${strength}%` }" />
    </div>

    <dl>
      <div>
        <dt>Value</dt>
        <dd>{{ value || "empty" }}</dd>
      </div>
      <div>
        <dt>Last</dt>
        <dd>{{ lastAction }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.field-console {
  display: grid;
  gap: 14px;
  border: 1px solid var(--line-strong, #cbd5d1);
  border-radius: 8px;
  background: linear-gradient(135deg, rgb(255 255 255 / 94%), rgb(245 248 246 / 92%)), #ffffff;
  box-shadow: 0 18px 42px rgb(17 24 22 / 10%);
  padding: 16px;
}

.console-header {
  align-items: center;
  color: #52605b;
  display: flex;
  font-size: 12px;
  font-weight: 800;
  gap: 8px;
  text-transform: uppercase;
}

.status-dot {
  block-size: 9px;
  border-radius: 999px;
  inline-size: 9px;
  background: #9aa8a1;
  box-shadow: 0 0 0 4px rgb(154 168 161 / 16%);
}

.field-console[data-focused="true"] .status-dot {
  background: #13a66f;
  box-shadow: 0 0 0 4px rgb(19 166 111 / 18%);
}

.field-shell {
  display: grid;
  gap: 8px;
  color: #26312d;
  font-size: 13px;
  font-weight: 800;
}

input {
  box-sizing: border-box;
  min-block-size: 46px;
  inline-size: 100%;
  border: 1px solid #b8c6c0;
  border-radius: 7px;
  background: #fbfefd;
  color: #17211d;
  font: inherit;
  font-size: 15px;
  font-weight: 650;
  padding: 0 13px;
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease,
    transform 140ms ease;
}

input:focus {
  border-color: #13a66f;
  box-shadow: 0 0 0 3px rgb(19 166 111 / 18%);
  outline: none;
  transform: translateY(-1px);
}

.value-meter {
  block-size: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #dfe7e3;
}

.value-meter span {
  display: block;
  block-size: 100%;
  min-inline-size: 12%;
  border-radius: inherit;
  background: linear-gradient(90deg, #13a66f, #1e6bff 58%, #f26a3d);
  transition: inline-size 180ms ease;
}

dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
}

dl > div {
  min-inline-size: 0;
  border: 1px solid #dde5e1;
  border-radius: 7px;
  background: #f7faf8;
  padding: 10px;
}

dt {
  color: #6a7671;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

dd {
  overflow: hidden;
  margin: 4px 0 0;
  color: #17211d;
  font-size: 13px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
