import { useState, useCallback } from 'react'

/**
 * Runs an async function and tracks loading / data / error state.
 * Usage:
 *   const { run, loading, data, error } = useAsync()
 *   await run(someApi.call())
 */
export function useAsync() {
  const [loading, setLoading] = useState(false)
  const [data,    setData]    = useState(null)
  const [error,   setError]   = useState(null)

  const run = useCallback(async (promise) => {
    setLoading(true)
    setError(null)
    try {
      const result = await promise
      setData(result)
      return result
    } catch (err) {
      setError(err.message || 'An error occurred')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setData(null)
    setError(null)
  }, [])

  return { run, loading, data, error, reset }
}
