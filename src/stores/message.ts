import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface MessageType {
  id: number
  text: string
  sender: 'user' | 'bot'
}

export const useMessagesStore = defineStore('messages', () => {
  // other options...
  const messages = ref<MessageType[]>([])
  const checkId = ref<string>()

  function addMessage(message: MessageType) {
    messages.value.push(message)
  }

  function setCheckID(id: string) {
    checkId.value = id
  }

  return { checkId, messages, addMessage, setCheckID }
})
