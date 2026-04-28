<template>
  <div class="apex-shell">
    <ApexTopbar />
    <div class="apex-body">
      <ApexSidebar />
      <main class="apex-content">
        <slot />
      </main>
    </div>
  </div>
</template>

<style>
.apex-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #08111d;
  color: #e2e8f0;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.apex-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.apex-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  min-width: 0;
}
</style>
