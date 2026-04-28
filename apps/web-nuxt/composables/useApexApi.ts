export type ApexEvent = {
  id: string
  title: string
  summary: string | null
  primary_brand: string | null
  relevance_score: number
  event_type?: string | null
  market?: string | null
  latest_draft_status?: string | null
}

export type ApexEventResponse = {
  events: ApexEvent[]
}

export function useApexApi() {
  const config = useRuntimeConfig()
  const apiBase = config.public.apexApiBaseUrl

  const getEvents = async () => {
    return await $fetch<ApexEventResponse>(`${apiBase}/events`)
  }

  const getHealth = async () => {
    return await $fetch<{ status: string; service: string }>(`${apiBase}/health`)
  }

  return {
    apiBase,
    getEvents,
    getHealth,
  }
}
