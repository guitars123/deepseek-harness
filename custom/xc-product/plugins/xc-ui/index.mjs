/** Product-owned branding through the native WebServer transform. */
export const inject = ['webServer'];
/** @param ctx Cordis context. */
export function apply(ctx) {
  ctx.effect(() => ctx.webServer.tapIndex(html => html
    .replace(/<title>[^<]*<\/title>/u, '<title>胥瓷智库</title>')
    .replace(/<link([^>]+rel=["']manifest["'][^>]*)>/iu, '<link$1 crossorigin="use-credentials">')));
}
