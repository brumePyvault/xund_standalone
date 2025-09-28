<script setup lang="ts">
import { onMounted } from 'vue'

import ChatboxComp from './components/ChatboxComp.vue'
import { useAuthStore } from './stores/auth'
import { useMessagesStore } from './stores/message'
import axios from 'axios'

const apiUrl = import.meta.env.VITE_SERVER_URL ?? ''
const defaultLanguage = import.meta.env.VITE_CHATBOT_LANGUAGE ?? 'en'

const authStore = useAuthStore()
const messageStore = useMessagesStore()

async function initializeChatbot() {
  if (!apiUrl) {
    console.error('Missing VITE_SERVER_URL environment variable')
    return
  }

  try {
    const { data: tokenResponse } = await axios.post<{ access_token: string }>(
      `https://corsanywhere-1tux.onrender.com/proxy?url=https://login.xund.solutions/api/token`,
      {
        clientId: import.meta.env.VITE_CLIENT_ID,
        clientSecret: import.meta.env.VITE_API_KEY,
        grant_type: 'client_credentials',
      },
    )

    authStore.setAuthToken(tokenResponse.access_token)

    const { data: initialization } = await axios.post<{ checkId: string }>(
      `${apiUrl}/v1/chatbot/initialize/symptomCheck`,
      null,
      {
        headers: {
          Authorization: `Bearer ${tokenResponse.access_token}`,
          language: defaultLanguage,
        },
      },
    )

    messageStore.setCheckID(initialization.checkId)
  } catch (error) {
    console.error('Failed to initialize the chatbot flow', error)
  }
}

onMounted(async () => {
  await initializeChatbot()
})
</script>

<template>
  <section class="bg-[#69c3e633] h-dvh w-dvw overflow-hidden">
    <div class="mx-auto w-fit h-full max-w-full py-20 px-2.5">
      <section class="mx-auto w-fit max-w-full h-[90%]">
        <ChatboxComp />
      </section>
    </div>
  </section>
</template>

<style scoped></style>
