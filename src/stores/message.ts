import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface MessageType {
  id: string
  text: string
  sender: 'user' | 'bot'
  metadata?: Record<string, unknown>
}

export const useMessagesStore = defineStore('messages', () => {
  // other options...
  const messages = ref<MessageType[]>([])
  const checkId = ref<string>()

  function addMessage(message: MessageType) {
    const existingIndex = messages.value.findIndex((item) => item.id === message.id)

    if (existingIndex !== -1) {
      messages.value.splice(existingIndex, 1, message)
    } else {
      messages.value.push(message)
    }
  }

  function resetMessages(initialMessages: MessageType[] = []) {
    messages.value = [...initialMessages]
  }

  function setCheckID(id: string) {
    checkId.value = id
  }

  return { checkId, messages, addMessage, resetMessages, setCheckID }
})
