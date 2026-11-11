// shadcn's class-merge helper. `clsx` handles conditional/tuple class inputs,
// `twMerge` resolves conflicting Tailwind utilities so a caller's className always
// wins over a component's defaults (e.g. cn('p-2', 'p-4') -> 'p-4').
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
