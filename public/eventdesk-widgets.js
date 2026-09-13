(function () {
  'use strict';
  const script = document.currentScript;
  if (!script) return;
  const origin = new URL(script.src).origin;
  document
    .querySelectorAll('.eventdesk-widget-embed:not([data-eventdesk-ready])')
    .forEach(function (host) {
      let url;
      try {
        url = new URL(host.dataset.eventdeskSrc);
      } catch {
        return;
      }
      if (
        url.origin !== origin ||
        !/^\/(gallery|inquiry|schedule|widgets\/availability)\//.test(
          url.pathname,
        )
      )
        return;
      host.dataset.eventdeskReady = 'true';
      const iframe = document.createElement('iframe');
      iframe.src = url.href;
      iframe.title = host.dataset.eventdeskTitle || 'Eventdeskly';
      iframe.loading = 'lazy';
      iframe.style.cssText =
        'display:block;width:100%;border:0;min-height:250px;';
      iframe.height = String(
        Math.min(
          2000,
          Math.max(250, Number(host.dataset.eventdeskHeight) || 800),
        ),
      );
      host.appendChild(iframe);
      const fallback = document.createElement('a');
      fallback.href = url.href;
      fallback.target = '_blank';
      fallback.rel = 'noopener';
      fallback.textContent = 'Open ' + iframe.title;
      host.appendChild(fallback);
      window.addEventListener('message', function (event) {
        if (
          event.source !== iframe.contentWindow ||
          event.origin !== origin ||
          !event.data ||
          event.data.type !== 'eventdesk:resize'
        )
          return;
        const height = Number(event.data.height);
        if (Number.isFinite(height) && height >= 200 && height <= 20000)
          iframe.height = String(Math.ceil(height));
      });
    });
})();
