export const LEGACY_SENSITIVE_PARAMETERS = [
  "token",
  "userId",
  "session",
  "credits",
  "subscription",
];

export function parseSessionStartUrl(url: URL, protocol = "meow") {
  if (url.protocol !== `${protocol}:`) return null;

  const action = url.host || url.pathname.replace(/^\/+/, "");
  if (action !== "start") return null;

  const requestedMode = url.searchParams.get("mode");
  if (requestedMode && requestedMode !== "copilot") return null;

  return {
    payload: { launchMode: "copilot" },
    ignoredSensitiveParameters: LEGACY_SENSITIVE_PARAMETERS.some((name) =>
      url.searchParams.has(name)
    ),
  };
}
