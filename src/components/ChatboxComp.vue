<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'

import ChatboxInputComp from './ChatboxInputComp.vue'
import { useAuthStore } from '@/stores/auth'
import { useMessagesStore, type MessageType } from '@/stores/message'
import axios from 'axios'

interface ChatbotOptionItem {
  id: string
  text?: string
  name?: string
  description?: string
  label?: string
  title?: string
}

interface ChatbotQuestion {
  id: string
  text: string
  type: string
  isSkippable: boolean
  isAnswered?: boolean
  detailedType?: string
  options?: {
    count: number
    items?: ChatbotOptionItem[]
  }
  detailedTypeData?: Record<string, unknown>
}

interface OverviewSymptom {
  id: string
  name: string
}

interface OverviewData {
  addedSymptoms: OverviewSymptom[]
  suggestedNotAddedSymptoms: OverviewSymptom[]
}

const apiUrl = import.meta.env.VITE_SERVER_URL
const defaultLanguage = import.meta.env.VITE_CHATBOT_LANGUAGE ?? 'en'

const authStore = useAuthStore()
const messageStore = useMessagesStore()

const { authToken } = storeToRefs(authStore)
const { messages, checkId } = storeToRefs(messageStore)

const isLoading = ref(false)
const isSendingAnswer = ref(false)
const errorMessage = ref<string | null>(null)
const currentQuestion = ref<ChatbotQuestion | null>(null)
const overviewData = ref<OverviewData | null>(null)
const hasLoadedInitialStatus = ref(false)
const scrollContainer = ref<HTMLElement | null>(null)

const questionRequestParams = reactive({
  optionTop: 34,
  optionSkip: 0,
  optionSearchTerm: '',
})

const isReadyForRequests = computed(() => Boolean(apiUrl && authToken.value && checkId.value))

const requestHeaders = computed<Record<string, string>>(() => {
  const headers: Record<string, string> = {}

  if (authToken.value) {
    headers.Authorization = `Bearer ${authToken.value}`
  }

  if (checkId.value) {
    headers['check-id'] = checkId.value
  }

  headers.language = defaultLanguage

  return headers
})

const hasSelectableOptions = computed(() =>
  Boolean(
    currentQuestion.value?.options?.values && currentQuestion.value.options.values.length > 0,
  ),
)

const inputPlaceholder = computed(() => {
  if (!currentQuestion.value) {
    return 'Type a message...'
  }

  if (hasSelectableOptions.value) {
    return 'Search for an option or describe it...'
  }

  return 'Type your answer and press Send'
})

const isInputDisabled = computed(() => {
  if (!currentQuestion.value) {
    return true
  }

  if (hasSelectableOptions.value) {
    return false
  }

  const freeTextTypes = new Set(['TEXT'])
  return !freeTextTypes.has(currentQuestion.value.type)
})

const hasActiveSearchTerm = computed(() => questionRequestParams.optionSearchTerm.length > 0)

watch(
  () => [authToken.value, checkId.value],
  async ([token, id]) => {
    if (!token || !id) {
      return
    }

    await initializeConversation()
  },
  { immediate: true },
)

watch(
  () => messages.value.length,
  async () => {
    await nextTick()
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
    }
  },
)

onMounted(() => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
  }
})

async function initializeConversation() {
  if (!isReadyForRequests.value) {
    return
  }

  if (!hasLoadedInitialStatus.value) {
    await fetchStatus()
    hasLoadedInitialStatus.value = true
  }

  await fetchNextQuestion()
}

function mapOptionLabel(option: ChatbotOptionItem) {
  return (
    option.text ?? option.name ?? option.label ?? option.title ?? option.description ?? 'Select'
  )
}

function generateMessageId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function upsertBotMessage(question: ChatbotQuestion) {
  const messageId = `question-${question.id}`
  const message: MessageType = {
    id: messageId,
    text: question.text,
    sender: 'bot',
    metadata: { questionId: question.id, type: question.type },
  }

  messageStore.addMessage(message)
}

async function fetchStatus() {
  if (!isReadyForRequests.value) {
    return
  }

  isLoading.value = true
  errorMessage.value = null

  try {
    if (!apiUrl) {
      errorMessage.value = 'Missing API URL configuration.'
      return
    }

    const { data } = await axios.get<{ questions?: ChatbotQuestion[] }>(
      `${apiUrl}/v1/chatbot/status`,
      {
        headers: requestHeaders.value,
      },
    )
    const historyMessages: MessageType[] = []

    if (Array.isArray(data?.questions)) {
      for (const question of data.questions as ChatbotQuestion[]) {
        historyMessages.push({
          id: `question-${question.id}`,
          text: question.text,
          sender: 'bot',
          metadata: { questionId: question.id, type: question.type },
        })
      }

      const next = data.questions.find((item: ChatbotQuestion) => !item.isAnswered)
      currentQuestion.value = next ?? null
    }

    messageStore.resetMessages(historyMessages)

    if (currentQuestion.value?.detailedType === 'OVERVIEW') {
      await fetchOverview()
    } else {
      overviewData.value = null
    }
  } catch (error) {
    errorMessage.value = normalizeError(error)
  } finally {
    isLoading.value = false
  }
}

async function fetchOverview() {
  if (!isReadyForRequests.value) {
    return
  }

  try {
    if (!apiUrl) {
      errorMessage.value = 'Missing API URL configuration.'
      return
    }

    const { data } = await axios.get<OverviewData>(`${apiUrl}/v1/chatbot/overview`, {
      headers: requestHeaders.value,
    })
    overviewData.value = data ?? null
  } catch (error) {
    errorMessage.value = normalizeError(error)
  }
}

async function fetchNextQuestion(
  params: { optionSkip?: number; optionTop?: number; optionSearchTerm?: string } = {},
) {
  if (!isReadyForRequests.value) {
    return
  }

  isLoading.value = true
  errorMessage.value = null

  const searchParams = new URLSearchParams()

  const resolvedTop = params.optionTop ?? questionRequestParams.optionTop
  const resolvedSkip = params.optionSkip ?? questionRequestParams.optionSkip
  const resolvedSearchTerm = params.optionSearchTerm ?? questionRequestParams.optionSearchTerm

  if (resolvedTop != null) {
    searchParams.append('optionTop', String(resolvedTop))
    questionRequestParams.optionTop = resolvedTop
  }

  if (resolvedSkip != null && resolvedSkip > 0) {
    searchParams.append('optionSkip', String(resolvedSkip))
    questionRequestParams.optionSkip = resolvedSkip
  } else {
    questionRequestParams.optionSkip = 0
  }

  if (resolvedSearchTerm) {
    searchParams.append('optionSearchTerm', resolvedSearchTerm)
    questionRequestParams.optionSearchTerm = resolvedSearchTerm
  } else {
    questionRequestParams.optionSearchTerm = ''
  }

  const query = searchParams.toString()
  if (!apiUrl) {
    errorMessage.value = 'Missing API URL configuration.'
    return
  }

  const endpoint = query
    ? `${apiUrl}/v1/chatbot/question?${query}`
    : `${apiUrl}/v1/chatbot/question`

  try {
    const { data } = await axios.get<ChatbotQuestion | { question?: ChatbotQuestion }>(endpoint, {
      headers: requestHeaders.value,
    })
    const question: ChatbotQuestion | null =
      data && typeof data === 'object' && 'question' in data
        ? ((data as { question?: ChatbotQuestion }).question ?? null)
        : ((data as ChatbotQuestion | null) ?? null)

    if (!question) {
      currentQuestion.value = null
      overviewData.value = null
      return
    }

    const shouldAppendOptions =
      resolvedSkip > 0 && currentQuestion.value && currentQuestion.value.id === question.id
    const previousOptions = shouldAppendOptions
      ? (currentQuestion.value?.options?.values ?? [])
      : []

    if (shouldAppendOptions && previousOptions.length > 0 && question.options?.items) {
      question.options.items = [...previousOptions, ...question.options.items]
    }

    currentQuestion.value = question
    overviewData.value = null
    upsertBotMessage(question)

    if (question.type === 'INFO') {
      await submitAnswer({ displayText: '', skip: true })
    }
    if (question.detailedType === 'OVERVIEW') {
      await fetchOverview()
    }
  } catch (error) {
    errorMessage.value = normalizeError(error)
  } finally {
    isLoading.value = false
  }
}

async function submitAnswer({
  displayText,
  optionId,
  freeText,
  skip,
}: {
  displayText: string
  optionId?: string
  freeText?: string
  skip?: boolean
}) {
  if (!isReadyForRequests.value || !currentQuestion.value) {
    return
  }

  const userMessage: MessageType = {
    id: generateMessageId('user'),
    text: displayText,
    sender: 'user',
    metadata: { questionId: currentQuestion.value.id },
  }

  messageStore.addMessage(userMessage)

  isSendingAnswer.value = true
  errorMessage.value = null

  try {
    const payload: Record<string, unknown> = {
      questionId: currentQuestion.value.id,
    }

    if (skip) {
    }

    if (optionId) {
      payload.answer = { id: optionId }
    }

    if (freeText) {
      payload.answer = { value: freeText }
    }

    if (!apiUrl) {
      errorMessage.value = 'Missing API URL configuration.'
      return
    }

    await axios.post(`${apiUrl}/v1/chatbot/answer`, payload, {
      headers: requestHeaders.value,
    })

    await fetchNextQuestion({
      optionSkip: 0,
      optionTop: questionRequestParams.optionTop,
      optionSearchTerm: '',
    })
  } catch (error) {
    errorMessage.value = normalizeError(error)
  } finally {
    isSendingAnswer.value = false
  }
}

async function handleSend(message: string) {
  if (!currentQuestion.value) {
    const fallbackMessage: MessageType = {
      id: generateMessageId('user'),
      text: message,
      sender: 'user',
    }
    messageStore.addMessage(fallbackMessage)
    return
  }

  if (hasSelectableOptions.value) {
    await fetchNextQuestion({ optionSearchTerm: message })
    return
  }

  await submitAnswer({ displayText: message, freeText: message })
}

async function handleOptionSelect(option: ChatbotOptionItem) {
  const label = mapOptionLabel(option)
  await submitAnswer({ displayText: label, optionId: option.id })
}

async function handleLoadMoreOptions() {
  const nextSkip = questionRequestParams.optionSkip + questionRequestParams.optionTop
  await fetchNextQuestion({ optionSkip: nextSkip, optionTop: questionRequestParams.optionTop })
}

async function handleResetSearch() {
  await fetchNextQuestion({ optionSearchTerm: '', optionSkip: 0 })
}

async function handleOverviewConfirm() {
  if (!isReadyForRequests.value) {
    return
  }

  isSendingAnswer.value = true
  errorMessage.value = null

  try {
    if (!apiUrl) {
      errorMessage.value = 'Missing API URL configuration.'
      return
    }

    await axios.post(`${apiUrl}/v1/chatbot/overview/confirm`, null, {
      headers: requestHeaders.value,
    })

    await fetchNextQuestion()
  } catch (error) {
    errorMessage.value = normalizeError(error)
  } finally {
    isSendingAnswer.value = false
  }
}

async function handleAddSuggestedSymptom(symptomId: string) {
  if (!isReadyForRequests.value) {
    return
  }

  errorMessage.value = null

  try {
    if (!apiUrl) {
      errorMessage.value = 'Missing API URL configuration.'
      return
    }

    await axios.post(
      `${apiUrl}/v1/chatbot/overview/symptoms`,
      { symptomIds: [symptomId] },
      {
        headers: requestHeaders.value,
      },
    )

    await fetchOverview()
  } catch (error) {
    errorMessage.value = normalizeError(error)
  }
}

function normalizeError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data

    if (typeof responseData === 'string') {
      return responseData
    }

    if (responseData && typeof responseData === 'object' && 'message' in responseData) {
      const maybeMessage = (responseData as { message?: unknown }).message

      if (typeof maybeMessage === 'string') {
        return maybeMessage
      }
    }

    if (error.response?.status) {
      return `Request failed with status ${error.response.status}`
    }

    if (error.message) {
      return error.message
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return 'Something went wrong. Please try again.'
}
</script>

<template>
  <section
    class="flex h-full w-[600px] max-w-full flex-col overflow-hidden rounded-2xl border-4 border-[#6fa2e6] bg-white"
  >
    <header class="border-b border-slate-200 bg-[#6fa2e611] px-6 py-4">
      <h1 class="text-lg font-semibold text-slate-800">Digital Health Assistant</h1>
      <p class="mt-1 text-sm text-slate-500">
        Answer a few questions and I'll guide you through the check-up.
      </p>
    </header>

    <div ref="scrollContainer" class="flex-1 space-y-4 overflow-y-auto px-6 py-4">
      <div v-if="isLoading && messages.length === 0" class="text-center text-sm text-slate-500">
        Loading conversation…
      </div>

      <template v-for="message in messages" :key="message.id">
        <div
          class="flex"
          v-if="message?.text"
          :class="message.sender === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div
            class="max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm"
            :class="
              message.sender === 'user' ? 'bg-[#6fa2e6] text-white' : 'bg-slate-100 text-slate-800'
            "
          >
            <p class="whitespace-pre-wrap leading-relaxed">{{ message.text }}</p>
          </div>
        </div>
      </template>

      <div
        v-if="currentQuestion?.detailedType === 'OVERVIEW' && overviewData"
        class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 class="text-base font-semibold text-slate-800">Review your symptoms</h2>
        <div class="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Added symptoms</h3>
            <ul class="mt-2 space-y-2 text-sm text-slate-600">
              <li
                v-for="symptom in overviewData.addedSymptoms"
                :key="`added-${symptom.id}`"
                class="rounded-lg bg-[#6fa2e611] px-3 py-2"
              >
                {{ symptom.name }}
              </li>
            </ul>
          </div>
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Suggested symptoms</h3>
            <ul class="mt-2 space-y-2 text-sm text-slate-600">
              <li
                v-for="symptom in overviewData.suggestedNotAddedSymptoms"
                :key="`suggested-${symptom.id}`"
                class="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
              >
                <span class="truncate">{{ symptom.name }}</span>
                <button
                  type="button"
                  class="rounded-lg bg-[#6fa2e6] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-[#5a8ccc]"
                  @click="handleAddSuggestedSymptom(symptom.id)"
                >
                  Add
                </button>
              </li>
            </ul>
          </div>
        </div>
        <button
          type="button"
          class="mt-4 inline-flex items-center justify-center rounded-lg bg-[#6fa2e6] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5a8ccc]"
          :disabled="isSendingAnswer"
          @click="handleOverviewConfirm"
        >
          Confirm overview
        </button>
      </div>

      <div v-if="hasSelectableOptions && currentQuestion?.options?.values" class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Suggested answers
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="option in currentQuestion.options.values"
            :key="option.id"
            type="button"
            class="rounded-2xl border border-[#6fa2e6] bg-white px-4 py-2 text-sm font-medium text-[#3060a6] transition hover:bg-[#6fa2e61a]"
            :disabled="isSendingAnswer"
            @click="handleOptionSelect(option)"
          >
            {{ mapOptionLabel(option) }}
          </button>
        </div>
        <div class="flex items-center gap-3 text-xs text-slate-500">
          <button
            type="button"
            class="font-semibold text-[#3060a6] hover:underline"
            @click="handleLoadMoreOptions"
          >
            Load more
          </button>
          <button
            type="button"
            class="font-semibold text-[#3060a6] hover:underline"
            @click="handleResetSearch"
          >
            Reset search
          </button>
          <button
            v-if="currentQuestion?.isSkippable"
            type="button"
            @click="submitAnswer({ displayText: '', skip: true })"
            class="font-semibold text-[#3060a6] hover:underline"
          >
            skip
          </button>
        </div>
      </div>
      <div
        v-else-if="currentQuestion && hasActiveSearchTerm"
        class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
      >
        No matching options found. Try refining your search or browse the suggestions above.
      </div>
    </div>

    <div
      v-if="errorMessage"
      class="border-t border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700"
    >
      {{ errorMessage }}
    </div>

    <ChatboxInputComp
      class="border-t border-slate-200"
      :disabled="isInputDisabled || isSendingAnswer"
      :placeholder="inputPlaceholder"
      @send="handleSend"
    />
  </section>
</template>
