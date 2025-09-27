import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const authToken = ref<string | null>(null)

  function setAuthToken(token: string | null) {
    authToken.value = token
  }

  return { authToken, setAuthToken }
})
