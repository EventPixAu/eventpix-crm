import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get the public-facing base URL for sharing links with clients.
 * Uses the published domain for production emails/links.
 * Falls back to current origin for local development.
 */
export function getPublicBaseUrl(): string {
  // Published production URL - this should match the published app URL
  const PUBLISHED_URL = 'https://eventpix-crm.lovable.app';
  
  // In production (published URL or custom domain), use that
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    // If we're on the published domain or a custom domain, use current origin
    if (origin.includes('eventpix-crm.lovable.app') || 
        origin.includes('eventpix.com') ||
        !origin.includes('lovableproject.com')) {
      return origin;
    }
  }
  
  // If we're on a preview/development URL, use the published URL for client-facing links
  return PUBLISHED_URL;
}
