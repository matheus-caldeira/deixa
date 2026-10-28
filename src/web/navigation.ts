type Navigate = (href: string) => void;

let current: Navigate = (href) => window.location.assign(href);

export function setNavigator(navigate: Navigate) {
  current = navigate;
}

export function navigate(href: string) {
  current(href);
}
