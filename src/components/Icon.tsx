const P: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.3-4.3',
  heart: 'M12 20s-7-4.4-9.2-8.6C1.3 8.4 3 5 6.4 5c2 0 3.3 1.1 4.1 2.3h3C14.3 6.1 15.6 5 17.6 5 21 5 22.7 8.4 21.2 11.4 19 15.6 12 20 12 20z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9c0-3.9 3.6-6 8-6s8 2.1 8 6',
  store: 'M4 9h16l-1.5-5h-13zM4 9v11h16V9M4 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 2 3s2-1.3 2-3c0 1.7 1.3 3 3 3s3-1.3 3-3M9 20v-5h6v5',
  leaf: 'M5 19c0-8 5-14 15-15-1 10-7 15-15 15zm0 0 7-7',
  tool: 'M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.5-2.5z',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  pin: 'M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12zm0-9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  phone: 'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z',
  chat: 'M4 20l1.4-4A8 8 0 1 1 8 19.3z',
  crown: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  box: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zm0 0L12 12l9-4.5M12 12v9',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  trash: 'M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13',
  image: 'M4 5h16v14H4zm0 11 5-5 4 4 2-2 5 5M15.5 9.5a1.5 1.5 0 1 0 0-.01',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5 10 17 19 7',
  basket: 'M3 10h18l-2 10H5zm5 0 3-6m5 6-3-6',
  shirt: 'M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  food: 'M7 3v8m-3-8v5a3 3 0 0 0 6 0V3M7 11v10m10-18c-2 0-3 3-3 6s1 4 3 4v8',
  fruit: 'M12 7c-4-2-8 1-8 6s3.5 8 8 8 8-3 8-8-4-8-8-6zm0 0c0-2 1-4 3-4',
  egg: 'M12 3c-3.5 0-6.5 6-6.5 10.5a6.5 6.5 0 0 0 13 0C18.5 9 15.5 3 12 3z',
  seed: 'M12 21v-8m0 0c-4 0-7-3-7-7 4 0 7 3 7 7zm0-2c0-3.5 3-6 6-6 0 3.5-3 6-6 6',
  truck: 'M2 6h12v10H2zm12 4h4l3 3v3h-7M6 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 0v16M8 7h7',
  tag: 'M3 12V3h9l9 9-9 9zM7.5 7.5a.5.5 0 1 0 0-.01',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  download: 'M12 4v11m-5-5 5 5 5-5M5 20h14',
  grid: 'M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 10c0-3.5 3-5.5 7-5.5s7 2 7 5.5M16 3.5a4 4 0 0 1 0 7.5M22 21c0-2.8-1.6-4.6-4-5.2',
  share: 'M12 15V3m-4 4 4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zm4 4h4',
}

export function Icon({ name, size = 20, stroke = 1.8, className, filled = false }:
  { name: string; size?: number; stroke?: number; className?: string; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <path d={P[name] ?? P.tag} />
    </svg>
  )
}
