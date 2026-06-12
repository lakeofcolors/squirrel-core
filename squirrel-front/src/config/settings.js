export function getUrl(path = "/", ws = false) {

  let protocol;
  if (ws) {
    protocol = window.location.protocol === "https:" ? "wss" : "ws";
  }
  else{
    protocol = window.location.protocol.replace(":", "");

  }
  let host = window.location.host;

  if (host.split(".").length > 2) {
    const parts = host.split(".");
    host = parts.slice(1).join("."); // выкидываем первый (sub)
  }

    return `${protocol}://localhost:9221${path}`;
}
