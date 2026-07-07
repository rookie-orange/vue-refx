<script setup lang="ts">
const ref = useRefProp<HTMLInputElement>()
</script>

<template>
  <input :ref="ref" />
</template>
