<script setup lang="ts">
import { ref } from "vue"
import MyInput from "./MyInput.vue"

const input = ref<HTMLInputElement | null>(null)
</script>

<template>
  <MyInput ref="input" />
  <button type="button" @click="input?.focus()">Focus</button>
</template>
