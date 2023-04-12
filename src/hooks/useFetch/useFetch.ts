import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../config";

export function useFetch<T>(url: string, method: string): [T | null, boolean, boolean] {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    setData(null);

    const controller = new AbortController();
    const signal = controller.signal;

    fetch(`${API_BASE_URL}${url}`,
    {
      method: method,
      signal: signal
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error;
        }

        return res.json();
      })
      .then((res) => {
        setError(false);
        setData(res);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      })
  
    return () => {
      controller.abort();
    }
  }, [url, method])
  
  
  return [data, loading, error];
}