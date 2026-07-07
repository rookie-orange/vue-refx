<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue"
import MyInput from "./MyInput.vue"

const input = ref<HTMLInputElement | null>(null)

onMounted(() => {
  input.value?.focus()
})
</script>

<template>
  <main>
    <label>
      Forwarded input
      <MyInput ref="input" />
    </label>
  </main>
</template>

<style scoped>
main {
  display: grid;
  min-height: 100vh;
  place-items: center;
  background: #f6f7f9;
  color: #111827;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}

label {
  display: grid;
  gap: 10px;
  width: min(360px, calc(100vw - 32px));
  font-size: 14px;
  font-weight: 600;
}
</style>
