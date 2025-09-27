<script setup lang="ts">
import ChatboxInputComp from './ChatboxInputComp.vue'
</script>

<template>
  <section
    class="h-full max-w-full border-4 w-[600px] rounded-2xl bg-white border-[#6fa2e6] overflow-y-auto flex flex-col justify-end"
  >
    <ChatboxInputComp class="border-t border-slate-200" @send="handleSend" />
  </section>
</template>
