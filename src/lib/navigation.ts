import type { Href, ImperativeRouter } from 'expo-router';

export function goBack(router: ImperativeRouter, fallbackHref: Href = '/') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackHref);
  }
}
