<script setup lang="ts">
const ref = useRefProp<HTMLInputElement>()
</script>

<template>
  <input :ref="ref" placeholder="Focus is forwarded from the parent ref" />
</template>

<style scoped>
input {
  min-height: 42px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 0 12px;
  font: inherit;
}

input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgb(37 99 235 / 18%);
  outline: none;
}
</style>
