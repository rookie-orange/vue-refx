<script setup lang="ts">
import { defineForwardRef } from "vue-refx";

defineForwardRef("input");
</script>

<template>
  <input ref="input" placeholder="Focus is forwarded from the parent ref" />
</template>

<style scoped>
input {
  box-sizing: border-box;
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--line-strong, #cbd5e1);
  border-radius: 6px;
  background: #ffffff;
  color: #17211d;
  font: inherit;
  padding: 0 12px;
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease,
    transform 140ms ease;
}

input:focus {
  border-color: #1e6bff;
  box-shadow: 0 0 0 3px rgb(30 107 255 / 16%);
  outline: none;
}

input:hover {
  transform: translateY(-1px);
}
</style>
