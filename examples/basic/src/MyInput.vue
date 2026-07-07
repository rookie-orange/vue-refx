<script setup lang="ts">
import { useForwardedRef } from "vue-refx";

const ref = useForwardedRef<HTMLInputElement>();
</script>

<template>
  <input :ref="ref" />
</template>
