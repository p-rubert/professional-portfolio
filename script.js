const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector("#site-nav");
let activeImageViewer;

function setMenuOpen(isOpen) {
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
  siteNav.classList.toggle("is-open", isOpen);
}

menuToggle.addEventListener("click", () => {
  setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
});

siteNav.addEventListener("click", (event) => {
  if (event.target.closest("a")) setMenuOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
    if (activeImageViewer?.open) return;
    setMenuOpen(false);
    menuToggle.focus();
  }
});

const contentImageSelector = "main img[alt]:not([alt=''])";
let imageViewer;

function createImageViewer() {
  const dialog = document.createElement("dialog");
  dialog.className = "image-viewer";
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "image-viewer-title");

  const header = document.createElement("div");
  header.className = "image-viewer-header";
  const title = document.createElement("h2");
  title.id = "image-viewer-title";
  title.textContent = "Image viewer";
  header.append(title);

  const controls = document.createElement("div");
  controls.className = "image-viewer-controls";
  controls.setAttribute("role", "group");
  controls.setAttribute("aria-label", "Image viewer controls");

  const createControl = (label, text, action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.textContent = text;
    button.addEventListener("click", action);
    controls.append(button);
    return button;
  };

  const stage = document.createElement("div");
  stage.className = "image-viewer-stage";
  const viewerImage = document.createElement("img");
  viewerImage.className = "image-viewer-image";
  viewerImage.draggable = false;
  stage.append(viewerImage);

  let scale = 1;
  let panX = 0;
  let panY = 0;
  let fitWidth = 0;
  let fitHeight = 0;
  let activeTrigger;
  const pointers = new Map();
  let gesture;

  const clampPan = () => {
    const maxX = Math.max(0, (fitWidth * scale - stage.clientWidth) / 2);
    const maxY = Math.max(0, (fitHeight * scale - stage.clientHeight) / 2);
    panX = Math.max(-maxX, Math.min(maxX, panX));
    panY = Math.max(-maxY, Math.min(maxY, panY));
  };

  const applyTransform = () => {
    const boundedScale = Math.max(1, Math.min(5, scale));
    scale = boundedScale;
    clampPan();
    viewerImage.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`;
    zoomOutButton.setAttribute("aria-disabled", String(scale === 1));
    fitButton.setAttribute("aria-disabled", String(scale === 1 && panX === 0 && panY === 0));
    zoomInButton.setAttribute("aria-disabled", String(scale === 5));
  };

  const fitImage = () => {
    if (!viewerImage.naturalWidth || !stage.clientWidth || !stage.clientHeight) return;
    const fitScale = Math.min(stage.clientWidth / viewerImage.naturalWidth, stage.clientHeight / viewerImage.naturalHeight, 1);
    fitWidth = viewerImage.naturalWidth * fitScale;
    fitHeight = viewerImage.naturalHeight * fitScale;
    viewerImage.style.width = `${fitWidth}px`;
    viewerImage.style.height = `${fitHeight}px`;
    scale = 1;
    panX = 0;
    panY = 0;
    applyTransform();
  };

  const zoomAt = (nextScale, anchorX, anchorY) => {
    const previousScale = scale;
    scale = Math.max(1, Math.min(5, nextScale));
    const ratio = scale / previousScale;
    panX = anchorX - (anchorX - panX) * ratio;
    panY = anchorY - (anchorY - panY) * ratio;
    applyTransform();
  };

  const closeButton = createControl("Close image viewer", "×", () => dialog.close());
  closeButton.classList.add("image-viewer-close");
  const zoomOutButton = createControl("Zoom out", "−", () => zoomAt(scale - 0.25, 0, 0));
  const fitButton = createControl("Fit image to screen", "Fit", fitImage);
  const zoomInButton = createControl("Zoom in", "+", () => zoomAt(scale + 0.25, 0, 0));
  header.append(controls);
  dialog.append(header, stage);
  document.body.append(dialog);

  const focusableElements = () => [...dialog.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];

  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = focusableElements();
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    dialog.close();
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener("close", () => {
    activeImageViewer = undefined;
    pointers.clear();
    gesture = undefined;
    scale = 1;
    panX = 0;
    panY = 0;
    activeTrigger?.focus();
    activeTrigger = undefined;
  });

  viewerImage.addEventListener("load", () => {
    if (dialog.open) fitImage();
  });

  stage.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = stage.getBoundingClientRect();
    const anchorX = event.clientX - rect.left - rect.width / 2;
    const anchorY = event.clientY - rect.top - rect.height / 2;
    zoomAt(scale * Math.exp(-event.deltaY * 0.001), anchorX, anchorY);
  }, { passive: false });

  const pointerPosition = (event) => {
    const rect = stage.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const startGesture = () => {
    const points = [...pointers.values()];
    if (points.length > 1) {
      const first = points[0];
      const second = points[1];
      const centerX = (first.x + second.x) / 2;
      const centerY = (first.y + second.y) / 2;
      const rect = stage.getBoundingClientRect();
      const relativeX = centerX - rect.width / 2;
      const relativeY = centerY - rect.height / 2;
      gesture = {
        kind: "pinch",
        distance: Math.hypot(second.x - first.x, second.y - first.y),
        scale,
        anchorX: (relativeX - panX) / scale,
        anchorY: (relativeY - panY) / scale
      };
      return;
    }
    const [point] = points;
    gesture = point ? { kind: "pan", x: point.x, y: point.y, panX, panY } : undefined;
  };

  stage.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stage.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, pointerPosition(event));
    startGesture();
  });

  stage.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, pointerPosition(event));
    if (pointers.size > 1 && gesture?.kind === "pinch") {
      const points = [...pointers.values()];
      const first = points[0];
      const second = points[1];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const rect = stage.getBoundingClientRect();
      const centerX = (first.x + second.x) / 2 - rect.width / 2;
      const centerY = (first.y + second.y) / 2 - rect.height / 2;
      scale = Math.max(1, Math.min(5, gesture.scale * distance / Math.max(gesture.distance, 1)));
      panX = centerX - gesture.anchorX * scale;
      panY = centerY - gesture.anchorY * scale;
      applyTransform();
    } else if (pointers.size === 1 && gesture?.kind === "pan" && scale > 1) {
      const [point] = pointers.values();
      panX = gesture.panX + point.x - gesture.x;
      panY = gesture.panY + point.y - gesture.y;
      applyTransform();
    }
  });

  const endGesture = (event) => {
    pointers.delete(event.pointerId);
    startGesture();
  };
  stage.addEventListener("pointerup", endGesture);
  stage.addEventListener("pointercancel", endGesture);
  stage.addEventListener("lostpointercapture", endGesture);

  window.addEventListener("resize", () => {
    if (!dialog.open) return;
    if (scale === 1) fitImage();
    else applyTransform();
  });

  return {
    open(trigger, image) {
      const fullSizeSource = image.dataset.fullSrc || image.getAttribute("src");
      if (!fullSizeSource) return;
      const figureTitle = image.closest("figure")?.querySelector("figcaption h3")?.textContent;
      const sectionTitle = image.closest("article")?.querySelector("h2")?.textContent;
      const imageTitle = figureTitle || sectionTitle || image.alt;
      title.textContent = imageTitle;
      viewerImage.src = new URL(fullSizeSource, document.baseURI).href;
      viewerImage.alt = image.alt;
      activeTrigger = trigger;
      activeImageViewer = dialog;
      dialog.showModal();
      closeButton.focus();
      requestAnimationFrame(fitImage);
    }
  };
}

function enhanceContentImage(image) {
  if (image.dataset.imageViewerEnhanced === "true" || !image.matches(contentImageSelector)) return;
  if (image.closest("a, button, [role='button'], [aria-hidden='true'], .site-header, .site-footer, .logo, .icon, .decorative, [data-image-viewer-ignore]")) return;
  if (!image.dataset.fullSrc && !image.getAttribute("src")) return;

  const imageContent = image.closest("picture") || image;
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "image-viewer-trigger";
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-label", `Open image viewer: ${image.alt}`);
  trigger.addEventListener("click", () => imageViewer.open(trigger, image));

  const hint = document.createElement("span");
  hint.className = "image-viewer-hint";
  hint.textContent = "Click to enlarge";
  imageContent.before(trigger);
  trigger.append(imageContent, hint);
  image.dataset.imageViewerEnhanced = "true";
  imageViewer ||= createImageViewer();
}

function enhanceImagesWithin(node) {
  if (!(node instanceof Element)) return;
  if (node.matches(contentImageSelector)) enhanceContentImage(node);
  node.querySelectorAll(contentImageSelector).forEach(enhanceContentImage);
}

enhanceImagesWithin(document.querySelector("main"));

const imageObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === "attributes") {
      enhanceContentImage(mutation.target);
      continue;
    }
    mutation.addedNodes.forEach(enhanceImagesWithin);
  }
});
imageObserver.observe(document.body, {
  attributes: true,
  attributeFilter: ["alt", "src", "data-full-src"],
  childList: true,
  subtree: true
});

document.querySelector("#current-year").textContent = String(new Date().getFullYear());