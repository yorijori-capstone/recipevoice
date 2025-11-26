/**
 * Get the API base URL dynamically based on the current window location
 * This allows the app to work on different networks without hardcoding IP addresses
 */
export function getApiBaseUrl(): string {
    // If VITE_API_BASE_URL is explicitly set, use it
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    if (envUrl) {
        return envUrl;
    }

    // Otherwise, use the current hostname with port 3001
    // This works for both localhost and network access
    const hostname = window.location.hostname;
    return `http://${hostname}:3001`;
}
