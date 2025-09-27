<script setup lang="ts">
import ChatboxComp from './components/ChatboxComp.vue'
import axios from 'axios'
import { useAuthStore } from './stores/auth'
import { useMessagesStore } from './stores/message'
import { onMounted } from 'vue'

let apiUrl = import.meta.env.VITE_SERVER_URL
let authStore = useAuthStore()
let messageStore = useMessagesStore()

const getAuthToken = async () => {
  try {
    const res = await axios.post(`${apiUrl}/api/token`, {
      clientId: import.meta.env.VITE_CLIENT_ID,
      clientSecret: import.meta.env.VITE_API_KEY,
      grant_type: 'client_credentials',
    })
    authStore.setAuthToken(res.data.access_token)
    const res2 = await axios.post(
      `${apiUrl}/v1/chatbot/initialize/symptomCheck`,
      {},
      {
        Headers: {
          Authorization: `Bearer ${res.data.access_token}`,
        },
      },
    )

    messageStore.setCheckID(res2.data.checkId)
  } catch (error) {}
}
onMounted(async () => {
  await getAuthToken()
})
</script>

<template>
  <section class="bg-[#69c3e633] h-dvh w-dvw overflow-hidden">
    <div class="mx-auto w-fit h-full py-20">
      <section class="mx-auto w-fit h-[90%]">
        <ChatboxComp />
      </section>
    </div>
  </section>
</template>

<style scoped></style>
