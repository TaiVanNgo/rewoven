export const interactionTransition = {
  duration: 0.18,
  ease: [0.2, 0, 0, 1],
} as const;

export const sidebarTransition = {
  ...interactionTransition,
  duration: 0.24,
} as const;
