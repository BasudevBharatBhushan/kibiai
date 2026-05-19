import { useEffect, useRef } from 'react';

export function useAutoScroll<T extends HTMLElement>(dependencies: any[]) {
  const scrollRef = useRef<T>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, dependencies);

  return scrollRef;
}