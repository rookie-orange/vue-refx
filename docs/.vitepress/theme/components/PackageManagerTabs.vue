<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

const props = withDefaults(
  defineProps<{
    packageName?: string;
    defaultManager?: PackageManager;
  }>(),
  {
    packageName: "vue-refx",
    defaultManager: "npm",
  },
);

const storageKey = "vue-refx-package-manager";
const packageManagers = computed(() => [
  { id: "npm" as const, label: "npm", command: `npm install ${props.packageName}` },
  { id: "pnpm" as const, label: "pnpm", command: `pnpm add ${props.packageName}` },
  { id: "yarn" as const, label: "yarn", command: `yarn add ${props.packageName}` },
  { id: "bun" as const, label: "bun", command: `bun add ${props.packageName}` },
]);

const activeManager = ref<PackageManager>(props.defaultManager);

const activeCommand = computed(
  () =>
    packageManagers.value.find((manager) => manager.id === activeManager.value)?.command ??
    packageManagers.value[0].command,
);

function selectManager(manager: PackageManager) {
  activeManager.value = manager;
}

function selectRelativeManager(offset: number) {
  const currentIndex = packageManagers.value.findIndex((manager) => manager.id === activeManager.value);
  const nextIndex = (currentIndex + offset + packageManagers.value.length) % packageManagers.value.length;
  activeManager.value = packageManagers.value[nextIndex].id;
}

onMounted(() => {
  const savedManager = localStorage.getItem(storageKey);

  if (packageManagers.value.some((manager) => manager.id === savedManager)) {
    activeManager.value = savedManager as PackageManager;
  }
});

watch(activeManager, (manager) => {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(storageKey, manager);
  }
});
</script>

<template>
  <div class="PackageManagerTabs">
    <div class="tabs" role="tablist" aria-label="package managers">
      <button
        v-for="manager in packageManagers"
        :key="manager.id"
        type="button"
        class="tab"
        :class="{ active: manager.id === activeManager }"
        role="tab"
        :aria-selected="manager.id === activeManager"
        @click="selectManager(manager.id)"
        @keydown.left.prevent="selectRelativeManager(-1)"
        @keydown.right.prevent="selectRelativeManager(1)"
      >
        {{ manager.label }}
      </button>
    </div>

    <pre class="command"><code>{{ activeCommand }}</code></pre>
  </div>
</template>

<style scoped>
.PackageManagerTabs {
  margin: 16px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  background: var(--vp-code-block-bg);
}

.tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  padding: 0 10px;
  border-bottom: 1px solid var(--vp-c-divider);
  overflow-x: auto;
  background: var(--vp-c-bg-soft);
}

.tab {
  position: relative;
  flex: 0 0 auto;
  height: 40px;
  padding: 0 10px;
  border: 0;
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  font-weight: 600;
  line-height: 40px;
  background: transparent;
  cursor: pointer;
}

.tab::after {
  position: absolute;
  right: 8px;
  bottom: -1px;
  left: 8px;
  height: 2px;
  border-radius: 2px;
  background: transparent;
  content: "";
}

.tab:hover {
  color: var(--vp-c-text-1);
}

.tab:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -4px;
  border-radius: 6px;
}

.tab.active {
  color: var(--vp-c-brand-1);
}

.tab.active::after {
  background: var(--vp-c-brand-1);
}

.command {
  margin: 0;
  padding: 16px 20px;
  overflow-x: auto;
  color: var(--vp-code-block-color);
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  line-height: 1.7;
  white-space: pre;
  background: transparent;
}

.command code {
  font-family: inherit;
}
</style>
