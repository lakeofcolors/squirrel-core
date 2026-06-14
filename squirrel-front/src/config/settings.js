export function getUrl(path = "/", ws = false) {
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  
  let protocol;
  if (isLocal) {
    protocol = ws ? "ws" : "http";
    return `${protocol}://${window.location.hostname}:9221${path}`;
  }

  // Production: use https/wss and api.<domain>
  protocol = ws ? "wss" : "https";
  
  let host = window.location.host;
  if (host.split(".").length > 2) {
    const parts = host.split(".");
    host = parts.slice(1).join("."); // keep base domain (e.g. lakeofcolors.com)
  }
  
  return `${protocol}://api.${host}${path}`;
}
