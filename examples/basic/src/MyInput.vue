<script setup lang="ts">
import { useForwardedRef } from "vue-forward-ref"

const ref = useForwardedRef<HTMLInputElement>()
</script>

<template>
  <input :ref="ref" />
</template>
