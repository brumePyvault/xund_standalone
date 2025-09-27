<script setup lang="ts">
import { computed, ref } from 'vue'

const emit = defineEmits<{
  (e: 'send', message: string): void
}>()

const draftMessage = ref('')

const isSendDisabled = computed(() => draftMessage.value.trim().length === 0)

function submit() {
  const trimmed = draftMessage.value.trim()
  if (!trimmed) {
    return
  }

  emit('send', trimmed)
  draftMessage.value = ''
}
</script>
<template>
  <form @submit.prevent="submit" class="flex items-end gap-3 bg-white p-4">
    <label class="sr-only" for="chat-input">Message</label>
    <textarea
      id="chat-input"
      v-model="draftMessage"
      rows="2"
      placeholder="Type your message..."
      class="w-full flex-1 resize-none rounded-xl border border-slate-200 p-3 text-base text-slate-700 shadow-sm focus:border-[#6fa2e6] focus:outline-none focus:ring-2 focus:ring-[#6fa2e6]"
    ></textarea>
    <button
      type="submit"
      :disabled="isSendDisabled"
      class="rounded-xl bg-[#6fa2e6] px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white transition-colors disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      Send
    </button>
  </form>
</template>
