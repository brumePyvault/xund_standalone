<script setup lang="ts">
import ChatboxComp from './components/ChatboxComp.vue'

let apiUrl = import.meta.env.VITE_SERVER_URL
</script>

<template>
  <section class="bg-[#69c3e633] h-dvh w-dvw overflow-hidden">
    <div class="mx-auto w-fit h-full py-20">
      <section class="mx-auto w-fit h-[80%]">
        <ChatboxComp />
      </section>
    </div>
  </section>
</template>

<style scoped></style>
